import HomeApp from '@/components/HomeApp';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const metadata = buildSectionMetadata('Admin', 'Server integrations and settings on HomeStream.', '/admin');

export default function AdminPage() {
  return <HomeApp initialTab="admin" />;
}
