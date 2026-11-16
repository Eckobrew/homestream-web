import type { MediaItem } from '@/types';

const TAB_TO_PATH: Record<string, string> = {
  home: '/',
  series: '/tvshows',
  movies: '/movies',
  music: '/music',
  youtube: '/youtube',
  books: '/books',
  discover: '/discover',
  requests: '/discover',
  requested: '/requested',
  downloads: '/downloads',
  admin: '/admin',
};

export function tabToPath(tab: string): string {
  return TAB_TO_PATH[tab] || '/';
}

export function mediaSection(item: Pick<MediaItem, 'type'>): 'tvshows' | 'movies' {
  return item.type === 'Series' || item.type === 'Episode' ? 'tvshows' : 'movies';
}

export function mediaDetailPath(item: Pick<MediaItem, 'id' | 'type'>): string {
  return `/${mediaSection(item)}/${encodeURIComponent(item.id)}`;
}

export function mediaPlayPath(item: Pick<MediaItem, 'id' | 'type'>): string {
  return `/${mediaSection(item)}/play/${encodeURIComponent(item.id)}`;
}

export interface ParsedCleanRoute {
  tab?: string;
  mediaId?: string;
  watchId?: string;
}

export function parseCleanRoute(pathname: string): ParsedCleanRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const playMatch = /^\/(?:tvshows|movies)\/play\/([^/]+)$/.exec(clean);
  if (playMatch) {
    return { watchId: decodeURIComponent(playMatch[1]) };
  }
  const detailMatch = /^\/(?:tvshows|movies|media)\/([^/]+)$/.exec(clean);
  if (detailMatch) {
    return { mediaId: decodeURIComponent(detailMatch[1]) };
  }
  const pathToTab: Record<string, string> = {
    '/': 'home',
    '/tvshows': 'series',
    '/movies': 'movies',
    '/music': 'music',
    '/youtube': 'youtube',
    '/books': 'books',
    '/discover': 'discover',
    '/requested': 'requested',
    '/downloads': 'downloads',
    '/admin': 'admin',
  };
  if (pathToTab[clean]) {
    return { tab: pathToTab[clean] };
  }
  return {};
}
