import React from 'react';
import { fetchTvYouTube } from '@/lib/tv-api';

export const revalidate = 0;

export default async function TvYouTubePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { tab = 'home', q = '' } = await searchParams;
  const youtubeData = await fetchTvYouTube(tab, q);
  const { hero, sections, items } = youtubeData;
  const isHome = tab === 'home' && !q;

  return (
    <div style={{ padding: '24px 36px 48px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href="/tv/youtube?tab=home"
            className="tv-btn"
            tabIndex={0}
            style={{
              backgroundColor: isHome ? '#e50914' : '#242424',
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

      {isHome && sections.length > 0 ? (
        <div>
          {sections.map((sec) => (
            <div key={sec.id} style={{ marginBottom: '32px' }}>
              <h2 className="tv-section-title" style={{ marginBottom: '14px' }}>{sec.title}</h2>
              <div className="tv-row">
                {sec.items.map((vid: any) => {
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
            </div>
          ))}
        </div>
      ) : (
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '18px' }}>
            {q ? `YouTube Results for "${q}"` : tab === 'archive' ? 'Archived YouTube Videos' : tab === 'subscriptions' ? 'Subscribed Channels' : 'YouTube Recommendations'}
          </h2>

          {items.length === 0 ? (
            <p style={{ color: '#aaaaaa', fontSize: '18px' }}>
              {tab === 'subscriptions'
                ? 'No subscribed channels found. Add channels in the web interface or search above.'
                : 'No YouTube videos found.'}
            </p>
          ) : (
            <div className="tv-grid">
              {items.map((it: any) => {
                if (tab === 'subscriptions' && (it.name || it.channelId)) {
                  const subSearchUrl = `/tv/youtube?q=${encodeURIComponent(it.name || it.channelTitle || it.id)}`;
                  return (
                    <a key={it.id || it.channelId} href={subSearchUrl} className="tv-card" tabIndex={0}>
                      <img
                        src={it.avatarUrl || '/poster-placeholder.png'}
                        alt={it.name || it.channelTitle}
                        loading="lazy"
                        style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                      />
                      <div className="tv-card-meta">
                        <div className="tv-card-title">{it.name || it.channelTitle}</div>
                        <div className="tv-card-sub">Channel • Click to Browse</div>
                      </div>
                    </a>
                  );
                }

                const vidId = it.id || it.videoId;
                const thumb = it.thumbnailUrl || it.thumbnail || `https://i.ytimg.com/vi/${vidId}/mqdefault.jpg`;
                const watchUrl = `/tv/watch/${vidId}?source=youtube`;

                return (
                  <a key={vidId} href={watchUrl} className="tv-card tv-card-youtube" tabIndex={0}>
                    <img
                      src={thumb}
                      alt={it.title}
                      loading="lazy"
                      style={{ width: '100%', height: '135px', objectFit: 'cover' }}
                    />
                    <div className="tv-card-meta">
                      <div className="tv-card-title">{it.title}</div>
                      <div className="tv-card-sub">{it.channelTitle || it.author || 'YouTube'}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
