import { useEffect, useState } from 'react';
import Lobby from '../components/Lobby';
import GameScreen from '../components/GameScreen';
import { useSignalR } from '../lib/signalr';
import { Session } from '../lib/types';

export default function App() {
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const { connection, isConnected, error } = useSignalR();

  useEffect(() => {
    if (!connection) return;
    connection.on('SessionUpdated', (session: Session) => {
      if (!sessionCode) {
        setSessionCode(session.sessionCode);
      }
    });
    return () => {
      connection.off('SessionUpdated');
    };
  }, [connection, sessionCode]);

  const handleCreate = (name: string) => {
    if (!connection) return;
    connection.invoke('CreateSession', name).catch(console.error);
  };

  const handleJoin = (code: string, name: string) => {
    if (!connection) return;
    connection.invoke('JoinSession', code, name).catch(console.error);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-6xl font-bold text-center mb-8 tracking-tighter">
        <span className="text-neon">RANK</span> &amp; <span className="text-cyber">FILE</span>
      </h1>
      <p className="text-center text-zinc-400 mb-12">Cybersecurity Icebreaker • 6–60 players</p>

      {error && (
        <div className="bg-red-900 border border-red-500 rounded-xl px-6 py-4 text-red-200 mb-8 text-center">
          {error}
        </div>
      )}

      {!sessionCode ? (
        <Lobby
          onCreate={handleCreate}
          onJoin={handleJoin}
          isConnected={isConnected}
        />
      ) : (
        connection && (
          <GameScreen
            sessionCode={sessionCode}
            connection={connection}
          />
        )
      )}
    </div>
  );
}