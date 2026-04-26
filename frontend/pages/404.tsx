// Explicit Pages Router 404 — prevents Next.js from falling back to its built-in
// _error component (which imports <Html> outside of _document and breaks static export).
// The actual 404 UI is handled by app/not-found.tsx in the App Router.
export default function Custom404() {
  return null;
}
