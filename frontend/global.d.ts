// Allow TypeScript to resolve CSS file side-effect imports.
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
