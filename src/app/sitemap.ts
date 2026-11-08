import { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import type { MediaItem } from '@/types';
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}`,
      lastModified,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${siteUrl}/?tab=movies`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/?tab=series`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/?tab=requests`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.7,
    },
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
      const mediaRoutes: MetadataRoute.Sitemap = items.map((item) => ({
        url: `${siteUrl}/media/${item.id}`,
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.8,
      }));

      return [...staticRoutes, ...mediaRoutes];
    }
  } catch (err) {
    console.error('Error generating dynamic sitemap from Jellyfin:', err);
  }

  return staticRoutes;
}
