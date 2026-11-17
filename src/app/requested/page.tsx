import HomeApp from '@/components/HomeApp';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const metadata = {
  ...buildSectionMetadata('Requested', 'Track requested media on HomeStream.', '/requested'),
  robots: { index: false, follow: false },
};

export default function RequestedPage() {
  return <HomeApp initialTab="requested" />;
}
