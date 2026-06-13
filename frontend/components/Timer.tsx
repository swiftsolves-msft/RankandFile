export default function Timer({ seconds, color = 'neon' }: { seconds: number; color?: string }) {
  const isUrgent = color === 'red-400';
  return (
    <div className="flex justify-center mb-4">
      <div className={`rounded-2xl px-10 py-4 text-center border-2 ${
        isUrgent
          ? 'bg-red-950/40 border-red-400/60'
          : 'bg-zinc-900 border-neon/40'
      }`}>
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Time Remaining</p>
        <div className={`text-5xl font-mono font-bold text-${color}`}>
          {seconds}s
        </div>
      </div>
    </div>
  );
}