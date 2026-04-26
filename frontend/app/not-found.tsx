export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-6xl font-bold text-neon font-mono">404</h1>
      <p className="text-zinc-400 mt-4">Page not found</p>
      <a href="/" className="mt-8 text-cyber underline">Back to game</a>
    </div>
  );
}
