'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnection } from '@microsoft/signalr';
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
  sessionCode,
  connection,
}: {
  sessionCode: string;
  connection: HubConnection;
}) {
  const [phase, setPhase] = useState<'lobby' | 'ranking' | 'guessing' | 'results' | 'leaderboard' | 'gameover'>('lobby');
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [targetInfo, setTargetInfo] = useState<TargetInfo | null>(null);
  const [lastResult, setLastResult] = useState<GuessResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [timer, setTimer] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

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
    connection.on('SessionUpdated', (session: Session) => {
      setPlayers(session.players);
    });

    connection.on('RoundStarted', (round: Round) => {
      setCurrentRound(round);
      setPhase('ranking');
      setTimer(30);
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
      setTimer(45);
      setPhase('guessing');
    });

    connection.on('GuessResult', (result: GuessResult) => {
      setLastResult(result);
      setTimer(0);
      setPhase('results');
    });

    connection.on('LeaderboardUpdate', (lb: Player[]) => {
      setLeaderboard(lb);
      setPhase('leaderboard');
    });

    connection.on('GameOver', (finalStandings: Player[]) => {
      setLeaderboard(finalStandings);
      setPhase('gameover');
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
    setTimer(45);
  };

  const handleSubmitGuess = (guessed: string[]) => {
    if (!targetInfo) return;
    connection.invoke('SubmitGuess', sessionCode, targetInfo.targetId, guessed).catch(console.error);
    setTimer(0);
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
          <p>Waiting for host to start the round…</p>
          <div className="mt-6 space-y-2">
            {players.map(p => (
              <div key={p.playerId} className="text-white">{p.name}</div>
            ))}
          </div>
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

      {phase === 'results' && lastResult && <ResultsPhase result={lastResult} />}

      {(phase === 'leaderboard' || phase === 'gameover') && (
        <Leaderboard players={leaderboard} isFinal={phase === 'gameover'} />
      )}

      {timer > 0 && <Timer seconds={timer} color={timer <= 10 ? 'red-400' : 'neon'} />}
    </div>
  );
}