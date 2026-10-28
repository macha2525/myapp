import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Life App',
    short_name: 'Life',
    description: '生活を、少しだけ整えるためのアプリ。',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f6f5f2',
    theme_color: '#2b2e36',
    icons: [
      { src: '/pwa-icon?size=192', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-icon?size=512', sizes: '512x512', type: 'image/png' },
    ],
  };
}