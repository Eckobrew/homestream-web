import React from 'react';
import type { Metadata } from 'next';
import { fetchTvMedia, fetchTvSubtitles } from '@/lib/tv-api';
import { TvWatchPlayer } from '@/components/TvWatchPlayer';

export const revalidate = 0;
export const metadata: Metadata = {
  title: { absolute: 'Watch · HomeStream TV' },
  robots: { index: false, follow: false },
};

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
    streamUrl?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const isYouTube = sp.source === 'youtube';

  let playback: any = null;
  let subtitles: any[] = [];
  let media: any = null;

  if (isYouTube) {
    const localStream = sp.streamUrl && sp.streamUrl.startsWith('/api/')
      ? (sp.streamUrl.startsWith('/api/v1/') ? sp.streamUrl : sp.streamUrl.replace(/^\/api\//, '/api/v1/'))
      : null;
    playback = {
      streamUrl: localStream || `/api/v1/youtube/stream-video?videoId=${encodeURIComponent(id)}`,
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

    const [md, subs] = await Promise.all([
      fetchTvMedia(id),
      fetchTvSubtitles(id),
    ]);

    playback = { streamUrl: '', playbackExtra: extra };
    media = md;
    subtitles = subs;
  }

  if (!playback || (isYouTube && !playback.streamUrl)) {
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
  const isHls = playback.transport === 'HLS' || streamSrc.includes('.m3u8') || /mpegurl/i.test(playback.contentType || '');

  const series = media?.seriesId ? await fetchTvMedia(media.seriesId) : media;
  const episodes = series?.seasons?.flatMap((season: { episodes?: Array<{ id: string }> }) => season.episodes || []) || [];
  const currentIndex = episodes.findIndex((episode: { id: string }) => episode.id === id);
  const nextEpisode = currentIndex >= 0 ? episodes[currentIndex + 1] : null;
  const resumeSeconds = Math.max(0, Number(media?.playbackPositionTicks || 0) / 10_000_000);

  return (
    <div className="tv-player-wrap">
      <div className="tv-player-back-hint">
        Press <b>Return / Back</b> on your TV remote to exit
      </div>

      <TvWatchPlayer
        key={id}
        itemId={id}
        playbackExtra={playback.playbackExtra}
        streamSrc={streamSrc}
        contentType={playback.contentType}
        isHls={isHls}
        poster={media?.backdropUrl || ''}
        subtitles={subtitles}
        skipSegments={playback.skipSegments || []}
        trickplayUrl={playback.trickplayUrl}
        selectedVersionId={playback.selectedVersionId}
        durationSeconds={playback.durationSeconds || 0}
        nextEpUrl={nextEpisode ? `/tv/watch/${encodeURIComponent(nextEpisode.id)}` : null}
        resumeSeconds={resumeSeconds}
        isYouTube={isYouTube}
      />
    </div>
  );
}
