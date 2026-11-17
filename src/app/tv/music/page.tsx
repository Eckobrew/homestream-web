import React from 'react';
import { fetchTvMusic, fetchTvMusicAlbum, fetchTvMusicPlaylists } from '@/lib/tv-api';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const revalidate = 0;
export const metadata = buildSectionMetadata(
  'Music · TV Mode',
  'Browse albums and playlists on HomeStream TV.',
  '/tv/music'
);

export default async function TvMusicPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; sort?: string }>;
}) {
  const { tab = 'albums', q = '', sort = 'title' } = await searchParams;
  const activeTab = tab === 'playlists' || tab === 'artists' || tab === 'songs' ? tab : 'albums';

  const [musicData, playlists] = await Promise.all([
    fetchTvMusic(q),
    fetchTvMusicPlaylists(),
  ]);

  const { albums } = musicData;

  const artistMap = new Map<string, { name: string; count: number; coverUrl?: string }>();
  for (const album of albums) {
    const artistName = (album.artist || 'Unknown Artist').trim();
    const existing = artistMap.get(artistName);
    if (existing) {
      existing.count += 1;
    } else {
      artistMap.set(artistName, { name: artistName, count: 1, coverUrl: album.coverUrl });
    }
  }
  const artists = Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  let songs: Array<{ id: string; title: string; artist: string; album: string; coverUrl?: string; streamUrl: string }> = [];
  if (activeTab === 'songs') {
    const details = await Promise.all(albums.slice(0, 30).map((a) => fetchTvMusicAlbum(a.id)));
    for (const detail of details) {
      if (!detail) continue;
      for (const track of detail.tracks || []) {
        songs.push({
          id: track.id,
          title: track.title,
          artist: track.artist || detail.album?.artist || 'Unknown Artist',
          album: detail.album?.title || '',
          coverUrl: detail.album?.coverUrl,
          streamUrl: track.streamUrl || `/api/v1/music/stream?trackId=${encodeURIComponent(track.id)}`,
        });
      }
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      songs = songs.filter(
        (s) =>
          s.title.toLowerCase().includes(needle) ||
          s.artist.toLowerCase().includes(needle) ||
          s.album.toLowerCase().includes(needle)
      );
    }
    songs.sort((a, b) =>
      sort === 'artist'
        ? a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)
        : sort === 'album'
        ? a.album.localeCompare(b.album) || a.title.localeCompare(b.title)
        : a.title.localeCompare(b.title)
    );
  }

  return (
    <div style={{ padding: '24px 36px' }}>
      {/* Category Pills & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { id: 'albums', label: `Albums (${albums.length})` },
            { id: 'artists', label: `Artists (${artists.length})` },
            { id: 'songs', label: 'Songs' },
            { id: 'playlists', label: `Playlists (${playlists.length})` },
          ].map((item) => (
            <a
              key={item.id}
              href={`/tv/music?tab=${item.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className="tv-btn"
              tabIndex={0}
              style={{
                backgroundColor: activeTab === item.id ? '#e50914' : '#242424',
                color: '#ffffff',
              }}
            >
              {item.label}
            </a>
          ))}
        </div>

        <form action="/tv/music" method="GET" style={{ display: 'flex', gap: '10px' }}>
          <input type="hidden" name="tab" value={activeTab} />
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

      {activeTab === 'albums' ? (
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
      ) : activeTab === 'artists' ? (
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '18px' }}>
            {q ? `Artists Matching "${q}"` : 'Artists'}
          </h2>
          {artists.length === 0 ? (
            <p style={{ color: '#aaaaaa', fontSize: '18px' }}>No artists found in your library.</p>
          ) : (
            <div className="tv-grid">
              {artists.map((artist) => (
                <a
                  key={artist.name}
                  href={`/tv/music?tab=albums&q=${encodeURIComponent(artist.name)}`}
                  className="tv-card tv-card-music"
                  tabIndex={0}
                >
                  <img
                    src={artist.coverUrl || '/poster-placeholder.png'}
                    alt={artist.name}
                    loading="lazy"
                    style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                  />
                  <div className="tv-card-meta">
                    <div className="tv-card-title">{artist.name}</div>
                    <div className="tv-card-sub">{artist.count} {artist.count === 1 ? 'album' : 'albums'}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'songs' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
              Songs ({songs.length})
            </h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {[
                { id: 'title', label: 'Sort: Title' },
                { id: 'artist', label: 'Sort: Artist' },
                { id: 'album', label: 'Sort: Album' },
              ].map((opt) => (
                <a
                  key={opt.id}
                  href={`/tv/music?tab=songs&sort=${opt.id}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                  className="tv-btn"
                  tabIndex={0}
                  style={{ backgroundColor: sort === opt.id ? '#1DB954' : '#242424', color: '#ffffff', padding: '8px 14px', fontSize: '14px' }}
                >
                  {opt.label}
                </a>
              ))}
            </div>
          </div>
          {songs.length === 0 ? (
            <p style={{ color: '#aaaaaa', fontSize: '18px' }}>No songs found in your library.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {songs.map((song, idx) => (
                <a
                  key={`${song.id}-${idx}`}
                  href={`/tv/music/play?streamUrl=${encodeURIComponent(song.streamUrl)}&title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}&album=${encodeURIComponent(song.album)}&cover=${encodeURIComponent(song.coverUrl || '')}`}
                  className="tv-btn"
                  tabIndex={0}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#1b1b1b',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    textAlign: 'left',
                    color: '#ffffff',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '17px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      ▶ {song.title}
                    </div>
                    <div style={{ fontSize: '13px', color: '#aaaaaa', marginTop: '2px' }}>
                      {song.artist}{song.album ? ` • ${song.album}` : ''}
                    </div>
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
                    <div className="tv-card-sub">{(pl as any).totalTracks ?? pl.trackCount ?? 0} tracks</div>
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
