import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import { useEffect, useState } from 'react';

export function useSignalR() {
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hubUrl = process.env.NEXT_PUBLIC_HUB_URL;
    if (!hubUrl) {
      setError('Hub URL not configured. Set NEXT_PUBLIC_HUB_URL.');
      return;
    }

    const hub = new HubConnectionBuilder()
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

    return () => { hub.stop(); };
  }, []);

  return { connection, isConnected, error };
}