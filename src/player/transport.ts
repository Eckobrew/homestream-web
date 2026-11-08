import { apiFetch } from '@/api/client';
import { browserPlaybackParameters } from '@/lib/playback-capabilities';
export interface Delivery { streamUrl: string; isTranscoding: boolean; durationSeconds?: number; contentType?: string; }
export async function negotiatePlayback(itemId: string, canPlay: (mime: string) => string, signal: AbortSignal, fallback = false): Promise<Delivery> {
  const query = fallback ? new URLSearchParams({ forceTranscode: 'true' }) : browserPlaybackParameters(canPlay);
  query.set('itemId', itemId);
  const response = await apiFetch(`/api/playback?${query}`, { signal });
  const data = await response.json();
  if (!response.ok || !data.streamUrl) throw new Error(data.error || 'Playback is unavailable');
  return data;
}
