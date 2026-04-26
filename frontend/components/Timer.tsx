export default function Timer({ seconds, color = 'neon' }: { seconds: number; color?: string }) {
  return (
    <div className={`text-5xl font-mono font-bold text-${color} text-center mb-6`}>
      {seconds}s
    </div>
  );
}