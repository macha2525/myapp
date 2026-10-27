import './globals.css';

export const metadata = {
  title: 'Life App',
  description: '生活を便利にする個人用アプリ',
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