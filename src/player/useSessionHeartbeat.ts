'use client';

import { useEffect, useRef } from 'react';
import { apiFetch } from '@/api/client';

export interface SessionCommand {
  type: string;
  positionMs?: number;
  deltaMs?: number;
}

export interface SessionHeartbeatOptions {
  active: boolean;
  mediaId: string;
  mediaType: 'video' | 'music';
  title: string;
  subtitle?: string;
  artworkUrl?: string;
  deviceName?: string;
  deviceType?: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  canSeek?: boolean;
  canSkipNext?: boolean;
  canSkipPrev?: boolean;
  onCommand?: (command: SessionCommand) => void;
}

function getWebDeviceId(): string {
  if (typeof window === 'undefined') return 'web-ssr';
  const key = 'homestream-web-device-id';
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = `web-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'web-browser';
  }
}

export function useSessionHeartbeat(options: SessionHeartbeatOptions) {
  const latestRef = useRef(options);
  latestRef.current = options;

  useEffect(() => {
    if (!options.active || !options.title) return;

    const sendHeartbeat = (isStopped = false) => {
      const current = latestRef.current;
      apiFetch('/api/v1/sessions/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: getWebDeviceId(),
          deviceName: current.deviceName || 'Web Browser',
          deviceType: current.deviceType || 'web',
          mediaId: current.mediaId,
          mediaType: current.mediaType,
          title: current.title,
          subtitle: current.subtitle || '',
          artworkUrl: current.artworkUrl || '',
          isPlaying: isStopped ? false : current.isPlaying,
          positionMs: Math.max(0, Math.floor(current.positionMs || 0)),
          durationMs: Math.max(0, Math.floor(current.durationMs || 0)),
          canSeek: Boolean(current.canSeek),
          canSkipNext: Boolean(current.canSkipNext),
          canSkipPrev: Boolean(current.canSkipPrev),
          isStopped,
        }),
      }).catch(() => {});
    };

    sendHeartbeat(false);
    const interval = setInterval(() => sendHeartbeat(false), 5000);

    let es: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      try {
        es = new EventSource(`/api/v1/sessions/commands?deviceId=${encodeURIComponent(getWebDeviceId())}`);
        const handleEvent = (ev: MessageEvent) => {
          try {
            const parsed = JSON.parse(ev.data);
            const cmd = parsed?.command || parsed;
            if (cmd && typeof cmd.type === 'string') {
              latestRef.current.onCommand?.(cmd);
            }
          } catch {
            // Ignore malformed or heartbeat SSE payloads.
          }
        };
        es.addEventListener('command', handleEvent);
        es.onmessage = handleEvent;
      } catch {
        // Ignore EventSource errors when remote command stream is unavailable.
      }
    }

    return () => {
      clearInterval(interval);
      es?.close();
      sendHeartbeat(true);
    };
  }, [options.active, options.mediaId, options.mediaType, options.title]);
}
