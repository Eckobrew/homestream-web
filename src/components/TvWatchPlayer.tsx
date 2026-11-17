'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { browserDecoderParameters } from '@/lib/playback-capabilities';
import type { SkipSegment } from '@/player/transport';
import { useSessionHeartbeat } from '@/player/useSessionHeartbeat';

interface TvSubtitleTrack {
  id?: string;
  src: string;
  language?: string;
  label?: string;
  burnIn?: boolean;
}

interface TrickplayCue {
  start: number;
  end: number;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TvWatchPlayerProps {
  itemId: string;
  playbackExtra?: Record<string, string | number | undefined>;
  streamSrc: string;
  contentType?: string;
  isHls: boolean;
  poster?: string;
  subtitles: TvSubtitleTrack[];
  skipSegments?: SkipSegment[];
  trickplayUrl?: string;
  selectedVersionId?: string;
  durationSeconds?: number;
  nextEpUrl: string | null;
  resumeSeconds: number;
  isYouTube: boolean;
}

function parseVttTimestamp(ts: string): number {
  const parts = ts.trim().split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export function TvWatchPlayer({
  itemId,
  streamSrc,
  isHls,
  poster,
  subtitles,
  skipSegments: initialSkipSegments = [],
  trickplayUrl: initialTrickplayUrl,
  selectedVersionId: initialVersionId,
  durationSeconds: initialDuration = 0,
  nextEpUrl,
  resumeSeconds,
  isYouTube,
  playbackExtra,
}: TvWatchPlayerProps) {
  const [skipSegments, setSkipSegments] = useState(initialSkipSegments);
  const [trickplayUrl, setTrickplayUrl] = useState(initialTrickplayUrl);
  const [selectedVersionId, setSelectedVersionId] = useState(initialVersionId);
  const [durationSeconds, setDurationSeconds] = useState(initialDuration);
  const [playbackError, setPlaybackError] = useState('');
  const [fallback, setFallback] = useState(false);
  const decoderQuery = useRef<URLSearchParams | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const logicalOffsetRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);
  const [activeStreamSrc, setActiveStreamSrc] = useState(streamSrc);
  const [activeIsHls, setActiveIsHls] = useState(isHls);
  const [activeSkip, setActiveSkip] = useState<SkipSegment | null>(null);
  const [trickplayCues, setTrickplayCues] = useState<TrickplayCue[]>([]);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlayingState, setIsPlayingState] = useState(true);
  const [autoplayEpisodes, setAutoplayEpisodes] = useState(true);
  const autoplayRef = useRef(true);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number>(() => (subtitles.some((s) => !s.burnIn && s.src) ? 0 : -1));

  useEffect(() => {
    const saved = typeof window !== 'undefined' && window.localStorage.getItem('homestream-autoplay') !== 'false';
    setAutoplayEpisodes(saved);
    autoplayRef.current = saved;
  }, []);

  const toggleAutoplay = useCallback(() => {
    setAutoplayEpisodes((prev) => {
      const next = !prev;
      autoplayRef.current = next;
      try { window.localStorage.setItem('homestream-autoplay', String(next)); } catch {}
      return next;
    });
  }, []);

  const softSubtitles = subtitles.filter((sub) => !sub.burnIn && sub.src);

  const cycleSubtitles = useCallback(() => {
    const video = videoRef.current;
    if (!video || softSubtitles.length === 0) return;
    setActiveSubtitleIndex((prev) => {
      const next = prev + 1 >= softSubtitles.length ? -1 : prev + 1;
      for (let i = 0; i < video.textTracks.length; i += 1) {
        video.textTracks[i].mode = i === next ? 'showing' : 'disabled';
      }
      return next;
    });
  }, [softSubtitles.length]);

  useEffect(() => {
    setActiveStreamSrc(streamSrc);
    setActiveIsHls(isHls);
    logicalOffsetRef.current = 0;
    pendingSeekRef.current = null;
  }, [streamSrc, isHls]);

  useEffect(() => {
    if (isYouTube) return;
    const controller = new AbortController();
    setPlaybackError('');
    void (async () => {
      const video = videoRef.current;
      if (!video) return;
      const query = await browserDecoderParameters(type => video.canPlayType(type),
        navigator.mediaCapabilities?.decodingInfo.bind(navigator.mediaCapabilities));
      if (controller.signal.aborted) return;
      decoderQuery.current = query;
      query.set('itemId', itemId);
      for (const [key, value] of Object.entries(playbackExtra || {})) {
        if (value !== undefined) query.set(key, String(value));
      }
      if (fallback) query.set('forceTranscode', 'true');
      if (resumeSeconds > 0) query.set('startTimeTicks', String(Math.floor(resumeSeconds * 10000000)));
      const response = await fetch(`/api/v1/playback?${query}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.streamUrl) throw new Error(data.error || 'Playback is unavailable');
      if (controller.signal.aborted) return;
      const url = String(data.streamUrl).replace(/^\/api\/native\//, '/api/v1/native/');
      const hls = data.transport === 'HLS' || /mpegurl/i.test(data.contentType || '') || url.includes('.m3u8');
      logicalOffsetRef.current = hls ? Number(data.startTimeTicks || 0) / 10000000 : 0;
      pendingSeekRef.current = Math.max(0, resumeSeconds - logicalOffsetRef.current);
      setSkipSegments(data.skipSegments || []);
      setTrickplayUrl(data.trickplayUrl);
      setSelectedVersionId(data.selectedVersionId);
      setDurationSeconds(data.durationSeconds || 0);
      setActiveIsHls(hls);
      setActiveStreamSrc(url);
    })().catch(error => { if (!controller.signal.aborted) setPlaybackError(error.message || 'Playback is unavailable'); });
    return () => controller.abort();
  }, [itemId, isYouTube, playbackExtra, resumeSeconds, fallback]);

  useEffect(() => {
    setTrickplayCues([]);
    if (!trickplayUrl) return;
    const apiPath = trickplayUrl.startsWith('/api/native/')
      ? trickplayUrl.replace('/api/', '/api/v1/')
      : trickplayUrl;
    const ctrl = new AbortController();
    fetch(apiPath, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        if (!text || ctrl.signal.aborted) return;
        const lines = text.split(/\r?\n/);
        const parsed: TrickplayCue[] = [];
        for (let i = 0; i < lines.length; i++) {
          const tsMatch = /^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+-->\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/.exec(lines[i]);
          if (!tsMatch) continue;
          const nextLine = (lines[i + 1] || '').trim();
          const xyMatch = /#xywh=(\d+),(\d+),(\d+),(\d+)/.exec(nextLine);
          if (!xyMatch) continue;
          const rawSrc = nextLine.split('#')[0];
          const src = rawSrc.startsWith('/api/native/') ? rawSrc.replace('/api/', '/api/v1/') : rawSrc;
          parsed.push({
            start: parseVttTimestamp(tsMatch[1]),
            end: parseVttTimestamp(tsMatch[2]),
            src,
            x: Number(xyMatch[1]),
            y: Number(xyMatch[2]),
            w: Number(xyMatch[3]),
            h: Number(xyMatch[4]),
          });
        }
        setTrickplayCues(parsed);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [trickplayUrl]);

  const seekToLogical = useCallback(async (targetSec: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, durationSeconds > 0 ? Math.min(durationSeconds - 0.5, targetSec) : targetSec);
    const localTarget = clamped - logicalOffsetRef.current;
    let inSeekable = false;
    try {
      for (let i = 0; i < video.seekable.length; i++) {
        if (localTarget >= video.seekable.start(i) && localTarget <= video.seekable.end(i)) {
          inSeekable = true;
          break;
        }
      }
    } catch {}

    if (!activeIsHls || inSeekable || isYouTube) {
      if (localTarget >= 0) {
        video.currentTime = localTarget;
        return;
      }
    }

    // Out-of-range HLS seek (e.g. jumping to credits end): renegotiate at startTimeTicks with native-tv receiver
    try {
      const q = new URLSearchParams(decoderQuery.current || { receiver: 'browser' });
      q.set('itemId', itemId);
      if (fallback) q.set('forceTranscode', 'true');
      q.set('startTimeTicks', String(Math.floor(clamped * 10_000_000)));
      if (selectedVersionId) q.set('versionId', selectedVersionId);
      const res = await fetch(`/api/v1/playback?${q}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.streamUrl) {
        const nextUrl = String(data.streamUrl).startsWith('/api/native/')
          ? String(data.streamUrl).replace('/api/', '/api/v1/')
          : String(data.streamUrl);
        const nextIsHls = Boolean(data.isTranscoding || nextUrl.includes('.m3u8'));
        const serverStartSec = typeof data.startTimeTicks === 'number'
          ? data.startTimeTicks / 10_000_000
          : (nextIsHls ? clamped : 0);
        if (nextIsHls && serverStartSec > 0) {
          logicalOffsetRef.current = serverStartSec;
          pendingSeekRef.current = Math.max(0, clamped - serverStartSec);
        } else {
          logicalOffsetRef.current = 0;
          pendingSeekRef.current = clamped;
        }
        setActiveIsHls(nextIsHls);
        setActiveStreamSrc(nextUrl);
      }
    } catch {}
  }, [activeIsHls, durationSeconds, isYouTube, itemId, selectedVersionId, fallback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeStreamSrc) return;

    let hls: Hls | null = null;
    let lastReport = 0;
    let stopped = false;

    const reportProgress = (ending: boolean) => {
      const now = Date.now();
      if (stopped || (!ending && now - lastReport < 8000)) return;
      if (ending) stopped = true;
      lastReport = now;
      try {
        const dur = durationSeconds > 0 ? durationSeconds : (Number.isFinite(video.duration) ? video.duration : 0);
        const cur = logicalOffsetRef.current + (video.currentTime || 0);
        const payload = JSON.stringify(
          isYouTube
            ? {
                videoId: itemId,
                positionSeconds: Math.floor(cur),
                durationSeconds: Math.floor(dur),
                completed: video.ended,
              }
            : {
                itemId,
                positionTicks: Math.floor(cur * 10000000),
                isPaused: video.paused,
                isStopped: ending,
              }
        );
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            isYouTube ? '/api/v1/youtube/progress' : '/api/v1/playback/progress',
            payload
          );
        }
      } catch {}
    };

    const startPlayback = () => {
      video.play().catch(() => {});
    };

    const effectiveResume = pendingSeekRef.current !== null
      ? pendingSeekRef.current
      : (logicalOffsetRef.current > 0 ? 0 : resumeSeconds);
    pendingSeekRef.current = null;
    if (activeIsHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startPosition: effectiveResume > 0 ? effectiveResume : -1,
      });
      hlsRef.current = hls;
      hls.loadSource(activeStreamSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
      hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) { if (!fallback) setFallback(true); else setPlaybackError('Playback could not start on this device.'); } });
    } else {
      hlsRef.current = null;
      video.src = activeStreamSrc;
      if (effectiveResume > 0) {
        const restore = () => {
          if (!Number.isFinite(video.duration) || effectiveResume < video.duration) video.currentTime = effectiveResume;
        };
        if (video.readyState > 0) restore();
        else video.addEventListener('loadedmetadata', restore, { once: true });
      }
      startPlayback();
    }

    const handleKeys = (e: KeyboardEvent) => {
      const code = e.keyCode || e.which;
      if (code === 10009 || code === 27 || code === 461) {
        e.preventDefault();
        video.pause();
        reportProgress(true);
        window.history.back();
        return;
      }
      if (code === 415) void video.play().catch(() => {});
      if (code === 19) {
        video.pause();
        reportProgress(false);
      }
      if (code === 413) {
        video.pause();
        reportProgress(true);
        window.history.back();
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const curLogical = logicalOffsetRef.current + (video.currentTime || 0);
        const nextLogical = Math.max(0, curLogical + (e.key === 'ArrowRight' ? 10 : -10));
        setPreviewTime(nextLogical);
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        previewTimerRef.current = setTimeout(() => setPreviewTime(null), 2500);
      }
    };

    const onTimeUpdate = () => {
      reportProgress(false);
      const curLogical = logicalOffsetRef.current + (video.currentTime || 0);
      const seg = skipSegments.find((s) => curLogical >= s.startSeconds && curLogical < s.endSeconds - 1) || null;
      setActiveSkip(seg);
    };
    const onPause = () => {
      setIsPlayingState(false);
      reportProgress(false);
    };
    const onPlay = () => setIsPlayingState(true);
    const onPageHide = () => reportProgress(true);
    const onEnded = () => {
      reportProgress(true);
      if (autoplayRef.current && nextEpUrl) window.location.href = nextEpUrl;
    };

    video.focus();
    window.addEventListener('keydown', handleKeys);
    window.addEventListener('pagehide', onPageHide);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('pause', onPause);
    video.addEventListener('play', onPlay);
    video.addEventListener('ended', onEnded);

    return () => {
      window.removeEventListener('keydown', handleKeys);
      window.removeEventListener('pagehide', onPageHide);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('ended', onEnded);
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      if (hls) hls.destroy();
    };
  }, [activeIsHls, activeStreamSrc, durationSeconds, isYouTube, itemId, nextEpUrl, resumeSeconds, skipSegments, fallback]);

  useSessionHeartbeat({
    active: true,
    mediaId: itemId,
    mediaType: 'video',
    title: itemId,
    deviceName: 'HomeStream TV Web',
    deviceType: 'web',
    isPlaying: isPlayingState,
    positionMs: (logicalOffsetRef.current + (videoRef.current?.currentTime || 0)) * 1000,
    durationMs: durationSeconds * 1000,
    canSeek: true,
    canSkipNext: Boolean(nextEpUrl),
    onCommand: (cmd) => {
      const video = videoRef.current;
      if (!video) return;
      switch (cmd.type) {
        case 'play':
          void video.play().catch(() => {});
          break;
        case 'pause':
          video.pause();
          break;
        case 'togglePlayPause':
          if (video.paused) void video.play().catch(() => {});
          else video.pause();
          break;
        case 'stop':
          window.history.back();
          break;
        case 'next':
          if (nextEpUrl) window.location.href = nextEpUrl;
          break;
        case 'seekTo':
          if (typeof cmd.positionMs === 'number') void seekToLogical(cmd.positionMs / 1000);
          break;
        case 'seekBy':
          if (typeof cmd.deltaMs === 'number') {
            const cur = logicalOffsetRef.current + (video.currentTime || 0);
            void seekToLogical(Math.max(0, cur + cmd.deltaMs / 1000));
          }
          break;
        case 'muteToggle':
          video.muted = !video.muted;
          break;
        case 'volumeUp':
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case 'volumeDown':
          video.volume = Math.max(0, video.volume - 0.1);
          break;
      }
    },
  });

  const activeCue = previewTime !== null
    ? trickplayCues.find((c) => previewTime >= c.start && previewTime < c.end) || null
    : null;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {playbackError && <p role="alert">{playbackError}</p>}
      <video
        onError={() => { if (!isYouTube && !fallback) setFallback(true); else setPlaybackError('Playback could not start on this device.'); }}
        ref={videoRef}
        id="tv-video"
        controls
        autoPlay
        playsInline
        preload="auto"
        poster={poster || ''}
        style={{ width: '100%', height: '100%', backgroundColor: '#000000' }}
      >
        {subtitles.filter((sub) => !sub.burnIn && sub.src).map((sub, i) => (
          <track
            key={sub.id || i}
            kind="subtitles"
            src={sub.src}
            srcLang={sub.language}
            label={sub.label}
            default={i === 0}
          />
        ))}
        Your TV browser does not support HTML5 video playback.
      </video>

      {!isYouTube && (
        <div
          style={{
            position: 'absolute',
            top: '24px',
            right: '36px',
            zIndex: 30,
            display: 'flex',
            gap: '10px',
          }}
        >
          {softSubtitles.length > 0 && (
            <button
              type="button"
              tabIndex={0}
              onClick={cycleSubtitles}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(20,20,20,0.85)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '15px',
                border: '1px solid rgba(255,255,255,0.28)',
                cursor: 'pointer',
              }}
            >
              {activeSubtitleIndex >= 0
                ? `Subtitles: ${softSubtitles[activeSubtitleIndex]?.label || softSubtitles[activeSubtitleIndex]?.language || 'On'}`
                : 'Subtitles: Off'}
            </button>
          )}
          <button
            type="button"
            tabIndex={0}
            onClick={toggleAutoplay}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              backgroundColor: autoplayEpisodes ? 'rgba(229,9,20,0.9)' : 'rgba(20,20,20,0.85)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '15px',
              border: '1px solid rgba(255,255,255,0.28)',
              cursor: 'pointer',
            }}
          >
            {`Autoplay: ${autoplayEpisodes ? 'On' : 'Off'}`}
          </button>
        </div>
      )}

      {activeSkip && (
        <button
          type="button"
          tabIndex={0}
          onClick={() => void seekToLogical(activeSkip.endSeconds)}
          style={{
            position: 'absolute',
            right: '36px',
            bottom: '96px',
            zIndex: 30,
            padding: '12px 22px',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontWeight: 700,
            fontSize: '18px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {activeSkip.type === 'credits'
            ? 'Skip Credits →'
            : activeSkip.type === 'recap'
              ? 'Skip Recap →'
              : 'Skip Intro →'}
        </button>
      )}

      {activeCue && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '110px',
            transform: 'translateX(-50%)',
            width: `${activeCue.w}px`,
            height: `${activeCue.h}px`,
            backgroundImage: `url(${activeCue.src})`,
            backgroundPosition: `-${activeCue.x}px -${activeCue.y}px`,
            backgroundRepeat: 'no-repeat',
            borderRadius: '8px',
            border: '2px solid rgba(255,255,255,0.8)',
            zIndex: 30,
          }}
        />
      )}
    </div>
  );
}
