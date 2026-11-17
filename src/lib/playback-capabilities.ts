type VideoProbe = { codec: string; mime: string; profiles: Array<[string, string]> };
const videoProbes: VideoProbe[] = [
  { codec: 'h264', mime: 'video/mp4', profiles: [['baseline', 'avc1.42001f'], ['main', 'avc1.4d001f'], ['high', 'avc1.64001f']] },
  { codec: 'hevc', mime: 'video/mp4', profiles: [['main', 'hvc1.1.6.L93.B0'], ['main 10', 'hvc1.2.4.L93.B0']] },
  { codec: 'vp8', mime: 'video/webm', profiles: [['', 'vp8']] },
  { codec: 'vp9', mime: 'video/webm', profiles: [['profile 0', 'vp09.00.31.08'], ['profile 2', 'vp09.02.31.10']] },
  { codec: 'av1', mime: 'video/mp4', profiles: [['main', 'av01.0.05M.08']] },
];
const audioProbes = [
  ['aac', 'audio/mp4; codecs="mp4a.40.2"'], ['mp3', 'audio/mpeg'],
  ['opus', 'audio/webm; codecs="opus"'], ['vorbis', 'audio/webm; codecs="vorbis"'], ['flac', 'audio/flac'],
  ['ac3', 'audio/mp4; codecs="ac-3"'], ['eac3', 'audio/mp4; codecs="ec-3"'],
];
function contentTypes(mime: string, tag: string): string[] {
  const tags = tag.startsWith('hvc1.') ? [tag, tag.replace('hvc1.', 'hev1.')] : [tag];
  return tags.map(codec => `${mime}; codecs="${codec}"`);
}
/** Runtime checks use the playback browser, including in TV mode. */
export function browserPlaybackParameters(canPlay: (mime: string) => string): URLSearchParams {
  const video = videoProbes.filter(probe => probe.profiles.some(([, tag]) =>
    contentTypes(probe.mime, tag).some(type => canPlay(type)))).map(probe => probe.codec);
  const audio = audioProbes.filter(([, mime]) => canPlay(mime)).map(([codec]) => codec);
  return new URLSearchParams({ receiver: 'browser', videoCodecs: video.join(','), audioCodecs: audio.join(',') });
}

/** Add profile and size bounds when the browser provides Media Capabilities. */
export async function browserDecoderParameters(canPlay: (mime: string) => string,
  decodingInfo?: (configuration: MediaDecodingConfiguration) => Promise<Pick<MediaCapabilitiesDecodingInfo, 'supported'>>
): Promise<URLSearchParams> {
  const query = browserPlaybackParameters(canPlay);
  if (!decodingInfo) return query;
  let checked = false;
  const work = Promise.all(videoProbes.map(async probe => {
    const profiles = await Promise.all(probe.profiles.map(async ([profile, tag]) => {
      for (const [width, height] of [[3840, 2160], [1920, 1080], [1280, 720]]) {
        const sizeTag = width === 3840 ? tag.replace(/001f$/, '0033').replace('L93', 'L153').replace('.31.', '.51.').replace('.05M.', '.12M.')
          : width === 1920 ? tag.replace(/001f$/, '0028').replace('L93', 'L120').replace('.31.', '.41.').replace('.05M.', '.08M.') : tag;
        for (const contentType of contentTypes(probe.mime, sizeTag)) {
          if (!canPlay(contentType)) continue;
          try {
            const info = await decodingInfo({ type: 'file', video: { contentType, width, height,
              bitrate: width > 1920 ? 20000000 : 8000000, framerate: 30 } });
            checked = true;
            if (info.supported) return { profile, width, height };
          } catch { /* Older implementations may reject individual configurations. */ }
        }
      }
      return null;
    }));
    const supported = profiles.filter((p): p is NonNullable<typeof p> => p !== null);
    if (!supported.length) return null;
    return { codec: probe.codec, width: Math.min(...supported.map(p => p.width)),
      height: Math.min(...supported.map(p => p.height)), profiles: supported.map(p => p.profile).filter(Boolean) };
  }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([work, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1500); })]);
  clearTimeout(timer);
  const capabilities = result?.filter((p): p is NonNullable<typeof p> => p !== null);
  if (capabilities && (capabilities.length || checked)) {
    query.set('videoCodecs', capabilities.map(p => p.codec).join(','));
    query.set('videoCapabilities', JSON.stringify(capabilities));
  }
  return query;
}
