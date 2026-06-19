'use client';

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
            <h1>Fatal error</h1>
            <p>Please refresh BondFlow to continue.</p>
          </div>
        </main>
      </body>
    </html>
  );
}
