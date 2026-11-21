import type { MediaItem } from '@/api/models';

type StreamTarget = Pick<MediaItem, 'id' | 'tmdbId' | 'type' | 'title'> & { seriesName?: string; seasonNumber?: number; episodeNumber?: number };
type EpisodeTarget = { seasonNumber?: number; episodeNumber?: number };

/** TMDB id for an item, from its explicit field or a `tmdb-` prefixed id. */
export function tmdbIdFor(item: Pick<MediaItem, 'id' | 'tmdbId'>): number | undefined {
  if (Number.isInteger(item.tmdbId) && Number(item.tmdbId) > 0) return Number(item.tmdbId);
  const match = /^tmdb-(?:movie-|tv-|ep-)?(\d+)(?:-\d+-\d+)?$/.exec(item.id || '');
  return match ? Number(match[1]) : undefined;
}

/**
 * Path of the in-process torrent stream for a title. The backend resolves the best
 * Radarr/Sonarr release itself and streams it from the swarm, so no qBittorrent
 * download is involved.
 */
export function torrentStreamUrl(item: StreamTarget, episode?: EpisodeTarget): string | undefined {
  const tmdbId = tmdbIdFor(item);
  if (!tmdbId) return undefined;
  const isTv = ['Series', 'Season', 'Episode'].includes(item.type);
  const query = new URLSearchParams({ tmdbId: String(tmdbId), type: isTv ? 'tv' : 'movie' });
  if (isTv) {
    query.set('season', String(episode?.seasonNumber || item.seasonNumber || 1));
    query.set('episode', String(episode?.episodeNumber || item.episodeNumber || 1));
    if (item.seriesName || item.title) query.set('title', item.seriesName || item.title);
  }
  return `/api/stream/torrent?${query}`;
}

export function isTorrentStreamUrl(url?: string): boolean {
  if (!url) return false;
  try { return /^\/api\/(?:v1\/|mobile\/v1\/)?stream\/torrent$/.test(new URL(url, 'http://homestream.invalid').pathname); }
  catch { return false; }
}

export function torrentStreamStartSeconds(url: string): number {
  const start = Number(new URL(url, 'http://homestream.invalid').searchParams.get('start') || 0);
  return Number.isFinite(start) ? Math.max(0, start) : 0;
}

export function seekTorrentStreamUrl(url: string, seconds: number): string {
  const target = new URL(url, 'http://homestream.invalid');
  target.searchParams.delete('startTimeTicks');
  target.searchParams.set('start', String(Number.isFinite(seconds) ? Math.max(0, seconds) : 0));
  return target.pathname + target.search;
}
