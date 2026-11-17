import { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import type { MediaItem } from '@/types';
import { mediaDetailPath, mediaPlayPath } from '@/lib/seo-routes';
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://homeflix.eckonet.uk').replace(/\/+$/, '');
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}`, lastModified, changeFrequency: 'daily', priority: 1.0 },
    { url: `${siteUrl}/movies`, lastModified, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/tvshows`, lastModified, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/music`, lastModified, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/youtube`, lastModified, changeFrequency: 'daily', priority: 0.7 },
    { url: `${siteUrl}/books`, lastModified, changeFrequency: 'daily', priority: 0.7 },
    { url: `${siteUrl}/discover`, lastModified, changeFrequency: 'daily', priority: 0.8 },
  ];

  try {
    const incoming = await headers();
    // A background metadata request must never gain access from the web server's LAN identity.
    const cookie = incoming.get('cookie') || '';
    if (cookie.includes('homeflix_session=')) {
      const response = await fetch(`${process.env.HOMESTREAM_BACKEND_URL || 'http://127.0.0.1:3001'}/api/v1/catalog-links`, {
        headers: { cookie, 'x-forwarded-for': '0.0.0.0' }, cache: 'no-store', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return staticRoutes;
      const { items } = await response.json() as { items: MediaItem[] };
      const mediaRoutes: MetadataRoute.Sitemap = items.flatMap((item) => [
        {
          url: `${siteUrl}${mediaDetailPath(item)}`,
          lastModified,
          changeFrequency: 'weekly',
          priority: 0.8,
        },
        {
          url: `${siteUrl}${mediaPlayPath(item)}`,
          lastModified,
          changeFrequency: 'weekly',
          priority: 0.7,
        },
      ]);

      return [...staticRoutes, ...mediaRoutes];
    }
  } catch (err) {
    console.error('Error generating dynamic sitemap:', err);
  }

  return staticRoutes;
}
