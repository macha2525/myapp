import type { Metadata, Viewport } from 'next';
import './globals.css';

const FONTS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500' +
  '&family=IBM+Plex+Mono:wght@400;500' +
  '&family=Shippori+Mincho:wght@400;500;600' +
  '&family=Zen+Kaku+Gothic+New:wght@400;500;700' +
  '&display=swap';

export const metadata: Metadata = {
  title: 'Life App',
  description: '生活を、少しだけ整えるためのアプリ。',
  icons: { apple: '/pwa-icon?size=180' },
  appleWebApp: { capable: true, title: 'Life App', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#2b2e36',
  viewportFit: 'cover',
};

const themeScript = `
(function () {
  try {
    var mode = localStorage.getItem('theme-mode') || 'system';
    var accent = localStorage.getItem('theme-accent') || 'slate';
    var dark = mode === 'dark' ||
      (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    var el = document.documentElement;
    el.classList.toggle('dark', dark);
    el.dataset.accent = accent;
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}