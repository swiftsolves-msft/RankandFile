// Allow TypeScript to resolve CSS file side-effect imports used by Next.js App Router.
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
