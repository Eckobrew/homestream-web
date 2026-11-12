import React from 'react';
import { fetchTvHome } from '@/lib/tv-api';

export const revalidate = 0;

export default async function TvHomePage() {
  const { hero, continueWatching, movies, series } = await fetchTvHome();

  return (
    <div>
      {/* Featured Hero Banner */}
      {hero && (
        <section
          className="tv-hero"
          style={{
            backgroundImage: hero.backdropUrl ? `url(${hero.backdropUrl})` : undefined,
          }}
        >
          <div className="tv-hero-overlay" />
          <div className="tv-hero-content">
            <h1 className="tv-hero-title">{hero.title}</h1>
            <p className="tv-hero-desc">{hero.overview || 'Stream your favorite movies and shows.'}</p>
            <div>
              <a href={`/tv/watch/${hero.id}`} className="tv-btn tv-btn-play" tabIndex={0}>
                ▶ Play
              </a>
              <a href={`/tv/media/${hero.id}`} className="tv-btn tv-btn-sec" tabIndex={0}>
                ℹ Details
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Continue Watching Row */}
      {continueWatching.length > 0 && (
        <section className="tv-section">
          <h2 className="tv-section-title">Continue Watching</h2>
          <div className="tv-row">
            {continueWatching.map((item) => (
              <a key={item.id} href={`/tv/watch/${item.id}`} className="tv-card" tabIndex={0}>
                <img
                  src={item.posterUrl || item.backdropUrl || '/poster-placeholder.png'}
                  alt={item.title}
                  loading="lazy"
                />
                <div className="tv-card-meta">
                  <div className="tv-card-title">{item.title}</div>
                  <div className="tv-card-sub">{(item.type as string)?.toLowerCase() === 'series' || (item.type as string) === 'tv' ? 'Series' : 'Movie'}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Latest Movies Row */}
      {movies.length > 0 && (
        <section className="tv-section">
          <h2 className="tv-section-title">Movies</h2>
          <div className="tv-row">
            {movies.map((item) => (
              <a key={item.id} href={`/tv/media/${item.id}`} className="tv-card" tabIndex={0}>
                <img
                  src={item.posterUrl || '/poster-placeholder.png'}
                  alt={item.title}
                  loading="lazy"
                />
                <div className="tv-card-meta">
                  <div className="tv-card-title">{item.title}</div>
                  <div className="tv-card-sub">{item.year || 'Movie'}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Latest TV Shows Row */}
      {series.length > 0 && (
        <section className="tv-section">
          <h2 className="tv-section-title">TV Shows</h2>
          <div className="tv-row">
            {series.map((item) => (
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
        </section>
      )}

      {movies.length === 0 && series.length === 0 && (
        <div style={{ padding: '60px 36px', textAlign: 'center', color: '#aaaaaa' }}>
          <h2>No media items found</h2>
          <p>Verify your Jellyfin server is connected in settings.</p>
        </div>
      )}
    </div>
  );
}
