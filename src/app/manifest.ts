import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'HomeStream';

  return {
    name: appName,
    short_name: appName,
    description:
      'Self-hosted streaming hub for movies, TV shows, music, eBooks, and YouTube archives with multi-profile continue watching and Chromecast.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#e50914',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
