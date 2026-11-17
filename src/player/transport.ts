import { apiFetch } from '@/api/client';
import { browserDecoderParameters } from '@/lib/playback-capabilities';
export interface SkipSegment { type: 'intro' | 'recap' | 'credits'; startSeconds: number; endSeconds: number; title?: string; }
export interface MediaVersion { id: string; label: string; resolution?: string; videoCodec?: string; audioCodec?: string; fileSize?: number; }
export interface MediaAudioTrack { index: number; title: string; language?: string; }
export type QualityMode = 'auto' | 'original' | '1080p' | '720p';
export interface Delivery { streamUrl: string; isTranscoding: boolean; playMethod?: 'DirectPlay' | 'DirectStream' | 'Transcode'; resolution?: string; selectedVersionId?: string; sourceVideoCodec?: string; sourceAudioCodec?: string; transcodeReasons?: string; durationSeconds?: number; contentType?: string; versions?: MediaVersion[]; skipSegments?: SkipSegment[]; trickplayUrl?: string; audioTracks?: MediaAudioTrack[]; }
export async function negotiatePlayback(itemId: string, canPlay: (mime: string) => string, signal: AbortSignal, fallback = false, versionId?: string, audioIndex?: number, burnSubtitleIndex?: number, quality?: QualityMode): Promise<Delivery> {
  const query = await browserDecoderParameters(canPlay, typeof navigator !== 'undefined' ? navigator.mediaCapabilities?.decodingInfo.bind(navigator.mediaCapabilities) : undefined);
  if (fallback) query.set('forceTranscode', 'true');
  query.set('itemId', itemId);
  if (versionId) query.set('versionId', versionId);
  if (audioIndex !== undefined) query.set('audioIndex', String(audioIndex));
  if (burnSubtitleIndex !== undefined) query.set('burnSubtitleIndex', String(burnSubtitleIndex));
  if (quality === '1080p') { query.set('maxWidth', '1920'); query.set('maxHeight', '1080'); }
  else if (quality === '720p') { query.set('maxWidth', '1280'); query.set('maxHeight', '720'); }
  else if (quality === 'original') { query.set('maxWidth', '3840'); query.set('maxHeight', '2160'); }
  const response = await apiFetch(`/api/playback?${query}`, { signal });
  const data = await response.json();
  if (!response.ok || !data.streamUrl) throw new Error(data.error || 'Playback is unavailable');
  return data;
}
