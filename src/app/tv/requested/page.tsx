import React from 'react';
import { fetchTvRequested } from '@/lib/tv-api';

export const revalidate = 0;

export default async function TvRequestedPage() {
  const { requested, downloads } = await fetchTvRequested();

  return (
    <div style={{ padding: '24px 36px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '30px', fontWeight: 900, margin: '0 0 6px 0', color: '#ffffff' }}>
          Requested &amp; Downloads
        </h1>
        <p style={{ color: '#aaaaaa', margin: 0, fontSize: '15px' }}>
          Monitor your active qBittorrent downloads and requested media status.
        </p>
      </div>

      {/* Active Downloads Section */}
      <div style={{ marginBottom: '36px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '16px' }}>
          Active Downloads ({downloads.length})
        </h2>
        {downloads.length === 0 ? (
          <p style={{ color: '#aaaaaa', fontSize: '16px' }}>No active downloads in qBittorrent right now.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {downloads.map((dl: any, idx: number) => {
              const progress = Math.round((dl.progress || 0) * 100);
              return (
                <div
                  key={dl.hash || idx}
                  style={{
                    backgroundColor: '#1f1f1f',
                    border: '2px solid #333333',
                    borderRadius: '8px',
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff' }}>
                      {dl.name || dl.title || 'Downloading File'}
                    </span>
                    <span style={{ fontSize: '14px', color: '#3b82f6', fontWeight: 'bold' }}>
                      {progress}% ({dl.state || 'Downloading'})
                    </span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#333333', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#2563eb' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Requested Media Section */}
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '16px' }}>
          Requested Media Items ({requested.length})
        </h2>
        {requested.length === 0 ? (
          <p style={{ color: '#aaaaaa', fontSize: '16px' }}>No pending requests. Explore the Discover Hub to request titles.</p>
        ) : (
          <div className="tv-grid">
            {requested.map((item: any) => {
              const id = item.id || `seerr-${item.mediaType || 'movie'}-${item.mediaId || item.tmdbId}`;
              return (
                <a key={id} href={`/tv/media/${id}`} className="tv-grid-card" tabIndex={0}>
                  <div className="tv-card-poster">
                    <img
                      src={item.posterUrl || '/poster-placeholder.png'}
                      alt={item.title || item.name}
                    />
                  </div>
                  <div className="tv-card-title">{item.title || item.name}</div>
                  <div className="tv-card-subtitle" style={{ color: item.status === 'available' ? '#10b981' : '#f59e0b' }}>
                    {item.status ? item.status.toUpperCase() : 'REQUESTED'}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
