'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HubConnection } from '@microsoft/signalr';
import RankingPhase from './RankingPhase';
import GuessingPhase from './GuessingPhase';
import ResultsPhase from './ResultsPhase';
import Leaderboard from './Leaderboard';
import Timer from './Timer';
import { Card, GuessResult, Player, Round, Session } from '../lib/types';

interface TargetInfo {
  targetId: string;
  targetName: string;
  isTriple: boolean;
  cycleInfo?: string;
}

export default function GameScreen({
  session: initialSession,
  connection,
  isDebug,
}: {
  session: Session;
  connection: HubConnection;
  isDebug: boolean;
}) {
  const sessionCode = initialSession.sessionCode;
  const [phase, setPhase] = useState<'lobby' | 'ranking' | 'guessing' | 'results' | 'leaderboard' | 'gameover'>('lobby');
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [targetInfo, setTargetInfo] = useState<TargetInfo | null>(null);
  const [lastResult, setLastResult] = useState<GuessResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [players, setPlayers] = useState<Player[]>(initialSession.players);
  const [hostPlayerId, setHostPlayerId] = useState<string>(initialSession.hostPlayerId);
  const [timer, setTimer] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  // Round count — host selects before first round; locked in once game starts.
  const ROUND_OPTIONS = [3, 5, 8] as const;
  const [selectedRounds, setSelectedRounds] = useState<3 | 5 | 8>(5);
  const [maxRounds, setMaxRounds] = useState<number>(initialSession.maxRounds ?? 5);
  const [roundNum, setRoundNum] = useState<number>(0);

  // LeaderboardUpdate / GameOver arrive when all guesses are in, but we delay
  // showing the next screen until the discussion timer in ResultsPhase completes.
  const [pendingLeaderboard, setPendingLeaderboard] = useState<Player[] | null>(null);
  const [pendingIsFinal, setPendingIsFinal] = useState(false);
  const [discussionActive, setDiscussionActive] = useState(false);
  const [discussionDone, setDiscussionDone] = useState(false);

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

  // Ref so the timer interval can call the latest version of handleSubmit
  const autoSubmitRef = useRef<(() => void) | null>(null);

  // Timer countdown
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(id);
          autoSubmitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer]);

  // Callback registered by RankingPhase/GuessingPhase so we can auto-submit on timeout
  const handleTimeUp = useCallback((getRanked: () => string[]) => {
    autoSubmitRef.current = () => {
      const ranked = getRanked();
      if (phase === 'ranking') {
        connection.invoke('SubmitRanking', sessionCode, ranked).catch(console.error);
        setPhase('guessing');
      } else if (phase === 'guessing') {
        if (targetInfo) {
          connection.invoke('SubmitGuess', sessionCode, targetInfo.targetId, ranked).catch(console.error);
        }
      }
    };
  }, [phase, connection, sessionCode, targetInfo]);

  useEffect(() => {
    connection.on('SessionUpdated', (s: Session) => {
      setPlayers(s.players);
      setHostPlayerId(s.hostPlayerId);
      if (s.maxRounds) setMaxRounds(s.maxRounds);
    });

    connection.on('RoundStarted', (round: Round) => {
      setCurrentRound(round);
      setRoundNum(round.roundNum);
      setPhase('ranking');
      setTimer(60);
      // Resolve our target from pairings
      const myId = connection.connectionId;
      if (myId && round.pairings) {
        const targetId = round.pairings[myId];
        if (targetId) {
          const targetPlayer = players.find(p => p.playerId === targetId);
          const isTriple = !!round.triple;
          let cycleInfo: string | undefined;
          if (isTriple && round.triple) {
            const idx = round.triple.indexOf(myId);
            const targetIdx = round.triple.indexOf(targetId);
            const targetName = targetPlayer?.name ?? targetId;
            cycleInfo = `You are in a guessing cycle. You guess ${targetName}.`;
            void cycleInfo;
            cycleInfo = `Triple round — you guess ${targetName}'s ranking.`;
            void idx; void targetIdx;
          }
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
      setLastResult(result);
      setTimer(0);
      autoSubmitRef.current = null;
      setDiscussionActive(false); // wait for partner before starting discussion timer
      setPhase('results');
    });

    connection.on('LeaderboardUpdate', (lb: Player[]) => {
      // Don't change phase — store the data and start the discussion timer.
      // ResultsPhase transitions to leaderboard after the discussion period ends.
      setPendingLeaderboard(lb);
      setDiscussionActive(true);
    });

    connection.on('GameOver', (finalStandings: Player[]) => {
      // Route through discussion pipeline same as LeaderboardUpdate —
      // pendingIsFinal ensures we land on 'gameover' instead of 'leaderboard'.
      setPendingLeaderboard(finalStandings);
      setPendingIsFinal(true);
      setDiscussionActive(true);
    });

    connection.on('Error', (msg: string) => {
      setServerError(msg);
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
  }, [connection, players, sessionCode]);

  const handleSubmitRanking = (ranked: string[]) => {
    connection.invoke('SubmitRanking', sessionCode, ranked).catch(console.error);
    setPhase('guessing');
    setTimer(60);
  };

  const handleSubmitGuess = (guessed: string[]) => {
    if (!targetInfo) return;
    connection.invoke('SubmitGuess', sessionCode, targetInfo.targetId, guessed).catch(console.error);
    setTimer(0);
  };

  const handleStartRound = () => {
    // Pass selectedRounds on every call — backend only applies it on round 1.
    connection.invoke('StartNewRound', sessionCode, isDebug, selectedRounds).catch(console.error);
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
          {isDebug && <p className="text-yellow-400 text-sm mb-2">Debug mode — 2-player minimum</p>}

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
                  ~{selectedRounds * 5}–{selectedRounds * 7} minutes of play
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

      {/* Round counter — shown during active gameplay and leaderboard */}
      {roundNum > 0 && phase !== 'lobby' && phase !== 'gameover' && (
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