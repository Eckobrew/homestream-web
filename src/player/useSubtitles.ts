'use client';
import { useEffect, useState, type RefObject } from 'react';
import { apiFetch } from '@/api/client';
import type { SubtitleTrack } from '@/types';
export function useSubtitles(itemId: string | undefined, video: RefObject<HTMLVideoElement | null>) {
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setSubtitles([]); setSelectedSubtitleId(null);
    if (!itemId) return;
    setIsLoadingSubtitles(true);
    apiFetch(`/api/subtitles?itemId=${encodeURIComponent(itemId)}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Subtitles unavailable'); return response.json(); })
      .then((data: { subtitles?: SubtitleTrack[] }) => {
        if (controller.signal.aborted) return;
        const tracks = data.subtitles || [];
        setSubtitles(tracks); setSelectedSubtitleId(tracks.find(track => track.isDefault && !track.isForced)?.id || null);
      }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setIsLoadingSubtitles(false); });
    return () => controller.abort();
  }, [itemId]);
  useEffect(() => {
    const tracks = video.current?.textTracks;
    if (!tracks) return;
    const selected = subtitles.find(track => track.id === selectedSubtitleId);
    for (let index = 0; index < tracks.length; index++) tracks[index].mode = selected?.title === tracks[index].label ? 'showing' : 'disabled';
  }, [selectedSubtitleId, subtitles, video]);
  return { subtitles, selectedSubtitleId, setSelectedSubtitleId, isLoadingSubtitles };
}
