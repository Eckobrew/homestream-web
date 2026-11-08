'use client';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { apiFetch } from '@/api/client';
import { progressSession } from './progress-session';
export function useProgress(itemId: string | undefined, video: RefObject<HTMLVideoElement | null>, playing: boolean, position?: () => number) {
  const positionRef = useRef(position); positionRef.current = position;
  const playingRef = useRef(playing); playingRef.current = playing;
  const session = useRef<ReturnType<typeof progressSession> | null>(null);
  useEffect(() => {
    if (!itemId) return;
    const element = video.current;
    const current = progressSession(itemId, () => positionRef.current ? positionRef.current() : element?.currentTime || 0, () => !playingRef.current, value => {
      const body = JSON.stringify(value);
      if (value.isStopped && navigator.sendBeacon?.('/api/v1/playback/progress', new Blob([body], { type: 'application/json' }))) return;
      void apiFetch('/api/playback/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: value.isStopped }).catch(() => {});
    });
    session.current = current;
    const timer = setInterval(() => { if (playingRef.current) current.report(); }, 10000);
    const stop = () => current.report(true);
    window.addEventListener('pagehide', stop);
    return () => { clearInterval(timer); window.removeEventListener('pagehide', stop); stop(); if (session.current === current) session.current = null; };
  }, [itemId, video]);
  return useCallback((stopped = false, ticks?: number) => session.current?.report(stopped, ticks), []);
}
