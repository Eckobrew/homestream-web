export type PlaybackState = 'loading' | 'playing' | 'paused' | 'buffering' | 'error' | 'stopped';
export function playbackState(input: { stopped: boolean; error: boolean; loading: boolean; buffering: boolean; playing: boolean }): PlaybackState {
  if (input.stopped) return 'stopped';
  if (input.error) return 'error';
  if (input.loading) return 'loading';
  if (input.buffering) return 'buffering';
  return input.playing ? 'playing' : 'paused';
}
