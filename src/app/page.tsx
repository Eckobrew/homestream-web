import HomeApp from '@/components/HomeApp';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const metadata = buildSectionMetadata(
  'Home',
  'Your personal cinema, TV shows, music, and media library.',
  '/'
);

export default function HomePage() {
  return <HomeApp />;
}
