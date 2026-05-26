'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HubConnection } from '@microsoft/signalr';
import RankingPhase from './RankingPhase';
import GuessingPhase from './GuessingPhase';
import ResultsPhase from './ResultsPhase';
import Leaderboard from './Leaderboard';
import MatchSplash from './MatchSplash';
import Timer from './Timer';
import { GuessResult, Player, Round, Session } from '../lib/types';

type GameMode = 'normal' | 'meme';

interface TargetInfo {
  targetId: string;
  targetName: string;
  isTriple: boolean;
  cycleInfo?: string;
}

export default function GameScreen({
  session: initialSession,
  connection,
}: {
  session: Session;
  connection: HubConnection;
}) {
  const sessionCode = initialSession.sessionCode;
  const [phase, setPhase] = useState<'lobby' | 'splash' | 'ranking' | 'guessing' | 'results' | 'leaderboard' | 'gameover'>('lobby');
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [targetInfo, setTargetInfo] = useState<TargetInfo | null>(null);
  const [lastResult, setLastResult] = useState<GuessResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [players, setPlayers] = useState<Player[]>(initialSession.players);
  const [hostPlayerId, setHostPlayerId] = useState<string>(initialSession.hostPlayerId);
  const [timer, setTimer] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  // Round count — host selects before first round; locked in once game starts.
  const ROUND_OPTIONS = [1, 2, 3] as const;
  const [selectedRounds, setSelectedRounds] = useState<1 | 2 | 3>(2);
  const [maxRounds, setMaxRounds] = useState<number>(initialSession.maxRounds ?? 2);

  // Game mode — host selects before first round; locked in once game starts.
  const [selectedMode, setSelectedMode] = useState<GameMode>('normal');
  const [gameMode, setGameMode] = useState<GameMode>(
    (initialSession.gameMode as GameMode) ?? 'normal'
  );
  const [roundNum, setRoundNum] = useState<number>(0);

  // Per-round submission tracking — used to show "waiting for partner" UI
  // without changing phase or clearing timer until the server confirms all done.
  const [hasSubmittedRanking, setHasSubmittedRanking] = useState(false);
  const [hasSubmittedGuess, setHasSubmittedGuess] = useState(false);

  // LeaderboardUpdate / GameOver arrive when all guesses are in, but we delay
  // showing the next screen until the discussion timer in ResultsPhase completes.
  const [pendingLeaderboard, setPendingLeaderboard] = useState<Player[] | null>(null);
  const [pendingIsFinal, setPendingIsFinal] = useState(false);
  const [discussionActive, setDiscussionActive] = useState(false);
  const [discussionDone, setDiscussionDone] = useState(false);

  // Ref keeps current players without triggering handler re-registration
  const playersRef = useRef<Player[]>(initialSession.players);

  const isHost = connection.connectionId === hostPlayerId;

  // Transition to leaderboard/gameover once:
  // 1) all guesses submitted (pendingLeaderboard populated)
  // 2) discussion timer expired (discussionDone flagged by ResultsPhase)
  useEffect(() => {
    if (pendingLeaderboard !== null && discussionDone) {
      setLeaderboard(pendingLeaderboard);
      setPendingLeaderboard(null);
      setDiscussionActive(false);
      setDiscussionDone(false);
      setPhase(pendingIsFinal ? 'gameover' : 'leaderboard');
      setPendingIsFinal(false);
    }
  }, [pendingLeaderboard, discussionDone, pendingIsFinal]);

  // Fallback: if targetInfo wasn't resolved during RoundStarted (e.g. handler was
  // temporarily unregistered during a players update), re-resolve it here when the
  // guessing phase actually begins.
  useEffect(() => {
    if (phase !== 'guessing' || !currentRound || targetInfo) return;
    const myId = connection.connectionId;
    if (!myId || !currentRound.pairings) return;
    const targetId = currentRound.pairings[myId];
    if (!targetId) return;
    const targetPlayer = playersRef.current.find(p => p.playerId === targetId);
    setTargetInfo({
      targetId,
      targetName: targetPlayer?.name ?? '(unknown)',
      isTriple: !!currentRound.triple,
      cycleInfo: currentRound.triple
        ? `Triple round — you guess ${targetPlayer?.name ?? targetId}'s ranking.`
        : undefined,
    });
  }, [phase, currentRound, targetInfo, connection]);

  // Ref so the timer interval can call the latest version of handleSubmit
  const autoSubmitRef = useRef<(() => void) | null>(null);

  // Refs that always hold the latest phase/targetInfo — never stale in closures
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const targetInfoRef = useRef(targetInfo);
  targetInfoRef.current = targetInfo;
  // True while a timer is actively counting down (distinguishes expiry from initial timer=0)
  const countingRef = useRef(false);

  // Timer countdown — state updater is pure (no side effects inside it)
  useEffect(() => {
    if (timer <= 0) return;
    countingRef.current = true;
    const id = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer]);

  // Fire auto-submit when the countdown reaches 0.
  // Kept as a separate useEffect so side-effects (invoke, setState) are legal here.
  useEffect(() => {
    if (timer === 0 && countingRef.current) {
      countingRef.current = false;
      autoSubmitRef.current?.();
    }
  }, [timer]);

  // Callback registered by RankingPhase/GuessingPhase so we can auto-submit on timeout.
  // Reads phase/targetInfo from refs (always current) — no stale-closure risk.
  // Phase changes are NOT done here — we wait for the server to confirm all players
  // are done (AllRankingsSubmitted / LeaderboardUpdate / GameOver).
  const handleTimeUp = useCallback((getRanked: () => string[]) => {
    autoSubmitRef.current = () => {
      const ranked = getRanked();
      if (phaseRef.current === 'ranking') {
        connection.invoke('SubmitRanking', sessionCode, ranked).catch(console.error);
        setHasSubmittedRanking(true);
      } else if (phaseRef.current === 'guessing') {
        const ti = targetInfoRef.current;
        if (ti) {
          connection.invoke('SubmitGuess', sessionCode, ti.targetId, ranked).catch(console.error);
          setHasSubmittedGuess(true);
        }
      }
    };
  // connection and sessionCode are stable after mount; phase/targetInfo read via refs
  }, [connection, sessionCode]);

  useEffect(() => {
    connection.on('SessionUpdated', (s: Session) => {
      playersRef.current = s.players;
      setPlayers(s.players);
      setHostPlayerId(s.hostPlayerId);
      if (s.maxRounds) setMaxRounds(s.maxRounds);
      if (s.gameMode) setGameMode(s.gameMode as GameMode);
    });

    connection.on('RoundStarted', (round: Round) => {
      setServerError(null); // clear any pre-game errors (e.g. "Need at least 2 players")
      setCurrentRound(round);
      setRoundNum(round.roundNum);
      setPhase('splash'); // show match splash before ranking; timer starts after splash
      setHasSubmittedRanking(false);
      setHasSubmittedGuess(false);
      setTargetInfo(null); // reset so fallback effect can re-resolve for guessing phase
      // Resolve our target from pairings using ref (avoids stale closure on players state)
      const myId = connection.connectionId;
      if (myId && round.pairings) {
        const targetId = round.pairings[myId];
        if (targetId) {
          const targetPlayer = playersRef.current.find(p => p.playerId === targetId);
          const isTriple = !!round.triple;
          const cycleInfo = isTriple
            ? `Triple round — you guess ${targetPlayer?.name ?? targetId}'s ranking.`
            : undefined;
          setTargetInfo({
            targetId,
            targetName: targetPlayer?.name ?? '(unknown)',
            isTriple,
            cycleInfo,
          });
        }
      }
    });

    connection.on('AllRankingsSubmitted', () => {
      setTimer(60);
      setPhase('guessing');
    });

    connection.on('GuessResult', (result: GuessResult) => {
      // Store the result data only — do NOT change phase or clear the timer.
      // We stay in guessing phase (showing "waiting for partner") until
      // LeaderboardUpdate/GameOver confirms all players have submitted.
      setLastResult(result);
    });

    connection.on('LeaderboardUpdate', (lb: Player[]) => {
      // All players have submitted — now advance to results for everyone simultaneously.
      autoSubmitRef.current = null;
      setTimer(0);
      setHasSubmittedGuess(false);
      setPhase('results');
      setPendingLeaderboard(lb);
      setDiscussionActive(true);
    });

    connection.on('GameOver', (finalStandings: Player[]) => {
      // Same as LeaderboardUpdate but lands on 'gameover' after discussion.
      autoSubmitRef.current = null;
      setTimer(0);
      setHasSubmittedGuess(false);
      setPhase('results');
      setPendingLeaderboard(finalStandings);
      setPendingIsFinal(true);
      setDiscussionActive(true);
    });

    connection.on('Error', (msg: string) => {
      setServerError(msg);
      // Reset submission flags so the player can retry instead of being
      // stuck on "waiting for others…" after a server-side failure.
      setHasSubmittedRanking(false);
      setHasSubmittedGuess(false);
    });

    return () => {
      connection.off('SessionUpdated');
      connection.off('RoundStarted');
      connection.off('AllRankingsSubmitted');
      connection.off('GuessResult');
      connection.off('LeaderboardUpdate');
      connection.off('GameOver');
      connection.off('Error');
    };
  // Intentionally omit `players` — use playersRef for name lookups to avoid
  // tearing down and re-registering all handlers on every SessionUpdated.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, sessionCode]);

  // Called by MatchSplash when its 5-second animation completes.
  const handleSplashDone = useCallback(() => {
    setPhase('ranking');
    setTimer(60);
  }, []);

  const handleSubmitRanking = (ranked: string[]) => {
    connection.invoke('SubmitRanking', sessionCode, ranked).catch(console.error);
    setHasSubmittedRanking(true);
    // Phase stays 'ranking' and timer keeps running until AllRankingsSubmitted fires.
  };

  const handleSubmitGuess = (guessed: string[]) => {
    if (!targetInfo) return;
    connection.invoke('SubmitGuess', sessionCode, targetInfo.targetId, guessed).catch(console.error);
    setHasSubmittedGuess(true);
    // Timer keeps running until LeaderboardUpdate/GameOver signals everyone is done.
  };

  const handleStartRound = () => {
    // Pass selectedRounds on every call — backend only applies it on round 1.
    connection.invoke('StartNewRound', sessionCode, selectedRounds).catch(console.error);
  };

  // Called whenever the host changes the mode toggle in the lobby.
  const handleModeChange = (mode: GameMode) => {
    setSelectedMode(mode);
    connection.invoke('SetGameMode', sessionCode, mode).catch(console.error);
  };

  return (
    <div className="space-y-8">
      {serverError && (
        <div className="bg-red-900 border border-red-500 rounded-xl px-6 py-4 text-red-200">
          {serverError}
        </div>
      )}

      {phase === 'lobby' && (
        <div className="text-center text-zinc-400">
          <p className="text-2xl mb-2">Session: <span className="text-neon font-mono font-bold">{sessionCode}</span></p>

          {isHost ? (
            <div className="mt-6 space-y-6">
              {/* Round count selector */}
              <div className="bg-zinc-800 rounded-2xl px-8 py-5 inline-block">
                <p className="text-zinc-300 text-sm font-semibold uppercase tracking-widest mb-4">Number of Rounds</p>
                <div className="flex items-center gap-6 justify-center">
                  {ROUND_OPTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => setSelectedRounds(n)}
                      className={`w-14 h-14 rounded-xl text-xl font-bold transition border-2 ${
                        selectedRounds === n
                          ? 'bg-neon text-black border-neon'
                          : 'bg-zinc-700 text-zinc-300 border-zinc-600 hover:border-neon hover:text-neon'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-zinc-500 text-xs mt-3">
                  ~{selectedRounds * 4}–{selectedRounds * 6} minutes of play
                </p>
              </div>

              {/* Game mode selector */}
              <div className="bg-zinc-800 rounded-2xl px-8 py-5 inline-block">
                <p className="text-zinc-300 text-sm font-semibold uppercase tracking-widest mb-4">Game Mode</p>
                <div className="flex items-center gap-6 justify-center">
                  <button
                    onClick={() => handleModeChange('normal')}
                    className={`px-6 py-3 rounded-xl font-bold transition border-2 ${
                      selectedMode === 'normal'
                        ? 'bg-neon text-black border-neon'
                        : 'bg-zinc-700 text-zinc-300 border-zinc-600 hover:border-neon hover:text-neon'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => handleModeChange('meme')}
                    className={`px-6 py-3 rounded-xl font-bold transition border-2 ${
                      selectedMode === 'meme'
                        ? 'bg-red-500 text-black border-red-500'
                        : 'bg-zinc-700 text-zinc-300 border-zinc-600 hover:border-red-400 hover:text-red-400'
                    }`}
                  >
                    🔥 Meme Mode
                  </button>
                </div>
                <p className="text-zinc-500 text-xs mt-3">
                  {selectedMode === 'meme'
                    ? 'Chaotic descriptions — not for the faint of heart'
                    : 'Professional tooltips — keeping it corporate'}
                </p>
              </div>

              <div>
                <button
                  onClick={handleStartRound}
                  className="px-8 py-3 bg-neon text-black font-bold text-lg rounded-xl hover:opacity-90 transition"
                >
                  START ROUND
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-4">Waiting for host to start the round…</p>
          )}

          <div className="mt-6 space-y-2">
            {players.map(p => (
              <div key={p.playerId} className="text-white">{p.name}</div>
            ))}
          </div>
        </div>
      )}

      {/* Match splash — fixed overlay, shown at the start of every round */}
      {phase === 'splash' && targetInfo && (
        <MatchSplash targetName={targetInfo.targetName} onDone={handleSplashDone} />
      )}

      {/* Round counter — shown during active gameplay and leaderboard (not during splash) */}
      {roundNum > 0 && phase !== 'lobby' && phase !== 'splash' && phase !== 'gameover' && (
        <div className="text-center">
          <span className="inline-block bg-zinc-800 border border-zinc-700 rounded-full px-4 py-1 text-sm text-zinc-400 font-mono">
            Round <span className="text-neon font-bold">{roundNum}</span> of <span className="text-cyber font-bold">{maxRounds}</span>
          </span>
        </div>
      )}

      {phase === 'ranking' && currentRound && (
        <RankingPhase
          cards={currentRound.cards}
          onSubmit={handleSubmitRanking}
          onTimeUp={handleTimeUp}
          hasSubmitted={hasSubmittedRanking}
          isMeme={gameMode === 'meme'}
        />
      )}

      {phase === 'guessing' && currentRound && targetInfo && (
        <GuessingPhase
          targetName={targetInfo.targetName}
          cards={currentRound.cards}
          isTriple={targetInfo.isTriple}
          cycleInfo={targetInfo.cycleInfo}
          onSubmit={handleSubmitGuess}
          onTimeUp={handleTimeUp}
          hasSubmitted={hasSubmittedGuess}
          isMeme={gameMode === 'meme'}
        />
      )}

      {phase === 'results' && lastResult && currentRound && (
        <ResultsPhase
          result={lastResult}
          cards={currentRound.cards}
          discussionActive={discussionActive}
          onDiscussionEnd={() => setDiscussionDone(true)}
        />
      )}

      {(phase === 'leaderboard' || phase === 'gameover') && (
        <>
          <Leaderboard
            players={leaderboard}
            isFinal={phase === 'gameover'}
            currentRound={roundNum}
            maxRounds={maxRounds}
          />
          {phase === 'leaderboard' && isHost && (
            <div className="text-center mt-6">
              <button
                onClick={handleStartRound}
                className="px-8 py-3 bg-neon text-black font-bold text-lg rounded-xl hover:opacity-90 transition"
              >
                START NEXT ROUND
              </button>
            </div>
          )}
          {phase === 'gameover' && (
            <div className="text-center mt-6">
              <button
                onClick={() => { window.location.href = window.location.origin; }}
                className="px-8 py-3 bg-zinc-700 text-zinc-200 font-bold text-lg rounded-xl hover:bg-zinc-600 transition"
              >
                Return to Home
              </button>
            </div>
          )}
        </>
      )}

      {timer > 0 && <Timer seconds={timer} color={timer <= 10 ? 'red-400' : 'neon'} />}
    </div>
  );
}