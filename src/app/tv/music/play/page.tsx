import React from 'react';
import type { Metadata } from 'next';
import { fetchTvMusicAlbum, fetchTvMusicPlaylist } from '@/lib/tv-api';
import { TvMusicPlayer, type TvMusicTrack } from '@/components/TvMusicPlayer';
import { buildSectionMetadata } from '@/lib/seo-metadata';

export const revalidate = 0;
export const metadata: Metadata = {
  ...buildSectionMetadata('Music Player · TV Mode', 'Listen to music on HomeStream TV.', '/tv/music/play'),
  robots: { index: false, follow: false },
};

export default async function TvMusicPlayPage({
  searchParams,
}: {
  searchParams: Promise<{
    albumId?: string;
    playlistId?: string;
    index?: string;
    streamUrl?: string;
    title?: string;
    artist?: string;
    album?: string;
    cover?: string;
  }>;
}) {
  const {
    albumId,
    playlistId,
    index,
    streamUrl = '',
    title = 'Unknown Title',
    artist = 'Unknown Artist',
    album = '',
    cover = '',
  } = await searchParams;

  let queue: TvMusicTrack[] = [];
  if (albumId) {
    const data = await fetchTvMusicAlbum(albumId);
    if (data?.tracks?.length) {
      queue = data.tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist || data.album?.artist || artist,
        album: data.album?.title || album,
        cover: t.coverUrl || data.album?.coverUrl || cover,
        streamUrl: t.streamUrl || `/api/v1/music/stream?trackId=${encodeURIComponent(t.id)}`,
      }));
    }
  } else if (playlistId) {
    const data = await fetchTvMusicPlaylist(playlistId);
    if (data?.tracks?.length) {
      queue = data.tracks
        .filter((t) => t.status === 'completed' && t.streamUrl)
        .map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album || data.playlist?.name || album,
          cover: t.coverUrl || data.playlist?.coverUrl || cover,
          streamUrl: t.streamUrl!,
        }));
    }
  }

  if (queue.length === 0 && streamUrl) {
    queue = [{ title, artist, album, cover, streamUrl }];
  }

  const startIndex = Math.max(0, Number(index || 0) || 0);
  return <TvMusicPlayer queue={queue} startIndex={startIndex} />;
}
