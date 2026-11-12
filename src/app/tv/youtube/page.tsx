import React from 'react';
import { fetchTvYouTube } from '@/lib/tv-api';

export const revalidate = 0;

export default async function TvYouTubePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab = 'home', q = '' } = await searchParams;
  const videos = await fetchTvYouTube(tab, q);

  return (
    <div style={{ padding: '24px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href="/tv/youtube?tab=home"
            className="tv-btn"
            tabIndex={0}
            style={{
              backgroundColor: tab === 'home' && !q ? '#e50914' : '#242424',
              color: '#ffffff',
            }}
          >
            Trending &amp; Recommended
          </a>
          <a
            href="/tv/youtube?tab=subscriptions"
            className="tv-btn"
            tabIndex={0}
            style={{
              backgroundColor: tab === 'subscriptions' ? '#e50914' : '#242424',
              color: '#ffffff',
            }}
          >
            Subscriptions
          </a>
          <a
            href="/tv/youtube?tab=archive"
            className="tv-btn"
            tabIndex={0}
            style={{
              backgroundColor: tab === 'archive' ? '#e50914' : '#242424',
              color: '#ffffff',
            }}
          >
            Archive
          </a>
        </div>

        <form action="/tv/youtube" method="GET" style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search YouTube videos..."
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

      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '18px' }}>
        {q ? `YouTube Results for "${q}"` : tab === 'archive' ? 'Archived YouTube Videos' : tab === 'subscriptions' ? 'Subscribed Channels' : 'YouTube Recommendations'}
      </h2>

      {videos.length === 0 ? (
        <p style={{ color: '#aaaaaa', fontSize: '18px' }}>No YouTube videos found.</p>
      ) : (
        <div className="tv-grid">
          {videos.map((vid: any) => {
            const vidId = vid.id || vid.videoId;
            const thumb = vid.thumbnailUrl || vid.thumbnail || `https://i.ytimg.com/vi/${vidId}/mqdefault.jpg`;
            const watchUrl = `/tv/watch/${vidId}?source=youtube`;

            return (
              <a key={vidId} href={watchUrl} className="tv-card tv-card-youtube" tabIndex={0}>
                <img
                  src={thumb}
                  alt={vid.title}
                  loading="lazy"
                  style={{ width: '100%', height: '135px', objectFit: 'cover' }}
                />
                <div className="tv-card-meta">
                  <div className="tv-card-title">{vid.title}</div>
                  <div className="tv-card-sub">{vid.channelTitle || vid.author || 'YouTube'}</div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
