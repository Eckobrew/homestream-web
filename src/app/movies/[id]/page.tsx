import { Metadata } from 'next';
import HomeApp from '@/components/HomeApp';
import { buildMediaMetadata, fetchMediaSeoJsonLd } from '@/lib/seo-metadata';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildMediaMetadata((await params).id, 'detail', 'movies');
}

export default async function MovieDetailPage({ params }: PageProps) {
  const { id } = await params;
  const jsonLd = await fetchMediaSeoJsonLd(id, 'Movies');
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
      <HomeApp initialTab="movies" initialMediaId={id} />
    </>
  );
}
