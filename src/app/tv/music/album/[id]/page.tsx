import React from 'react';
import { fetchTvMusicAlbum } from '@/lib/tv-api';
import { notFound } from 'next/navigation';

export const revalidate = 0;

export default async function TvMusicAlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchTvMusicAlbum(id);

  if (!data?.album) {
    notFound();
  }

  const { album, tracks = [] } = data;

  return (
    <div style={{ padding: '24px 36px' }}>
      <div className="tv-detail-wrap" style={{ marginBottom: '32px' }}>
        <div className="tv-detail-poster" style={{ width: '220px', aspectRatio: '1/1' }}>
          <img
            src={album.coverUrl || '/poster-placeholder.png'}
            alt={album.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div className="tv-detail-info">
          <h1 className="tv-detail-title">{album.title}</h1>
          <h2 style={{ fontSize: '22px', color: '#1DB954', margin: '4px 0 16px 0', fontWeight: 'bold' }}>
            {album.artist}
          </h2>

          <div className="tv-detail-badges">
            {album.year && <span className="tv-badge">{album.year}</span>}
            <span className="tv-badge">{tracks.length} Tracks</span>
          </div>

          <div style={{ marginTop: '24px' }}>
            <a href="/tv/music" className="tv-btn tv-btn-sec" tabIndex={0}>
              ◀ Back to Music
            </a>
          </div>
        </div>
      </div>

      <div className="tv-section">
        <h2 className="tv-section-title">Tracklist</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tracks.map((track, idx) => {
            const durMin = track.durationSeconds ? Math.floor(track.durationSeconds / 60) : 0;
            const durSec = track.durationSeconds ? Math.floor(track.durationSeconds % 60) : 0;
            const durStr = track.durationSeconds ? `${durMin}:${durSec.toString().padStart(2, '0')}` : '--:--';
            const streamUrl = track.streamUrl || `/api/v1/music/stream?trackId=${track.id}`;
            const playUrl = `/tv/music/play?streamUrl=${encodeURIComponent(streamUrl)}&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist || album.artist)}&cover=${encodeURIComponent(track.coverUrl || album.coverUrl || '')}&album=${encodeURIComponent(album.title)}`;

            return (
              <a
                key={track.id || idx}
                href={playUrl}
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  backgroundColor: '#1f1f1f',
                  border: '2px solid #333333',
                  borderRadius: '8px',
                  color: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#888888', width: '28px' }}>
                    {track.trackNumber || idx + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{track.title}</div>
                    <div style={{ fontSize: '13px', color: '#aaaaaa' }}>{track.artist || album.artist}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '14px', color: '#aaaaaa' }}>{durStr}</span>
                  <span className="tv-btn tv-btn-play" style={{ padding: '6px 14px', fontSize: '13px', display: 'inline-block' }}>
                    ▶ Play
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
