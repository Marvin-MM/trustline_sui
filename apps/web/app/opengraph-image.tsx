import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 72,
          background: 'linear-gradient(135deg, #1f1147 0%, #5f2eea 55%, #0f172a 100%)',
          color: 'white',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 0 }}>BondFlow</div>
        <div style={{ marginTop: 44, fontSize: 72, fontWeight: 800, lineHeight: 1.04, maxWidth: 900 }}>
          Payments are relationships, not transfers.
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: 'rgba(255,255,255,0.78)', maxWidth: 840 }}>
          Programmable payment relationships on Sui with AI verification, memory, and reputation.
        </div>
      </div>
    ),
    size,
  );
}
