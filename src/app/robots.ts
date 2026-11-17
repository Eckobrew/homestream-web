import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://homeflix.eckonet.uk';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/rest/', '/admin', '/first-start', '/downloads', '/tv/login', '/tv/logout'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
