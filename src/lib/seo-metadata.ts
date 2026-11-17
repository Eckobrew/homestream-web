import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { MediaItem } from '@/types';

const FALLBACK_URL = 'https://homeflix.eckonet.uk';

export function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || FALLBACK_URL).replace(/\/+$/, '');
}

function resolveAbsoluteUrl(base: string, pathOrUrl: string): string {
  return pathOrUrl.startsWith('http') ? pathOrUrl : `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

async function fetchMediaItemForSeo(id: string): Promise<MediaItem | null> {
  try {
    const incoming = await headers();
    const cookie = incoming.get('cookie') || '';
    if (!cookie.includes('homeflix_session=')) return null;
    const backend = process.env.HOMESTREAM_BACKEND_URL || 'http://127.0.0.1:3001';
    const res = await fetch(`${backend}/api/v1/media/${encodeURIComponent(id)}`, {
      headers: { cookie, 'x-forwarded-for': '0.0.0.0' },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { item?: MediaItem };
    return data.item || null;
  } catch {
    return null;
  }
}

export function buildSectionMetadata(
  title: string,
  description: string,
  canonicalPath: string
): Metadata {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'HomeStream';
  const base = siteBaseUrl();
  const url = `${base}${canonicalPath}`;
  const fullTitle = `${title} · ${appName}`;
  const defaultOgImage = `${base}/opengraph-image`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: appName,
      type: 'website',
      images: [{ url: defaultOgImage, width: 1200, height: 630, alt: fullTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [defaultOgImage],
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

  const item = await fetchMediaItemForSeo(id);
  if (item) {
    const action = mode === 'play' ? 'Watch ' : '';
    const title = `${action}${item.title}${item.year ? ` (${item.year})` : ''} · ${appName}`;
    const description = item.overview || `Stream ${item.title} on ${appName}.`;
    const image = item.backdropUrl || item.posterUrl;
    const resolvedImage = image ? resolveAbsoluteUrl(base, image) : `${base}/opengraph-image`;
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        siteName: appName,
        type: item.type === 'Series' ? 'video.tv_show' : 'video.movie',
        images: [{ url: resolvedImage, ...(image ? {} : { width: 1200, height: 630 }), alt: item.title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [resolvedImage],
      },
    };
  }

  const label = mode === 'play' ? 'Watch' : 'Explore';
  const kindLabel = section === 'tvshows' ? 'TV Shows' : section === 'movies' ? 'Movies' : 'Media';
  return buildSectionMetadata(
    `${label} ${kindLabel}`,
    `Stream ${kindLabel.toLowerCase()} on ${appName}.`,
    canonicalPath
  );
}

export async function fetchMediaSeoJsonLd(
  id: string,
  section: 'Media' | 'Movies' | 'TV Shows'
): Promise<Record<string, unknown> | null> {
  const item = await fetchMediaItemForSeo(id);
  if (!item) return null;

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'HomeStream';
  const base = siteBaseUrl();
  const prefix = section === 'Movies' ? 'movies' : section === 'TV Shows' ? 'tvshows' : 'media';
  const url = `${base}/${prefix}/${encodeURIComponent(id)}`;
  const rawImage = item.backdropUrl || item.posterUrl;
  const image = rawImage ? resolveAbsoluteUrl(base, rawImage) : `${base}/opengraph-image`;
  const ratingValue = typeof item.communityRating === 'number' && item.communityRating > 0
    ? Number(item.communityRating.toFixed(1))
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': item.type === 'Series' ? 'TVSeries' : 'Movie',
    name: item.title,
    description: item.overview || `Stream ${item.title} on ${appName}.`,
    url,
    image,
    ...(item.releaseDate || item.year ? { datePublished: item.releaseDate || String(item.year) } : {}),
    ...(item.genres?.length ? { genre: item.genres } : {}),
    ...(item.rating ? { contentRating: item.rating } : {}),
    ...(ratingValue ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue,
        bestRating: 10,
        worstRating: 1,
      },
    } : {}),
  };
}
