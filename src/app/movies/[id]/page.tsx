import { Metadata } from 'next';
import HomeApp from '@/components/HomeApp';
import { buildMediaMetadata } from '@/lib/seo-metadata';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildMediaMetadata((await params).id, 'detail', 'movies');
}

export default async function MovieDetailPage({ params }: PageProps) {
  return <HomeApp initialTab="movies" initialMediaId={(await params).id} />;
}
