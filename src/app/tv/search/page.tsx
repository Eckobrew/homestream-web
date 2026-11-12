import React from 'react';
import { getBackendUrl } from '@/lib/tv-api';
import { MediaItem } from '@/types';

export const revalidate = 0;

export default async function TvSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q || '').trim();
  let results: MediaItem[] = [];

  if (query) {
    try {
      const res = await fetch(`${getBackendUrl()}/api/v1/search?query=${encodeURIComponent(query)}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        results = data.results || data.items || [];
      }
    } catch {}
  }

  return (
    <div className="tv-section">
      <h1 className="tv-section-title">Search HomeStream</h1>

      {/* Form using standard GET submission - no JS required */}
      <form action="/tv/search" method="GET" style={{ marginBottom: '30px', display: 'flex' }}>
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Type movie or show name..."
          tabIndex={0}
          style={{
            padding: '14px 20px',
            fontSize: '18px',
            backgroundColor: '#202020',
            color: '#ffffff',
            border: '2px solid #333333',
            borderRadius: '8px',
            width: '450px',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          className="tv-btn tv-btn-play"
          tabIndex={0}
          style={{ marginLeft: '12px' }}
        >
          Search
        </button>
      </form>

      {query && (
        <h2 style={{ fontSize: '18px', color: '#aaaaaa', marginBottom: '20px' }}>
          Results for &ldquo;{query}&rdquo; ({results.length})
        </h2>
      )}

      {results.length > 0 && (
        <div className="tv-grid">
          {results.map((item) => (
            <a key={item.id} href={`/tv/media/${item.id}`} className="tv-card" tabIndex={0}>
              <img
                src={item.posterUrl || '/poster-placeholder.png'}
                alt={item.title}
                loading="lazy"
              />
              <div className="tv-card-meta">
                <div className="tv-card-title">{item.title}</div>
                <div className="tv-card-sub">{item.year || ((item.type as string)?.toLowerCase() === 'series' || (item.type as string) === 'tv' ? 'Series' : 'Movie')}</div>
              </div>
            </a>
          ))}
        </div>
      )}

      {query && results.length === 0 && (
        <div style={{ color: '#888888', padding: '20px 0' }}>
          No matching titles found for &ldquo;{query}&rdquo;.
        </div>
      )}
    </div>
  );
}
