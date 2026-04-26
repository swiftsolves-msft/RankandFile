import { useEffect, useState } from 'react';

// Type-only import — the runtime module is loaded dynamically inside useEffect
// so @microsoft/signalr never enters the server-side static module graph during SSG.
type HubConnectionType = import('@microsoft/signalr').HubConnection;

export function useSignalR() {
  const [connection, setConnection] = useState<HubConnectionType | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hubUrl = process.env.NEXT_PUBLIC_HUB_URL;
    if (!hubUrl) {
      setError('Hub URL not configured. Set NEXT_PUBLIC_HUB_URL.');
      return;
    }

    let hub: HubConnectionType;

    import('@microsoft/signalr').then(({ HubConnectionBuilder }) => {
      hub = new HubConnectionBuilder()
        .withUrl(hubUrl)
        .withAutomaticReconnect()
        .build();

      hub.start()
        .then(() => {
          setIsConnected(true);
          setConnection(hub);
        })
        .catch((err: Error) => {
          setError(`Failed to connect to game server: ${err.message}`);
        });
    });

    return () => { hub?.stop(); };
  }, []);

  return { connection, isConnected, error };
}