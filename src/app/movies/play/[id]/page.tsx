import { Metadata } from 'next';
import HomeApp from '@/components/HomeApp';
import { buildMediaMetadata } from '@/lib/seo-metadata';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildMediaMetadata((await params).id, 'play', 'movies');
}

export default async function MoviePlayPage({ params }: PageProps) {
  return <HomeApp initialTab="movies" initialWatchId={(await params).id} />;
}
