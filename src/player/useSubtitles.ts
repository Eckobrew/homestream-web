'use client';
import { useEffect, useState, type RefObject } from 'react';
import { apiFetch } from '@/api/client';
import type { SubtitleTrack } from '@/types';
export function useSubtitles(itemId: string | undefined, video: RefObject<HTMLVideoElement | null>, versionId?: string) {
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setSubtitles([]); setSelectedSubtitleId(null);
    if (!itemId) {
      setIsLoadingSubtitles(false);
      return;
    }
    setIsLoadingSubtitles(true);
    const query = new URLSearchParams({ itemId });
    if (versionId) query.set('versionId', versionId);
    apiFetch(`/api/subtitles?${query}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Subtitles unavailable'); return response.json(); })
      .then((data: { subtitles?: SubtitleTrack[]; subtitleMode?: string }) => {
        if (controller.signal.aborted) return;
        const tracks = data.subtitles || [];
        setSubtitles(tracks);
        if (data.subtitleMode === 'none') {
          setSelectedSubtitleId(null);
        } else if (data.subtitleMode === 'forced') {
          setSelectedSubtitleId(tracks.find(track => track.isForced)?.id || null);
        } else {
          setSelectedSubtitleId(tracks.find(track => track.isForced)?.id || tracks.find(track => track.isDefault)?.id || null);
        }
      }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setIsLoadingSubtitles(false); });
    return () => controller.abort();
  }, [itemId, versionId]);
  useEffect(() => {
    const tracks = video.current?.querySelectorAll<HTMLTrackElement>('track[data-subtitle-id]');
    if (!tracks) return;
    for (const track of tracks) track.track.mode = track.dataset.subtitleId === selectedSubtitleId ? 'showing' : 'disabled';
  }, [selectedSubtitleId, subtitles, video]);
  return { subtitles, selectedSubtitleId, setSelectedSubtitleId, isLoadingSubtitles };
}
