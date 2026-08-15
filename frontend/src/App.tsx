import { useEffect, useRef, useState } from 'react';
import Lobby from '../components/Lobby';
import GameScreen from '../components/GameScreen';
import PresenterView from '../components/PresenterView';
import { useSignalR } from '../lib/signalr';
import { setInSession } from '../lib/tabGuard';
import { isPresenterView } from '../lib/presenter';
import { getPrefilledJoinCode } from '../lib/joinLink';
import { getPlayerId } from '../lib/playerId';
import { Session } from '../lib/types';

export default function App() {
  // Presenter (screen-share) popup: render the looping instructions only — no
  // game connection. Kept in a separate component so the game hooks in GameApp
  // never mount in the popup window.
  if (isPresenterView()) return <PresenterView />;
  return <GameApp />;
}

function GameApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [invokeError, setInvokeError] = useState<string | null>(null);
  const { connection, isConnected, error } = useSignalR();

  // What to re-send if the transport drops. SignalR reconnects with a *new*
  // connection id, so the server can no longer tell who we are until we
  // re-announce ourselves against our durable player id.
  const rejoinRef = useRef<{ code: string; name: string } | null>(null);

  // Tell the cross-tab guard whether this tab currently occupies a session, so
  // other tabs in the same browser are blocked from joining a second time.
  useEffect(() => {
    setInSession(session !== null);
    return () => setInSession(false);
  }, [session]);

  useEffect(() => {
    if (!connection) return;
    connection.on('SessionUpdated', (s: Session) => {
      setInvokeError(null); // clear any lobby-phase error once we're in a session
      setSession(s);
      // Remember what it takes to re-announce ourselves after a reconnect.
      const me = s.players.find(p => p.playerId === getPlayerId());
      if (me) rejoinRef.current = { code: s.sessionCode, name: me.name };
    });
    // Listen for server-sent Error events before a session is established
    // (e.g. CreateSession / JoinSession failures).
    connection.on('Error', (msg: string) => {
      setInvokeError(msg);
    });
    return () => {
      connection.off('SessionUpdated');
      connection.off('Error');
    };
  }, [connection]);

  // Re-announce ourselves when the transport comes back, so the server can
  // reattach this new connection to the existing player — restoring the score,
  // any ranking already submitted, and the head-count the round is waiting on.
  useEffect(() => {
    if (!connection) return;
    connection.onreconnected(() => {
      const rejoin = rejoinRef.current;
      if (!rejoin) return;
      connection
        .invoke('JoinSession', rejoin.code, rejoin.name, getPlayerId())
        .catch((err: Error) => setInvokeError(`Could not rejoin: ${err.message}`));
    });
  }, [connection]);

  const handleCreate = (name: string) => {
    if (!connection) return;
    setInvokeError(null);
    connection.invoke('CreateSession', name, getPlayerId()).catch((err: Error) => {
      setInvokeError(`Could not create session: ${err.message}`);
    });
  };

  const handleJoin = (code: string, name: string) => {
    if (!connection) return;
    setInvokeError(null);
    connection.invoke('JoinSession', code, name, getPlayerId()).catch((err: Error) => {
      setInvokeError(`Could not join session: ${err.message}`);
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-6xl font-bold text-center mb-8 tracking-tighter">
        <span className="text-neon">RANK</span> &amp; <span className="text-cyber">FILE</span>
      </h1>
      <p className="text-center text-zinc-400 mb-12">Cybersecurity Icebreaker • 2+ Players</p>

      {/* Connection-level or pre-session invoke errors — shown in lobby only */}
      {(error || (!session && invokeError)) && (
        <div className="bg-red-900 border border-red-500 rounded-xl px-6 py-4 text-red-200 mb-8 text-center">
          {error || invokeError}
        </div>
      )}

      {!session ? (
        <Lobby
          onCreate={handleCreate}
          onJoin={handleJoin}
          isConnected={isConnected}
          initialCode={getPrefilledJoinCode() ?? ''}
        />
      ) : (
        connection && (
          <GameScreen
            session={session}
            connection={connection}
          />
        )
      )}
    </div>
  );
}
