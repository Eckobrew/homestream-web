'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { MusicTrack } from '@/types';
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
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [error, setError] = useState('');

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setIndex(startIndex);
    setError('');
    setCurrentTime(0);
  }, [tracks, startIndex]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const track = tracks[index];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSkipPrev = () => {
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
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

  const handleSkipNext = () => {
    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * tracks.length);
      setIndex(nextIdx);
      setError('');
    } else if (index < tracks.length - 1) {
      setIndex((i) => i + 1);
      setError('');
    } else if (repeatMode === 'all') {
      setIndex(0);
      setError('');
    }
  };

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

  if (!track) return null;

  return (
    <aside
      className="fixed bottom-0 inset-x-0 z-50 bg-[#121212]/95 backdrop-blur-xl border-t border-neutral-800 text-white px-4 md:px-8 py-3 shadow-2xl transition-all"
      aria-label="Music player"
    >
      <audio
        key={track.id}
        ref={audioRef}
        autoPlay
        preload="metadata"
        src={track.streamUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          if (repeatMode === 'one') {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
          } else if (isShuffle) {
            const nextIdx = Math.floor(Math.random() * tracks.length);
            setIndex(nextIdx);
          } else if (index + 1 < tracks.length) {
            setIndex((i) => i + 1);
          } else if (repeatMode === 'all') {
            setIndex(0);
          } else {
            setIsPlaying(false);
          }
        }}
        onError={() => setError('Track playback failed. Verify server audio connection.')}
      />

      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left Track Info */}
        <div className="flex items-center gap-3 min-w-0 w-1/4">
          <div className="w-12 h-12 rounded bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-700/60 shadow">
            <Music2 size={22} className="text-[#1DB954]" />
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
