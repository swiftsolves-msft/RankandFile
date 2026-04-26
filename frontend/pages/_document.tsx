import { Html, Head, Main, NextScript } from 'next/document';

// Required by Next.js Pages Router when any pages/ files exist.
// This is the ONLY correct place to import <Html> from next/document.
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
