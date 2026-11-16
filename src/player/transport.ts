import { apiFetch } from '@/api/client';
import { browserPlaybackParameters } from '@/lib/playback-capabilities';
export interface SkipSegment { type: 'intro' | 'credits'; startSeconds: number; endSeconds: number; title?: string; }
export interface MediaVersion { id: string; label: string; resolution?: string; videoCodec?: string; audioCodec?: string; fileSize?: number; }
export interface Delivery { streamUrl: string; isTranscoding: boolean; durationSeconds?: number; contentType?: string; versions?: MediaVersion[]; skipSegments?: SkipSegment[]; trickplayUrl?: string; }
export async function negotiatePlayback(itemId: string, canPlay: (mime: string) => string, signal: AbortSignal, fallback = false, versionId?: string): Promise<Delivery> {
  const query = fallback ? new URLSearchParams({ forceTranscode: 'true' }) : browserPlaybackParameters(canPlay);
  query.set('itemId', itemId);
  if (versionId) query.set('versionId', versionId);
  const response = await apiFetch(`/api/playback?${query}`, { signal });
  const data = await response.json();
  if (!response.ok || !data.streamUrl) throw new Error(data.error || 'Playback is unavailable');
  return data;
}
