'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { MusicTrack } from '@/types';
import { useMediaSession } from '@/player/useMediaSession';
import { useSessionHeartbeat } from '@/player/useSessionHeartbeat';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  Music2,
  AlertCircle,
  Shuffle,
  Repeat,
  Repeat1,
} from 'lucide-react';

interface MusicPlayerProps {
  tracks: MusicTrack[];
  startIndex: number;
  onClose: () => void;
}

export function MusicPlayer({ tracks, startIndex, onClose }: MusicPlayerProps) {
  const [index, setIndex] = useState(startIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (typeof window === 'undefined') return 0.8;
    const saved = Number(window.localStorage.getItem('homestream.music.volume'));
    return Number.isFinite(saved) && saved >= 0 && saved <= 1 ? saved : 0.8;
  });
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('homestream.music.muted') === 'true';
  });
  const [isShuffle, setIsShuffle] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('homestream.music.shuffle') === 'true';
  });
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>(() => {
    if (typeof window === 'undefined') return 'off';
    const saved = window.localStorage.getItem('homestream.music.repeat');
    return saved === 'all' || saved === 'one' ? saved : 'off';
  });
  const [error, setError] = useState('');

  const audioRef = useRef<HTMLAudioElement>(null);
  const shuffleHistoryRef = useRef<number[]>([]);
  const errorSkipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveErrorsRef = useRef(0);

  useEffect(() => {
    setIndex(startIndex);
    shuffleHistoryRef.current = [];
    consecutiveErrorsRef.current = 0;
    setError('');
    setCurrentTime(0);
  }, [tracks, startIndex]);

  useEffect(() => {
    return () => {
      if (errorSkipTimerRef.current) clearTimeout(errorSkipTimerRef.current);
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('homestream.music.shuffle', String(isShuffle));
      window.localStorage.setItem('homestream.music.repeat', repeatMode);
    } catch {}
  }, [isShuffle, repeatMode]);

  const track = tracks[index];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      audioRef.current.volume = isMuted ? 0 : volume;
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('homestream.music.volume', String(volume));
        window.localStorage.setItem('homestream.music.muted', String(isMuted));
      } catch {}
    }
  }, [volume, isMuted, track?.id]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const pickNextShuffleIndex = useCallback((current: number) => {
    if (tracks.length <= 1) return current;
    const candidates = tracks.map((_, i) => i).filter((i) => i !== current);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }, [tracks]);

  const handleSkipPrev = () => {
    if (errorSkipTimerRef.current) { clearTimeout(errorSkipTimerRef.current); errorSkipTimerRef.current = null; }
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
    } else if (isShuffle && shuffleHistoryRef.current.length > 0) {
      const prevIdx = shuffleHistoryRef.current.pop()!;
      setIndex(prevIdx);
      setError('');
    } else if (index > 0) {
      setIndex((i) => i - 1);
      setError('');
    } else if (repeatMode === 'all') {
      setIndex(tracks.length - 1);
      setError('');
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleSkipNext = useCallback(() => {
    if (errorSkipTimerRef.current) { clearTimeout(errorSkipTimerRef.current); errorSkipTimerRef.current = null; }
    if (isShuffle) {
      const nextIdx = pickNextShuffleIndex(index);
      if (nextIdx !== index) shuffleHistoryRef.current.push(index);
      setIndex(nextIdx);
      setError('');
    } else if (index < tracks.length - 1) {
      setIndex((i) => i + 1);
      setError('');
    } else if (repeatMode === 'all') {
      setIndex(0);
      setError('');
    }
  }, [index, isShuffle, pickNextShuffleIndex, repeatMode, tracks.length]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (secs?: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const effectiveDuration = duration || track?.durationSeconds || 0;

  useMediaSession({
    active: Boolean(track),
    title: track?.title || '',
    artist: track?.artist || '',
    album: track?.album || '',
    artworkUrl: track?.coverUrl,
    isPlaying,
    currentTime,
    duration: effectiveDuration,
    onPlay: () => {
      audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
    },
    onPause: () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    },
    onSeekTo: (time) => {
      const clamped = Math.max(0, effectiveDuration > 0 ? Math.min(time, effectiveDuration) : time);
      setCurrentTime(clamped);
      if (audioRef.current) audioRef.current.currentTime = clamped;
    },
    onSeekBackward: (offset) => {
      const next = Math.max(0, currentTime - offset);
      setCurrentTime(next);
      if (audioRef.current) audioRef.current.currentTime = next;
    },
    onSeekForward: (offset) => {
      const next = effectiveDuration > 0 ? Math.min(effectiveDuration, currentTime + offset) : currentTime + offset;
      setCurrentTime(next);
      if (audioRef.current) audioRef.current.currentTime = next;
    },
    onPreviousTrack: handleSkipPrev,
    onNextTrack: handleSkipNext,
    onStop: onClose,
  });

  useSessionHeartbeat({
    active: Boolean(track),
    mediaId: track?.id || '',
    mediaType: 'music',
    title: track?.title || '',
    subtitle: track ? [track.artist, track.album].filter(Boolean).join(' · ') : '',
    artworkUrl: track?.coverUrl,
    isPlaying,
    positionMs: currentTime * 1000,
    durationMs: effectiveDuration * 1000,
    canSeek: effectiveDuration > 0,
    canSkipNext: tracks.length > 1,
    canSkipPrev: tracks.length > 1,
    onCommand: (cmd) => {
      switch (cmd.type) {
        case 'play':
          if (!isPlaying) audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
          break;
        case 'pause':
          audioRef.current?.pause();
          setIsPlaying(false);
          break;
        case 'togglePlayPause':
          togglePlayPause();
          break;
        case 'stop':
          onClose();
          break;
        case 'seekTo':
          if (typeof cmd.positionMs === 'number') {
            const t = Math.max(0, cmd.positionMs / 1000);
            const clamped = effectiveDuration > 0 ? Math.min(t, effectiveDuration) : t;
            setCurrentTime(clamped);
            if (audioRef.current) audioRef.current.currentTime = clamped;
          }
          break;
        case 'seekBy':
          if (typeof cmd.deltaMs === 'number') {
            const t = Math.max(0, currentTime + cmd.deltaMs / 1000);
            const clamped = effectiveDuration > 0 ? Math.min(t, effectiveDuration) : t;
            setCurrentTime(clamped);
            if (audioRef.current) audioRef.current.currentTime = clamped;
          }
          break;
        case 'next':
          handleSkipNext();
          break;
        case 'previous':
          handleSkipPrev();
          break;
      }
    },
  });

  if (!track) return null;

  return (
    <aside
      className="fixed bottom-0 inset-x-0 z-50 bg-[#121212]/95 backdrop-blur-xl border-t border-neutral-800 text-white px-4 md:px-8 py-3 shadow-2xl transition-all"
      aria-label="Music player"
    >
      <audio
        key={`${index}:${track.id}`}
        ref={audioRef}
        autoPlay
        preload="metadata"
        src={track.streamUrl}
        onPlay={() => { setIsPlaying(true); consecutiveErrorsRef.current = 0; setError(''); }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => { consecutiveErrorsRef.current = 0; handleLoadedMetadata(); }}
        onEnded={() => {
          if (repeatMode === 'one') {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
          } else if (isShuffle) {
            const nextIdx = pickNextShuffleIndex(index);
            if (nextIdx !== index) shuffleHistoryRef.current.push(index);
            setIndex(nextIdx);
          } else if (index + 1 < tracks.length) {
            setIndex((i) => i + 1);
          } else if (repeatMode === 'all') {
            setIndex(0);
          } else {
            setIsPlaying(false);
          }
        }}
        onError={() => {
          consecutiveErrorsRef.current += 1;
          const canAdvance = tracks.length > 1
            && consecutiveErrorsRef.current < tracks.length
            && (isShuffle || repeatMode === 'all' || index + 1 < tracks.length);
          if (!canAdvance) {
            setIsPlaying(false);
            setError(consecutiveErrorsRef.current >= tracks.length && tracks.length > 1
              ? 'All tracks failed to load. Verify server connection and retry.'
              : 'Track playback failed. Verify server audio connection.');
            return;
          }
          setError('Track failed to load — skipping to next…');
          if (errorSkipTimerRef.current) clearTimeout(errorSkipTimerRef.current);
          errorSkipTimerRef.current = setTimeout(() => {
            handleSkipNext();
          }, 2500);
        }}
      />

      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left Track Info */}
        <div className="flex items-center gap-3 min-w-0 w-1/4">
          <div className="w-12 h-12 rounded bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-700/60 shadow overflow-hidden relative">
            {track.coverUrl ? (
              <img
                src={track.coverUrl}
                alt={track.album || track.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fb) fb.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className={`w-full h-full flex items-center justify-center ${track.coverUrl ? 'hidden' : ''}`}
            >
              <Music2 size={22} className="text-[#1DB954]" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white truncate hover:underline cursor-pointer">
              {track.title}
            </p>
            <p className="text-xs text-neutral-400 truncate hover:text-white cursor-pointer transition">
              {track.artist} • {track.album}
            </p>
          </div>
        </div>

        {/* Center Controls & Scrubber */}
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-xl">
          <div className="flex items-center gap-4">
            <button
              aria-label={isShuffle ? 'Disable shuffle' : 'Enable shuffle'}
              onClick={() => setIsShuffle((s) => !s)}
              className={`p-1 transition ${isShuffle ? 'text-[#1DB954]' : 'text-neutral-400 hover:text-white'}`}
              title={isShuffle ? 'Shuffle on' : 'Shuffle off'}
            >
              <Shuffle size={18} />
            </button>

            <button
              aria-label="Previous track"
              disabled={index === 0 && currentTime < 3 && repeatMode !== 'all'}
              onClick={handleSkipPrev}
              className="text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition"
            >
              <SkipBack size={20} />
            </button>

            <button
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={togglePlayPause}
              className="w-9 h-9 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-lg transition"
            >
              {isPlaying ? (
                <Pause size={18} className="fill-black" />
              ) : (
                <Play size={18} className="fill-black ml-0.5" />
              )}
            </button>

            <button
              aria-label="Next track"
              disabled={!isShuffle && repeatMode !== 'all' && index >= tracks.length - 1}
              onClick={handleSkipNext}
              className="text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition"
            >
              <SkipForward size={20} />
            </button>

            <button
              aria-label={`Repeat mode: ${repeatMode}`}
              onClick={() => setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))}
              className={`p-1 transition ${repeatMode !== 'off' ? 'text-[#1DB954]' : 'text-neutral-400 hover:text-white'}`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
          </div>

          {/* Time Scrubber */}
          <div className="w-full flex items-center gap-2 text-[11px] font-mono text-neutral-400">
            <span className="w-9 text-right">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || track.durationSeconds || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-[#1DB954] hover:accent-[#1ed760]"
            />
            <span className="w-9">{formatTime(duration || track.durationSeconds)}</span>
          </div>
        </div>

        {/* Right Volume & Close */}
        <div className="flex items-center justify-end gap-3 w-1/4">
          <div className="hidden sm:flex items-center gap-2">
            <button
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              onClick={() => setIsMuted((m) => !m)}
              className="text-neutral-400 hover:text-white transition"
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                setIsMuted(false);
              }}
              className="w-20 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-[#1DB954]"
            />
          </div>

          <button
            aria-label="Close music player"
            onClick={() => {
              audioRef.current?.pause();
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-center gap-2 text-xs text-red-400 mt-2">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </aside>
  );
}
