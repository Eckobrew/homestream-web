'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface TvMusicTrack {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  streamUrl: string;
}

export function TvMusicPlayer({
  queue,
  startIndex = 0,
}: {
  queue: TvMusicTrack[];
  startIndex?: number;
}) {
  const [index, setIndex] = useState(() => Math.max(0, Math.min(queue.length - 1, startIndex)));
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveErrorsRef = useRef(0);

  const track = queue[index] || queue[0];

  const clearSkipTimer = () => {
    if (skipTimerRef.current) {
      clearTimeout(skipTimerRef.current);
      skipTimerRef.current = null;
    }
  };

  const handleNext = useCallback(() => {
    clearSkipTimer();
    if (index + 1 < queue.length) {
      setError('');
      setIndex((i) => i + 1);
    }
  }, [index, queue.length]);

  const handlePrev = useCallback(() => {
    clearSkipTimer();
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (index > 0) {
      setError('');
      setIndex((i) => i - 1);
    }
  }, [index]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setError('Playback blocked or failed. Press Play to retry.'));
    } else {
      audio.pause();
    }
  }, []);

  useEffect(() => {
    toggleRef.current?.focus();
    return () => clearSkipTimer();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const code = e.keyCode || e.which;
      if (code === 10009 || code === 27 || code === 461) {
        e.preventDefault();
        audioRef.current?.pause();
        window.history.back();
        return;
      }
      if (code === 415 || e.key === 'MediaPlay') {
        void audioRef.current?.play().catch(() => {});
      } else if (code === 19 || e.key === 'MediaPause') {
        audioRef.current?.pause();
      } else if (e.key === 'MediaPlayPause') {
        togglePlay();
      } else if (e.key === 'MediaTrackNext' || code === 425) {
        handleNext();
      } else if (e.key === 'MediaTrackPrevious' || code === 424) {
        handlePrev();
      } else if (code === 413) {
        audioRef.current?.pause();
        window.history.back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNext, handlePrev, togglePlay]);

  if (!track) {
    return <div style={{ color: '#fff', padding: '40px', textAlign: 'center' }}>No playable tracks found.</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '40px', backgroundColor: '#181818', borderRadius: '16px', border: '2px solid #333333', textAlign: 'center' }}>
      <div style={{ width: '280px', height: '280px', margin: '0 auto 28px auto', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.8)', backgroundColor: '#111111' }}>
        {track.cover ? (
          <img src={track.cover} alt={track.album || track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>
            🎵
          </div>
        )}
      </div>

      <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff', margin: '0 0 8px 0' }}>{track.title}</h1>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1DB954', margin: '0 0 6px 0' }}>{track.artist}</h2>
      {track.album && <p style={{ fontSize: '15px', color: '#aaaaaa', margin: '0 0 8px 0' }}>{track.album}</p>}
      {queue.length > 1 && (
        <p style={{ fontSize: '13px', color: '#888888', margin: '0 0 20px 0' }}>
          Track {index + 1} of {queue.length}
        </p>
      )}

      {error && (
        <p style={{ color: '#f87171', fontSize: '14px', margin: '0 0 16px 0' }}>
          {error}
        </p>
      )}

      <audio
        key={`${index}:${track.streamUrl}`}
        ref={audioRef}
        id="tv-audio"
        controls
        autoPlay
        src={track.streamUrl}
        onPlay={() => { consecutiveErrorsRef.current = 0; setError(''); }}
        onEnded={handleNext}
        onError={() => {
          consecutiveErrorsRef.current += 1;
          const canAdvance = index + 1 < queue.length && consecutiveErrorsRef.current < queue.length;
          if (!canAdvance) {
            setError(consecutiveErrorsRef.current >= queue.length && queue.length > 1
              ? 'Playback failed for all tracks.'
              : 'Track playback failed.');
            return;
          }
          setError('Track failed — advancing to next…');
          clearSkipTimer();
          skipTimerRef.current = setTimeout(() => handleNext(), 2000);
        }}
        style={{ width: '100%', maxWidth: '500px', margin: '0 auto 28px auto', display: 'block' }}
      >
        Your TV browser does not support HTML5 audio playback.
      </audio>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {queue.length > 1 && (
          <button
            type="button"
            tabIndex={0}
            onClick={handlePrev}
            disabled={index === 0}
            className="tv-btn tv-btn-sec"
            style={{ fontSize: '18px', padding: '14px 22px', cursor: 'pointer', opacity: index === 0 ? 0.45 : 1 }}
          >
            ⏮ Prev
          </button>
        )}
        <button
          ref={toggleRef}
          id="tv-audio-toggle"
          type="button"
          tabIndex={0}
          onClick={togglePlay}
          className="tv-btn tv-btn-play"
          style={{ fontSize: '18px', padding: '14px 28px', cursor: 'pointer' }}
        >
          ⏯ Play / Pause
        </button>
        {queue.length > 1 && (
          <button
            type="button"
            tabIndex={0}
            onClick={handleNext}
            disabled={index + 1 >= queue.length}
            className="tv-btn tv-btn-sec"
            style={{ fontSize: '18px', padding: '14px 22px', cursor: 'pointer', opacity: index + 1 >= queue.length ? 0.45 : 1 }}
          >
            ⏭ Next
          </button>
        )}
        <button
          id="tv-audio-back"
          type="button"
          tabIndex={0}
          onClick={() => {
            audioRef.current?.pause();
            window.history.back();
          }}
          className="tv-btn tv-btn-sec"
          style={{ fontSize: '18px', padding: '14px 24px', cursor: 'pointer' }}
        >
          ◀ Return
        </button>
      </div>
    </div>
  );
}
