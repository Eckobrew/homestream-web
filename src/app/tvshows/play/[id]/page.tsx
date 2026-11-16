import { Metadata } from 'next';
import HomeApp from '@/components/HomeApp';
import { buildMediaMetadata } from '@/lib/seo-metadata';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildMediaMetadata((await params).id, 'play', 'tvshows');
}

export default async function TvShowPlayPage({ params }: PageProps) {
  return <HomeApp initialTab="series" initialWatchId={(await params).id} />;
}
