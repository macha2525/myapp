import { ImageResponse } from 'next/og';

export async function GET(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get('size'));
  const size = Math.min(Math.max(raw || 512, 64), 1024);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2b2e36',
          color: '#ececf0',
          fontSize: size * 0.55,
          fontWeight: 700,
        }}
      >
        L
      </div>
    ),
    { width: size, height: size }
  );
}