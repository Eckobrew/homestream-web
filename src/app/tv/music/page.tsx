import React from 'react';
import { fetchTvMusic, fetchTvMusicPlaylists } from '@/lib/tv-api';

export const revalidate = 0;

export default async function TvMusicPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab = 'albums', q = '' } = await searchParams;
  const isPlaylists = tab === 'playlists';

  const [musicData, playlists] = await Promise.all([
    fetchTvMusic(q),
    fetchTvMusicPlaylists(),
  ]);

  const { albums } = musicData;

  return (
    <div style={{ padding: '24px 36px' }}>
      {/* Category Pills & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href="/tv/music?tab=albums"
            className="tv-btn"
            tabIndex={0}
            style={{
              backgroundColor: !isPlaylists ? '#e50914' : '#242424',
              color: '#ffffff',
            }}
          >
            Albums ({albums.length})
          </a>
          <a
            href="/tv/music?tab=playlists"
            className="tv-btn"
            tabIndex={0}
            style={{
              backgroundColor: isPlaylists ? '#e50914' : '#242424',
              color: '#ffffff',
            }}
          >
            Playlists ({playlists.length})
          </a>
        </div>

        <form action="/tv/music" method="GET" style={{ display: 'flex', gap: '10px' }}>
          <input type="hidden" name="tab" value={tab} />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search music..."
            tabIndex={0}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              backgroundColor: '#242424',
              border: '2px solid #444444',
              color: '#ffffff',
              fontSize: '15px',
              width: '260px',
            }}
          />
          <button type="submit" tabIndex={0} className="tv-btn" style={{ backgroundColor: '#333333', color: '#ffffff', padding: '10px 18px' }}>
            Search
          </button>
        </form>
      </div>

      {!isPlaylists ? (
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '18px' }}>
            {q ? `Music Albums Matching "${q}"` : 'Music Library Albums'}
          </h2>
          {albums.length === 0 ? (
            <p style={{ color: '#aaaaaa', fontSize: '18px' }}>No albums found in your library.</p>
          ) : (
            <div className="tv-grid">
              {albums.map((album) => (
                <a key={album.id} href={`/tv/music/album/${album.id}`} className="tv-card tv-card-music" tabIndex={0}>
                  <img
                    src={album.coverUrl || '/poster-placeholder.png'}
                    alt={album.title}
                    loading="lazy"
                    style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                  />
                  <div className="tv-card-meta">
                    <div className="tv-card-title">{album.title}</div>
                    <div className="tv-card-sub">{album.artist}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '18px' }}>Imported Playlists</h2>
          {playlists.length === 0 ? (
            <p style={{ color: '#aaaaaa', fontSize: '18px' }}>No playlists found. Import playlists from Spotify/Exportify on the web interface.</p>
          ) : (
            <div className="tv-grid">
              {playlists.map((pl) => (
                <a key={pl.id} href={`/tv/music/playlist/${pl.id}`} className="tv-card tv-card-music" tabIndex={0}>
                  {pl.coverUrl ? (
                    <img
                      src={pl.coverUrl}
                      alt={pl.name}
                      loading="lazy"
                      style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '180px', backgroundColor: '#262626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '36px' }}>🎵</span>
                    </div>
                  )}
                  <div className="tv-card-meta">
                    <div className="tv-card-title">{pl.name}</div>
                    <div className="tv-card-sub">{pl.trackCount || 0} tracks</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
