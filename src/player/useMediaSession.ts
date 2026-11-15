'use client';

import { useEffect, useRef } from 'react';

export interface MediaSessionOptions {
  active: boolean;
  title: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay?: () => void;
  onPause?: () => void;
  onSeekTo?: (time: number) => void;
  onSeekBackward?: (offsetSeconds: number) => void;
  onSeekForward?: (offsetSeconds: number) => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  onStop?: () => void;
}

function resolveArtworkUrl(raw?: string): string {
  if (!raw || raw === 'null') return '';
  if (typeof window === 'undefined') return raw;
  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return raw;
  }
}

export function useMediaSession(options: MediaSessionOptions) {
  const {
    active,
    title,
    artist = '',
    album = '',
    artworkUrl,
    isPlaying,
    currentTime,
    duration,
    onPlay,
    onPause,
    onSeekTo,
    onSeekBackward,
    onSeekForward,
    onPreviousTrack,
    onNextTrack,
    onStop,
  } = options;

  const callbacksRef = useRef({
    onPlay,
    onPause,
    onSeekTo,
    onSeekBackward,
    onSeekForward,
    onPreviousTrack,
    onNextTrack,
    onStop,
  });
  callbacksRef.current = {
    onPlay,
    onPause,
    onSeekTo,
    onSeekBackward,
    onSeekForward,
    onPreviousTrack,
    onNextTrack,
    onStop,
  };

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const resolvedArt = resolveArtworkUrl(artworkUrl);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || 'HomeStream',
        artist,
        album,
        artwork: resolvedArt ? [{ src: resolvedArt }] : [],
      });
    } catch {
      // Ignore environments without MediaMetadata constructor.
    }
  }, [active, title, artist, album, artworkUrl]);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {
      // Ignore unsupported playbackState assignment.
    }
  }, [active, isPlaying]);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (typeof navigator.mediaSession.setPositionState !== 'function') return;
    if (!Number.isFinite(duration) || duration <= 0) return;

    const safePosition = Math.max(0, Math.min(duration, Number.isFinite(currentTime) ? currentTime : 0));
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: safePosition,
      });
    } catch {
      // Ignore invalid position state transitions.
    }
  }, [active, currentTime, duration]);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;
    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Some browsers do not support every action type (e.g. 'stop').
      }
    };

    setHandler('play', () => callbacksRef.current.onPlay?.());
    setHandler('pause', () => callbacksRef.current.onPause?.());
    setHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
        callbacksRef.current.onSeekTo?.(details.seekTime);
      }
    });
    setHandler('seekbackward', (details) => {
      callbacksRef.current.onSeekBackward?.(details.seekOffset ?? 10);
    });
    setHandler('seekforward', (details) => {
      callbacksRef.current.onSeekForward?.(details.seekOffset ?? 10);
    });
    setHandler('previoustrack', callbacksRef.current.onPreviousTrack ? () => callbacksRef.current.onPreviousTrack?.() : null);
    setHandler('nexttrack', callbacksRef.current.onNextTrack ? () => callbacksRef.current.onNextTrack?.() : null);
    setHandler('stop', callbacksRef.current.onStop ? () => callbacksRef.current.onStop?.() : null);

    return () => {
      const actions: MediaSessionAction[] = [
        'play',
        'pause',
        'seekto',
        'seekbackward',
        'seekforward',
        'previoustrack',
        'nexttrack',
        'stop',
      ];
      for (const action of actions) {
        setHandler(action, null);
      }
      try {
        ms.playbackState = 'none';
        ms.metadata = null;
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [active, Boolean(onPreviousTrack), Boolean(onNextTrack), Boolean(onStop)]);
}
