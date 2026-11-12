import React from 'react';
import { fetchTvPlayback, fetchTvMedia, fetchTvSubtitles } from '@/lib/tv-api';

export const revalidate = 0;

export default async function TvWatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    torrent?: string;
    tmdbId?: string;
    type?: string;
    season?: string;
    episode?: string;
    title?: string;
    source?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const isYouTube = sp.source === 'youtube';

  let playback: any = null;
  let subtitles: any[] = [];
  let media: any = null;

  if (isYouTube) {
    playback = {
      streamUrl: `/api/v1/youtube/stream-video?id=${encodeURIComponent(id)}`,
      contentType: 'video/mp4',
    };
  } else {
    const extra = {
      tmdbId: sp.tmdbId ? Number(sp.tmdbId) : undefined,
      type: sp.type,
      season: sp.season ? Number(sp.season) : undefined,
      episode: sp.episode ? Number(sp.episode) : undefined,
      title: sp.title,
    };

    const [pb, md, subs] = await Promise.all([
      fetchTvPlayback(id, extra),
      fetchTvMedia(id),
      fetchTvSubtitles(id),
    ]);

    playback = pb;
    media = md;
    subtitles = subs;
  }

  if (!playback?.streamUrl) {
    return (
      <div style={{ padding: '60px 36px', textAlign: 'center', color: '#ffffff' }}>
        <h1 style={{ color: '#e50914' }}>Unable to Play Stream</h1>
        <p style={{ color: '#cccccc', margin: '20px 0' }}>
          HomeStream could not prepare a playable stream for this title. If this is a torrent, the swarm may need a moment to connect.
        </p>
        <a href={`/tv/media/${id}`} className="tv-btn tv-btn-play" tabIndex={0}>
          ◀ Back to Details
        </a>
      </div>
    );
  }

  const streamSrc = playback.streamUrl;
  const isHls = streamSrc.includes('.m3u8') || playback.contentType?.includes('mpegurl');

  // Locate next episode if viewing a series episode
  let nextEpisode: any = null;
  if (media?.episodes && media.episodes.length > 0) {
    const currentIndex = media.episodes.findIndex((e: any) => e.id === id);
    if (currentIndex >= 0 && currentIndex + 1 < media.episodes.length) {
      nextEpisode = media.episodes[currentIndex + 1];
    }
  }

  return (
    <div className="tv-player-wrap">
      <div className="tv-player-back-hint">
        Press <b>Return / Back</b> on your TV remote to exit
      </div>

      <video
        id="tv-video"
        controls
        autoPlay
        playsInline
        preload="auto"
        poster={media?.backdropUrl || ''}
        style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
      >
        <source src={streamSrc} type={isHls ? 'application/x-mpegURL' : 'video/mp4'} />
        {subtitles.map((sub, i) => (
          <track
            key={sub.id || i}
            kind="subtitles"
            src={sub.src}
            srcLang={sub.language}
            label={sub.label}
            default={i === 0}
          />
        ))}
        Your TV browser does not support HTML5 video playback.
      </video>

      {/* Script for remote control handling, progress beacons, and next episode */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var video = document.getElementById('tv-video');
              var itemId = ${JSON.stringify(id)};
              var nextEpUrl = ${nextEpisode ? JSON.stringify(`/tv/watch/${nextEpisode.id}`) : 'null'};
              var lastReport = 0;

              function reportProgress(completed) {
                if (!video) return;
                var now = Date.now();
                if (!completed && now - lastReport < 8000) return;
                lastReport = now;
                try {
                  var dur = video.duration || 0;
                  var cur = video.currentTime || 0;
                  var payload = JSON.stringify({
                    itemId: itemId,
                    positionTicks: Math.floor(cur * 10000000),
                    isPaused: video.paused,
                    isCompleted: completed || (dur > 0 && cur / dur > 0.92)
                  });
                  if (navigator.sendBeacon) {
                    navigator.sendBeacon('/api/v1/playback/progress', payload);
                  }
                } catch (e) {}
              }

              function handleKeys(e) {
                var code = e.keyCode || e.which;
                // Return / Back (10009 on Tizen, 27 on Esc, 461 on WebOS)
                if (code === 10009 || code === 27 || code === 461) {
                  e.preventDefault();
                  if (video) { video.pause(); reportProgress(false); }
                  window.history.back();
                  return;
                }
                // Media remote buttons
                if (code === 415 && video) { video.play(); } // Play
                if (code === 19 && video) { video.pause(); reportProgress(false); } // Pause
                if (code === 413 && video) { video.pause(); reportProgress(false); window.history.back(); } // Stop
              }

              window.addEventListener('keydown', handleKeys);

              if (video) {
                video.focus();
                video.addEventListener('timeupdate', function() { reportProgress(false); });
                video.addEventListener('pause', function() { reportProgress(false); });
                video.addEventListener('ended', function() {
                  reportProgress(true);
                  if (nextEpUrl) {
                    window.location.href = nextEpUrl;
                  }
                });

                var playPromise = video.play();
                if (playPromise && playPromise.catch) {
                  playPromise.catch(function() {});
                }
              }
            })();
          `,
        }}
      />
    </div>
  );
}
