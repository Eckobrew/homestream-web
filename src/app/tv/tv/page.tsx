import React from 'react';
import { fetchTvLibrary } from '@/lib/tv-api';

export const revalidate = 0;

export default async function TvShowsPage() {
  const items = await fetchTvLibrary('tv');

  return (
    <div className="tv-section">
      <h1 className="tv-section-title">TV Shows Library ({items.length})</h1>
      <div className="tv-grid">
        {items.map((item) => (
          <a key={item.id} href={`/tv/media/${item.id}`} className="tv-card" tabIndex={0}>
            <img
              src={item.posterUrl || '/poster-placeholder.png'}
              alt={item.title}
              loading="lazy"
            />
            <div className="tv-card-meta">
              <div className="tv-card-title">{item.title}</div>
              <div className="tv-card-sub">{item.year || 'TV Series'}</div>
            </div>
          </a>
        ))}
      </div>
      {items.length === 0 && (
        <div style={{ padding: '40px 0', color: '#aaaaaa' }}>
          No TV shows found in your Jellyfin library.
        </div>
      )}
    </div>
  );
}
