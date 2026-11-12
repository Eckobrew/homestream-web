import React from 'react';
import { fetchTvMusicPlaylist } from '@/lib/tv-api';
import { notFound } from 'next/navigation';

export const revalidate = 0;

export default async function TvMusicPlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await fetchTvMusicPlaylist(id);

  if (!data?.playlist) {
    notFound();
  }

  const { playlist, tracks = [] } = data;

  return (
    <div style={{ padding: '24px 36px' }}>
      <div className="tv-detail-wrap" style={{ marginBottom: '32px' }}>
        <div className="tv-detail-poster" style={{ width: '220px', aspectRatio: '1/1', backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt={playlist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '48px' }}>🎵</span>
          )}
        </div>

        <div className="tv-detail-info">
          <h1 className="tv-detail-title">{playlist.name}</h1>
          <div className="tv-detail-badges">
            <span className="tv-badge">{tracks.length} Tracks</span>
          </div>

          <div style={{ marginTop: '24px' }}>
            <a href="/tv/music?tab=playlists" className="tv-btn tv-btn-sec" tabIndex={0}>
              ◀ Back to Playlists
            </a>
          </div>
        </div>
      </div>

      <div className="tv-section">
        <h2 className="tv-section-title">Tracks ({tracks.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tracks.map((track, idx) => {
            const isReady = track.status === 'completed' && track.streamUrl;
            const durMin = track.durationSeconds ? Math.floor(track.durationSeconds / 60) : 0;
            const durSec = track.durationSeconds ? Math.floor(track.durationSeconds % 60) : 0;
            const durStr = track.durationSeconds ? `${durMin}:${durSec.toString().padStart(2, '0')}` : '--:--';
            const playUrl = `/tv/music/play?streamUrl=${encodeURIComponent(track.streamUrl || '')}&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}&cover=${encodeURIComponent(track.coverUrl || '')}&album=${encodeURIComponent(track.album || playlist.name)}`;

            return (
              <div
                key={track.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  backgroundColor: '#1f1f1f',
                  border: '2px solid #333333',
                  borderRadius: '8px',
                  opacity: isReady ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#888888', width: '28px' }}>
                    {idx + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff' }}>{track.title}</div>
                    <div style={{ fontSize: '13px', color: '#aaaaaa' }}>{track.artist} {track.album ? `• ${track.album}` : ''}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '13px', color: isReady ? '#1DB954' : '#aaaaaa', fontWeight: 'bold' }}>
                    {isReady ? `✓ Ready (${durStr})` : (track.status || 'Downloading...')}
                  </span>
                  {isReady && (
                    <a href={playUrl} tabIndex={0} className="tv-btn tv-btn-play" style={{ padding: '6px 14px', fontSize: '13px' }}>
                      ▶ Play
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
