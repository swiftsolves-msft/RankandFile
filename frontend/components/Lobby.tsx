'use client';

import { useState } from 'react';

export default function Lobby({
  onCreate,
  onJoin,
  isConnected,
}: {
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  isConnected: boolean;
}) {
  const [playerName, setPlayerName] = useState('');
  const [sessionCode, setSessionCode] = useState('');

  const canAct = isConnected && playerName.trim().length > 0;

  return (
    <div className="max-w-md mx-auto bg-zinc-900 rounded-3xl p-8 border border-neon/30">
      <h2 className="text-3xl font-bold mb-8 text-center">
        <span className="text-neon">HOST</span>
        <span className="text-zinc-400"> or </span>
        <span className="text-cyber">JOIN</span>
      </h2>

      {!isConnected && (
        <p className="text-zinc-400 text-center mb-4 text-sm">Connecting to server…</p>
      )}

      <input
        type="text"
        placeholder="Your name (e.g. Nathan)"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-4 mb-6 text-lg focus:border-neon outline-none"
        maxLength={32}
      />

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => canAct && onCreate(playerName.trim())}
          disabled={!canAct}
          className="py-6 bg-neon text-black font-bold text-xl rounded-2xl hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          HOST
        </button>

        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="6-CHAR CODE"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-lg focus:border-cyber outline-none tracking-widest"
          />
          <button
            onClick={() => canAct && sessionCode.length === 6 && onJoin(sessionCode, playerName.trim())}
            disabled={!canAct || sessionCode.length !== 6}
            className="py-3 bg-cyber text-black font-bold text-lg rounded-xl hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            JOIN
          </button>
        </div>
      </div>
    </div>
  );
}