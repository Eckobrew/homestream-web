import { Metadata } from 'next';
import HomeApp from '@/components/HomeApp';
import { buildMediaMetadata, fetchMediaSeoJsonLd } from '@/lib/seo-metadata';

interface MediaPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: MediaPageProps): Promise<Metadata> {
  return buildMediaMetadata((await params).id, 'detail', 'media');
}

export default async function MediaPage({ params }: MediaPageProps) {
  const { id } = await params;
  const jsonLd = await fetchMediaSeoJsonLd(id, 'Media');
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
      <HomeApp initialMediaId={id} />
    </>
  );
}
