import { cookies, headers } from 'next/headers';
import { MediaItem } from '@/types';

export function getBackendUrl(): string {
  return process.env.HOMESTREAM_BACKEND_URL || 'http://127.0.0.1:3001';
}

function isLocalOrTailscaleIp(ip: string): boolean {
  const clean = (ip || '').replace(/^::ffff:/i, '').split(',')[0].trim().toLowerCase();
  if (!clean) return false;
  if (clean === '::1' || clean === '127.0.0.1' || clean === 'localhost') return true;
  const parts = clean.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b] = parts;
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  return /^(fc|fd)/.test(clean) || /^fe[89ab]/.test(clean);
}

async function getForwardedHeaders(): Promise<Record<string, string>> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    return {
      Accept: 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    };
  } catch {
    return { Accept: 'application/json' };
  }
}

export async function fetchTvAuth(): Promise<{
  requiresAuth: boolean;
  isLocalOrTailscale: boolean;
  isAuthenticated: boolean;
  user?: { id: string; name: string };
  canManageIntegrations?: boolean;
}> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('homeflix_session')?.value;
    const headerList = await headers();
    const forwardedFor = headerList.get('x-forwarded-for') || '';
    const isLocal = isLocalOrTailscaleIp(forwardedFor);

    const hdrs: Record<string, string> = { Accept: 'application/json' };
    if (sessionCookie) hdrs.Cookie = `homeflix_session=${sessionCookie}`;

    const res = await fetch(`${getBackendUrl()}/api/v1/auth`, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (res.ok) {
      const data = await res.json();
      const hasAuth = Boolean(data.isAuthenticated && sessionCookie);
      return {
        requiresAuth: !isLocal && !hasAuth,
        isLocalOrTailscale: isLocal,
        isAuthenticated: isLocal || hasAuth,
        user: data.user,
        canManageIntegrations: isLocal || Boolean(data.canManageIntegrations),
      };
    }
    return {
      requiresAuth: !isLocal && !sessionCookie,
      isLocalOrTailscale: isLocal,
      isAuthenticated: isLocal || Boolean(sessionCookie),
    };
  } catch {
    return {
      requiresAuth: false,
      isLocalOrTailscale: true,
      isAuthenticated: true,
    };
  }
}

export async function fetchTvProfiles(): Promise<{
  profiles: Array<{ id: string; name: string; avatarColor?: string; avatarBg?: string; initials?: string }>;
  activeProfileId?: string;
  canSwitchProfile: boolean;
  isExternal: boolean;
}> {
  try {
    const hdrs = await getForwardedHeaders();
    const res = await fetch(`${getBackendUrl()}/api/v1/profiles?includeAvailable=true`, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (!res.ok) return { profiles: [], canSwitchProfile: false, isExternal: false };
    return await res.json();
  } catch {
    return { profiles: [], canSwitchProfile: false, isExternal: false };
  }
}

export async function fetchTvHome(): Promise<{
  hero?: MediaItem;
  continueWatching: MediaItem[];
  movies: MediaItem[];
  series: MediaItem[];
}> {
  try {
    const hdrs = await getForwardedHeaders();
    const res = await fetch(`${getBackendUrl()}/api/v1/home`, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const continueWatching: MediaItem[] =
      data.continueWatching ||
      data.sections?.find((s: any) => s.id === 'continue-watching')?.items ||
      [];
    let movies: MediaItem[] = (
      data.sections?.find((s: any) => s.id === 'recent-movies' || s.id === 'latest-movies')?.items || []
    ).slice(0, 18);
    let series: MediaItem[] = (
      data.sections?.find((s: any) => s.id === 'recent-series' || s.id === 'latest-series')?.items || []
    ).slice(0, 18);
    if (!movies.length && data.sections) {
      for (const sec of data.sections) {
        const found = (sec.items || []).filter((i: any) => i.type === 'Movie' || i.type === 'movie');
        if (found.length) { movies = found.slice(0, 18); break; }
      }
    }
    if (!series.length && data.sections) {
      for (const sec of data.sections) {
        const found = (sec.items || []).filter((i: any) => i.type === 'Series' || i.type === 'tv');
        if (found.length) { series = found.slice(0, 18); break; }
      }
    }
    const hero: MediaItem | undefined = data.heroItem || movies[0] || series[0];
    return { hero, continueWatching, movies, series };
  } catch {
    const [movies, series] = await Promise.all([
      fetchTvLibrary('movies'),
      fetchTvLibrary('tv'),
    ]);
    return {
      hero: movies[0] || series[0],
      continueWatching: [],
      movies: movies.slice(0, 18),
      series: series.slice(0, 18),
    };
  }
}

export async function fetchTvLibrary(type: 'movies' | 'tv'): Promise<MediaItem[]> {
  try {
    const hdrs = await getForwardedHeaders();
    const res = await fetch(`${getBackendUrl()}/api/v1/library/${type}`, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function fetchTvMedia(id: string): Promise<any | null> {
  try {
    const hdrs = await getForwardedHeaders();
    const res = await fetch(`${getBackendUrl()}/api/v1/media/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.item) {
      return {
        ...data.item,
        seasons: data.seasons || data.item.seasons,
        episodes: data.episodes || data.item.episodes || (data.seasons ? data.seasons.flatMap((s: any) => s.episodes || []) : []),
      };
    }
    return data;
  } catch {
    return null;
  }
}

export async function fetchTvPlayback(
  itemId: string,
  extra?: { tmdbId?: number; type?: string; season?: number; episode?: number; title?: string }
): Promise<{ streamUrl: string; contentType?: string; isTranscoding?: boolean; durationSeconds?: number } | null> {
  try {
    const hdrs = await getForwardedHeaders();
    const params = new URLSearchParams({ itemId, receiver: 'native-tv' });
    if (extra?.tmdbId) params.set('tmdbId', String(extra.tmdbId));
    if (extra?.type) params.set('type', extra.type);
    if (extra?.season) params.set('season', String(extra.season));
    if (extra?.episode) params.set('episode', String(extra.episode));
    if (extra?.title) params.set('title', extra.title);

    const res = await fetch(`${getBackendUrl()}/api/v1/playback?${params.toString()}`, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchTvSubtitles(itemId: string): Promise<Array<{ id: string; label: string; language: string; src: string }>> {
  try {
    const hdrs = await getForwardedHeaders();
    const res = await fetch(`${getBackendUrl()}/api/v1/subtitles?itemId=${encodeURIComponent(itemId)}`, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.subtitles || []).map((sub: any, idx: number) => ({
      id: sub.id || String(idx),
      label: sub.title || sub.language || `Subtitle ${idx + 1}`,
      language: sub.language || 'und',
      src: sub.src || `/api/v1/subtitles?itemId=${encodeURIComponent(itemId)}&index=${idx}`,
    }));
  } catch {
    return [];
  }
}

export async function fetchTvMusic(q?: string): Promise<{
  albums: any[];
  total: number;
  configured: boolean;
}> {
  try {
    const hdrs = await getForwardedHeaders();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const res = await fetch(`${getBackendUrl()}/api/v1/music?${params.toString()}`, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (!res.ok) return { albums: [], total: 0, configured: false };
    return await res.json();
  } catch {
    return { albums: [], total: 0, configured: false };
  }
}

export async function fetchTvMusicAlbum(albumId: string): Promise<{ album: any; tracks: any[] } | null> {
  try {
    const hdrs = await getForwardedHeaders();
    const res = await fetch(`${getBackendUrl()}/api/v1/music/album?albumId=${encodeURIComponent(albumId)}`, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchTvMusicPlaylists(): Promise<any[]> {
  try {
    const hdrs = await getForwardedHeaders();
    const res = await fetch(`${getBackendUrl()}/api/v1/music/playlists`, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.playlists || [];
  } catch {
    return [];
  }
}

export async function fetchTvMusicPlaylist(playlistId: string): Promise<{ playlist: any; tracks: any[] } | null> {
  try {
    const hdrs = await getForwardedHeaders();
    const res = await fetch(`${getBackendUrl()}/api/v1/music/playlist?playlistId=${encodeURIComponent(playlistId)}`, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchTvDiscover(q?: string): Promise<MediaItem[]> {
  try {
    const hdrs = await getForwardedHeaders();
    const url = q
      ? `${getBackendUrl()}/api/v1/search?q=${encodeURIComponent(q)}`
      : `${getBackendUrl()}/api/v1/categories/requests`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: hdrs,
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.results) return data.results;
    if (data.items) return data.items;
    if (data.sections) {
      return data.sections.flatMap((s: any) => s.items || []);
    }
    return [];
  } catch {
    return [];
  }
}

export async function fetchTvRequested(): Promise<{ requested: any[]; downloads: any[] }> {
  try {
    const hdrs = await getForwardedHeaders();
    const [reqRes, dlRes] = await Promise.all([
      fetch(`${getBackendUrl()}/api/v1/requested`, { cache: 'no-store', headers: hdrs }).catch(() => null),
      fetch(`${getBackendUrl()}/api/v1/downloads`, { cache: 'no-store', headers: hdrs }).catch(() => null),
    ]);
    const reqData = reqRes && reqRes.ok ? await reqRes.json() : { requested: [] };
    const dlData = dlRes && dlRes.ok ? await dlRes.json() : { items: [] };
    return {
      requested: reqData.requested || [],
      downloads: dlData.items || [],
    };
  } catch {
    return { requested: [], downloads: [] };
  }
}

export async function fetchTvYouTube(tab = 'home', q = ''): Promise<any[]> {
  try {
    const hdrs = await getForwardedHeaders();
    let url = `${getBackendUrl()}/api/v1/youtube/recommendations`;
    if (q) url = `${getBackendUrl()}/api/v1/youtube/search?q=${encodeURIComponent(q)}`;
    else if (tab === 'archive') url = `${getBackendUrl()}/api/v1/youtube/archive`;
    else if (tab === 'subscriptions') url = `${getBackendUrl()}/api/v1/youtube/subscriptions`;

    const res = await fetch(url, { cache: 'no-store', headers: hdrs });
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos || data.items || data.recommendations || [];
  } catch {
    return [];
  }
}
