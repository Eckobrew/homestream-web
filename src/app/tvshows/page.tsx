import HomeApp from '@/components/HomeApp';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const metadata = buildSectionMetadata(
  'TV Shows',
  'Browse and stream TV series and episodes on HomeStream.',
  '/tvshows'
);

export default function TvShowsPage() {
  return <HomeApp initialTab="series" />;
}
