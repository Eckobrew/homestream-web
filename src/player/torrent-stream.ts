import type { MediaItem } from '@/api/models';

type StreamTarget = Pick<MediaItem, 'id' | 'tmdbId' | 'type' | 'title'>;
type EpisodeTarget = { seasonNumber?: number; episodeNumber?: number };

/** TMDB id for an item, from its explicit field or a `tmdb-`/`seerr-` prefixed id. */
export function tmdbIdFor(item: Pick<MediaItem, 'id' | 'tmdbId'>): number | undefined {
  if (Number.isInteger(item.tmdbId) && Number(item.tmdbId) > 0) return Number(item.tmdbId);
  const match = /^(?:tmdb|seerr)-(?:movie-|tv-|ep-)?(\d+)(?:-\d+-\d+)?$/.exec(item.id || '');
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
    query.set('season', String(episode?.seasonNumber || 1));
    query.set('episode', String(episode?.episodeNumber || 1));
    if (item.title) query.set('title', item.title);
  }
  return `/api/stream/torrent?${query}`;
}

export function isTorrentStreamUrl(url?: string): boolean {
  if (!url) return false;
  try { return /^\/api\/(?:v1\/|mobile\/v1\/)?stream\/torrent$/.test(new URL(url, 'http://homestream.invalid').pathname); }
  catch { return false; }
}
