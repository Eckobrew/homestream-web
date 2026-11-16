import HomeApp from '@/components/HomeApp';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const metadata = buildSectionMetadata(
  'Discover',
  'Discover trending movies and TV shows to stream or request on HomeStream.',
  '/discover'
);

export default function DiscoverPage() {
  return <HomeApp initialTab="discover" />;
}
