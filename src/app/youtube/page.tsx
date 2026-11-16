import HomeApp from '@/components/HomeApp';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const metadata = buildSectionMetadata(
  'YouTube',
  'Watch and subscribe to YouTube channels on HomeStream.',
  '/youtube'
);

export default function YouTubePage() {
  return <HomeApp initialTab="youtube" />;
}
