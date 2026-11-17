import { Metadata } from 'next';
import HomeApp from '@/components/HomeApp';
import { buildMediaMetadata, fetchMediaSeoJsonLd } from '@/lib/seo-metadata';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildMediaMetadata((await params).id, 'detail', 'tvshows');
}

export default async function TvShowDetailPage({ params }: PageProps) {
  const { id } = await params;
  const jsonLd = await fetchMediaSeoJsonLd(id, 'TV Shows');
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
      <HomeApp initialTab="series" initialMediaId={id} />
    </>
  );
}
