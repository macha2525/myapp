import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Life App',
  description: '生活を、少しだけ整えるためのアプリ。',
  icons: { apple: '/pwa-icon?size=180' },
  appleWebApp: { capable: true, title: 'Life App', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#2b2e36',
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
      </head>
      <body>{children}</body>
    </html>
  );
}