import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const appName = process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || 'HomeStream';

  return {
    id: '/',
    name: appName,
    short_name: appName,
    description:
      'Self-hosted streaming hub for movies, TV shows, music, eBooks, and YouTube archives with multi-profile continue watching and Chromecast.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#141414',
    theme_color: '#141414',
    categories: ['entertainment', 'multimedia'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Movies',
        short_name: 'Movies',
        url: '/movies',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'TV Shows',
        short_name: 'TV Shows',
        url: '/tvshows',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Music',
        short_name: 'Music',
        url: '/music',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Discover',
        short_name: 'Discover',
        url: '/discover',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
