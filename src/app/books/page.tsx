import HomeApp from '@/components/HomeApp';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const metadata = buildSectionMetadata(
  'Books',
  'Read and browse your digital books on HomeStream.',
  '/books'
);

export default function BooksPage() {
  return <HomeApp initialTab="books" />;
}
