import HomeApp from '@/components/HomeApp';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const metadata = buildSectionMetadata(
  'Music',
  'Stream albums, artists, songs, and playlists on HomeStream.',
  '/music'
);

export default function MusicPage() {
  return <HomeApp initialTab="music" />;
}
