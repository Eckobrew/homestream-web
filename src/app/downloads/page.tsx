import HomeApp from '@/components/HomeApp';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const metadata = buildSectionMetadata('Downloads', 'Manage active downloads on HomeStream.', '/downloads');

export default function DownloadsPage() {
  return <HomeApp initialTab="downloads" />;
}
