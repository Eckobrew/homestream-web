import { Metadata } from 'next';
import HomeApp from '@/components/HomeApp';
import { buildMediaMetadata } from '@/lib/seo-metadata';

interface MediaPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: MediaPageProps): Promise<Metadata> {
  return buildMediaMetadata((await params).id, 'detail', 'media');
}

export default async function MediaPage({ params }: MediaPageProps) {
  return <HomeApp initialMediaId={(await params).id} />;
}
