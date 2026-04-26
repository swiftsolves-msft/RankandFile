// This file overrides Next.js's built-in _error page, which imports <Html> from
// next/document and causes "should not be imported outside of pages/_document"
// during static export (output: 'export'). A minimal component here avoids that.
// The App Router's app/not-found.tsx provides the actual 404 UI at runtime.
export default function Error() {
  return null;
}
