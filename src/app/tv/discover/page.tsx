import React from 'react';
import { fetchTvDiscover } from '@/lib/tv-api';

export const revalidate = 0;

export default async function TvDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const items = await fetchTvDiscover(q);

  return (
    <div style={{ padding: '24px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '30px', fontWeight: 900, margin: '0 0 6px 0', color: '#ffffff' }}>
            Discover Hub
          </h1>
          <p style={{ color: '#aaaaaa', margin: 0, fontSize: '15px' }}>
            Browse trending, upcoming, and popular titles from TMDB. Stream directly via torrents or request automatic download.
          </p>
        </div>

        <form action="/tv/discover" method="GET" style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search TMDB titles..."
            tabIndex={0}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              backgroundColor: '#242424',
              border: '2px solid #444444',
              color: '#ffffff',
              fontSize: '15px',
              width: '280px',
            }}
          />
          <button type="submit" tabIndex={0} className="tv-btn" style={{ backgroundColor: '#333333', color: '#ffffff', padding: '10px 18px' }}>
            Search
          </button>
        </form>
      </div>

      {items.length === 0 ? (
        <p style={{ color: '#aaaaaa', fontSize: '18px' }}>No discover items available right now.</p>
      ) : (
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
                <div className="tv-card-sub">
                  {item.year || item.releaseDate?.slice(0, 4) || 'TMDB'}
                  {item.communityRating ? ` • ★ ${item.communityRating.toFixed(1)}` : ''}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
