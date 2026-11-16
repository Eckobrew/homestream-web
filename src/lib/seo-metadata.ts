import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { MediaItem } from '@/types';

const FALLBACK_URL = 'https://homeflix.eckonet.uk';

export function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || FALLBACK_URL).replace(/\/+$/, '');
}

export function buildSectionMetadata(
  title: string,
  description: string,
  canonicalPath: string
): Metadata {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'HomeStream';
  const base = siteBaseUrl();
  const url = `${base}${canonicalPath}`;
  return {
    title: `${title} · ${appName}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · ${appName}`,
      description,
      url,
      siteName: appName,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · ${appName}`,
      description,
    },
  };
}

export async function buildMediaMetadata(
  id: string,
  mode: 'detail' | 'play',
  section: 'movies' | 'tvshows' | 'media'
): Promise<Metadata> {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'HomeStream';
  const base = siteBaseUrl();
  const canonicalPath = mode === 'play'
    ? `/${section === 'media' ? 'movies' : section}/play/${encodeURIComponent(id)}`
    : `/${section}/${encodeURIComponent(id)}`;
  const url = `${base}${canonicalPath}`;

  try {
    const incoming = await headers();
    const cookie = incoming.get('cookie') || '';
    if (cookie.includes('homeflix_session=')) {
      const backend = process.env.HOMESTREAM_BACKEND_URL || 'http://127.0.0.1:3001';
      const res = await fetch(`${backend}/api/v1/media/${encodeURIComponent(id)}`, {
        headers: { cookie, 'x-forwarded-for': '0.0.0.0' },
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = (await res.json()) as { item?: MediaItem };
        const item = data.item;
        if (item) {
          const action = mode === 'play' ? 'Watch' : '';
          const title = `${action ? `${action} ` : ''}${item.title}${item.year ? ` (${item.year})` : ''} · ${appName}`;
          const description = item.overview || `Stream ${item.title} on ${appName}.`;
          const image = item.backdropUrl || item.posterUrl;
          return {
            title,
            description,
            alternates: { canonical: url },
            openGraph: {
              title,
              description,
              url,
              siteName: appName,
              type: item.type === 'Series' ? 'video.tv_show' : 'video.movie',
              ...(image ? { images: [{ url: image.startsWith('http') ? image : `${base}${image}` }] } : {}),
            },
            twitter: {
              card: 'summary_large_image',
              title,
              description,
              ...(image ? { images: [image.startsWith('http') ? image : `${base}${image}`] } : {}),
            },
          };
        }
      }
    }
  } catch {
    // Fall back to generic metadata when backend or session is unavailable.
  }

  const label = mode === 'play' ? 'Watch' : 'Explore';
  const kindLabel = section === 'tvshows' ? 'TV Shows' : section === 'movies' ? 'Movies' : 'Media';
  return buildSectionMetadata(
    `${label} ${kindLabel}`,
    `Stream ${kindLabel.toLowerCase()} on ${appName}.`,
    canonicalPath
  );
}
