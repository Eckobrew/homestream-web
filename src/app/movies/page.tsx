import HomeApp from '@/components/HomeApp';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const metadata = buildSectionMetadata(
  'Movies',
  'Browse and stream your movie collection on HomeStream.',
  '/movies'
);

export default function MoviesPage() {
  return <HomeApp initialTab="movies" />;
}
