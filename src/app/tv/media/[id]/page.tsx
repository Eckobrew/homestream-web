import React from 'react';
import { fetchTvMedia, getBackendUrl } from '@/lib/tv-api';
import { notFound, redirect } from 'next/navigation';

export const revalidate = 0;

async function requestMediaAction(formData: FormData) {
  'use server';
  const mediaId = Number(formData.get('mediaId'));
  const mediaType = formData.get('mediaType') as 'movie' | 'tv';
  const currentPath = formData.get('currentPath') as string;

  if (mediaId && mediaType) {
    try {
      await fetch(`${getBackendUrl()}/api/v1/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId, mediaType }),
      });
    } catch {}
  }
  redirect(`${currentPath}?requested=1`);
}

export default async function TvMediaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ requested?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const item = await fetchTvMedia(id);

  if (!item) {
    notFound();
  }

  const isMovie = (item.type as string)?.toLowerCase() === 'movie';
  const episodes: any[] = item.episodes || [];
  const isAvailable = Boolean(item.isAvailable || item.jellyfinId);
  const tmdbId = item.tmdbId || (id.startsWith('seerr-') || id.startsWith('tmdb-') ? Number(id.replace(/^seerr-(?:movie-|tv-)?|^tmdb-(?:movie-|tv-)?/, '')) : 0);

  const torrentMovieUrl = `/tv/watch/${id}?torrent=1&tmdbId=${tmdbId || ''}&type=movie&title=${encodeURIComponent(item.title || '')}`;

  return (
    <div>
      {/* Media Details Banner */}
      <div className="tv-detail-wrap">
        <div className="tv-detail-poster">
          <img
            src={item.posterUrl || '/poster-placeholder.png'}
            alt={item.title}
          />
        </div>

        <div className="tv-detail-info">
          <h1 className="tv-detail-title">{item.title}</h1>

          <div className="tv-detail-badges">
            {item.year && <span className="tv-badge">{item.year}</span>}
            {item.communityRating && <span className="tv-badge">★ {item.communityRating.toFixed(1)}</span>}
            {item.officialRating && <span className="tv-badge">{item.officialRating}</span>}
            {isAvailable ? (
              <span className="tv-badge" style={{ backgroundColor: '#047857', color: '#ffffff' }}>✓ In Library</span>
            ) : (
              <span className="tv-badge" style={{ backgroundColor: '#b45309', color: '#ffffff' }}>Torrent Swarm / Request</span>
            )}
            {item.genres?.length > 0 && <span className="tv-badge">{item.genres.slice(0, 3).join(', ')}</span>}
          </div>

          {sp.requested && (
            <div style={{ padding: '10px 16px', backgroundColor: '#047857', borderRadius: '8px', color: '#ffffff', fontWeight: 'bold', margin: '14px 0', display: 'inline-block' }}>
              ✓ Request Submitted to Downloader (Sonarr / Radarr / qBittorrent)
            </div>
          )}

          <p className="tv-detail-overview">{item.overview || 'No description available.'}</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            {isMovie ? (
              <>
                {isAvailable && (
                  <a href={`/tv/watch/${item.id}`} className="tv-btn tv-btn-play" tabIndex={0}>
                    ▶ Play Movie
                  </a>
                )}
                {/* Direct Torrent Streaming Option */}
                <a href={torrentMovieUrl} className="tv-btn" tabIndex={0} style={{ backgroundColor: '#2563eb', color: '#ffffff' }}>
                  ⚡ Stream Torrent
                </a>
              </>
            ) : episodes.length > 0 ? (
              <>
                {isAvailable && (
                  <a href={`/tv/watch/${episodes[0].id}`} className="tv-btn tv-btn-play" tabIndex={0}>
                    ▶ Play Next (S{episodes[0].seasonNumber} E{episodes[0].episodeNumber})
                  </a>
                )}
                <a
                  href={`/tv/watch/${id}?torrent=1&tmdbId=${tmdbId || ''}&type=tv&season=${episodes[0].seasonNumber || 1}&episode=${episodes[0].episodeNumber || 1}&title=${encodeURIComponent(item.title || '')}`}
                  className="tv-btn"
                  tabIndex={0}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                >
                  ⚡ Stream Torrent (S{episodes[0].seasonNumber || 1} E{episodes[0].episodeNumber || 1})
                </a>
              </>
            ) : null}

            {/* Request Button */}
            {tmdbId > 0 && !isAvailable && !sp.requested && (
              <form action={requestMediaAction} style={{ margin: 0, display: 'inline' }}>
                <input type="hidden" name="mediaId" value={tmdbId} />
                <input type="hidden" name="mediaType" value={isMovie ? 'movie' : 'tv'} />
                <input type="hidden" name="currentPath" value={`/tv/media/${id}`} />
                <button type="submit" className="tv-btn" tabIndex={0} style={{ backgroundColor: '#374151', color: '#ffffff', cursor: 'pointer' }}>
                  📥 Request Download
                </button>
              </form>
            )}

            <a href="/tv" className="tv-btn tv-btn-sec" tabIndex={0}>
              ◀ Back to Browse
            </a>
          </div>
        </div>
      </div>

      {/* Episodes List for TV Series */}
      {!isMovie && episodes.length > 0 && (
        <div className="tv-section tv-episodes-wrap">
          <h2 className="tv-section-title">Episodes ({episodes.length})</h2>
          <div>
            {episodes.map((ep) => {
              const epTorrentUrl = `/tv/watch/${id}?torrent=1&tmdbId=${tmdbId || ''}&type=tv&season=${ep.seasonNumber || 1}&episode=${ep.episodeNumber || 1}&title=${encodeURIComponent(item.title || '')}`;
              return (
                <div
                  key={ep.id}
                  style={{
                    backgroundColor: '#1f1f1f',
                    border: '2px solid #333333',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffffff', marginBottom: '4px' }}>
                      S{ep.seasonNumber} E{ep.episodeNumber}: {ep.name || ep.title || `Episode ${ep.episodeNumber}`}
                    </div>
                    {ep.overview && (
                      <div style={{ fontSize: '14px', color: '#aaaaaa', lineHeight: 1.4 }}>{ep.overview}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {isAvailable && (
                      <a href={`/tv/watch/${ep.id}`} className="tv-btn tv-btn-play" tabIndex={0} style={{ padding: '8px 16px', fontSize: '14px' }}>
                        ▶ Play
                      </a>
                    )}
                    <a href={epTorrentUrl} className="tv-btn" tabIndex={0} style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '8px 16px', fontSize: '14px' }}>
                      ⚡ Stream Torrent
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
