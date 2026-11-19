'use client';
import { browserDecoderParameters } from '@/lib/playback-capabilities';
import { apiFetch } from '@/api/client';

import { usePlaybackFallback } from '@/player/usePlaybackFallback';
import { useMediaDelivery } from '@/player/useMediaDelivery';
import { useCastSession } from '@/player/useCastSession';
import { useSubtitles } from '@/player/useSubtitles';
import { useProgress } from '@/player/useProgress';
import { useMediaSession } from '@/player/useMediaSession';
import { useSessionHeartbeat } from '@/player/useSessionHeartbeat';
import { negotiatePlayback, MediaAudioTrack, MediaVersion, SkipSegment, type QualityMode } from '@/player/transport';
import { playbackState } from '@/player/state';
import { isTorrentStreamUrl, torrentStreamUrl, tmdbIdFor, torrentStreamStartSeconds, seekTorrentStreamUrl } from '@/player/torrent-stream';
import { castReceiverId, castStartupState, clearCastIdle, DEFAULT_RECEIVER_ID, requestCastCapabilities, selectCastSubtitles } from '@/player/cast';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipForward,
  Subtitles,
  AudioLines,
  Settings,
  Check,
  X,
  AlertCircle,
  Cast,
  Download,
  Users,
  ListVideo,
} from 'lucide-react';
import { MediaItem, Episode, SubtitleTrack } from '@/types';

interface BuiltinPlayerProps {
  item: MediaItem;
  episode?: Episode;
  onClose: () => void;
  onNextEpisode?: () => void;
}

export const BuiltinPlayer: React.FC<BuiltinPlayerProps> = ({
  item,
  episode,
  onClose,
  onNextEpisode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const castLoadRef = useRef<(compatible?: boolean) => Promise<void>>(async () => {});
  const castCompatibilityRef = useRef(false);
  const castLoadGeneration = useRef(0);
  const castStartup = useRef<{ position: number; autoplay: boolean; attempt: number; deadline: number } | null>(null);
  const [castError, setCastError] = useState(false);
  const cancelCastLoad = useCallback(() => {
    ++castLoadGeneration.current;
    castStartup.current = null;
  }, []);
  useEffect(() => cancelCastLoad, [cancelCastLoad]);
  const syncCastVolume = useCallback((level: number, muted: boolean) => {
    if (Number.isFinite(level)) setVolume(level);
    setIsMuted(muted);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [stopped, setStopped] = useState(false);
  const [showEndOverlay, setShowEndOverlay] = useState(false);
  const [endRecommendations, setEndRecommendations] = useState<MediaItem[]>([]);
  const [endTrailerKey, setEndTrailerKey] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [autoplayEpisodes, setAutoplayEpisodes] = useState(true);
  const nextEpisodeHandler = useRef<() => void>(() => {});
  const castFinishedItem = useRef('');
  useEffect(() => { setAutoplayEpisodes(localStorage.getItem('homestream-autoplay') !== 'false'); }, []);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isVolumeHovered, setIsVolumeHovered] = useState(false);
  const [isVolumeInteracting, setIsVolumeInteracting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number | null>(null);
  const [streamError, setStreamError] = useState(false);
  const [isMidStreamBuffering, setIsMidStreamBuffering] = useState(false);
  const [isLoadingEpisode, setIsLoadingEpisode] = useState(false);
  const [streamUrl, setStreamUrl] = useState(() => {
    if (item.videoStreamUrl?.includes('/api/youtube/') || item.downloadStreamUrl?.includes('/api/youtube/') || item.id?.startsWith('yt-')) {
      return activeEpisode?.videoStreamUrl || item.videoStreamUrl || item.downloadStreamUrl || '';
    }
    return '';
  });
  const [streamDelivery, setStreamDelivery] = useState<{ url: string; type: string } | null>(null);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [isLoadingStream, setIsLoadingStream] = useState(!streamUrl);
  const [skipSegments, setSkipSegments] = useState<SkipSegment[]>([]);
  const [versions, setVersions] = useState<MediaVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(undefined);
  const [audioTracks, setAudioTracks] = useState<MediaAudioTrack[]>([]);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>(undefined);
  const [burnSubtitleIndex, setBurnSubtitleIndex] = useState<number | undefined>(undefined);
  const [qualityMode, setQualityMode] = useState<QualityMode>('auto');
  const [playbackDiag, setPlaybackDiag] = useState<{ playMethod?: string; resolution?: string; sourceVideoCodec?: string; sourceAudioCodec?: string; transcodeReasons?: string } | null>(null);
  const [versionResumeSec, setVersionResumeSec] = useState<number | null>(null);
  const [trickplayUrl, setTrickplayUrl] = useState<string | undefined>(undefined);
  const [trickplayCues, setTrickplayCues] = useState<Array<{ start: number; end: number; src: string; x: number; y: number; w: number; h: number }>>([]);
  const [syncRoomCode, setSyncRoomCode] = useState('');
  const [syncJoinCode, setSyncJoinCode] = useState('');
  const [syncParticipants, setSyncParticipants] = useState<Array<{ profileId: string; name: string }>>([]);
  const [activeMenu, setActiveMenu] = useState<'audio' | 'subtitles' | 'syncplay' | 'settings' | 'episodes' | null>(null);

  // Titles that are not in the library stream straight from the swarm via the in-process torrent engine.
  const isTorrentStream = [item.videoStreamUrl, item.downloadStreamUrl, episode?.videoStreamUrl].some(isTorrentStreamUrl);
  const torrentStartSeconds = isTorrentStream && streamUrl ? torrentStreamStartSeconds(streamUrl) : 0;

  const [hasTriedFallbackTranscode, setHasTriedFallbackTranscode] = useState(false);
  const [playbackDuration, setPlaybackDuration] = useState<number>(0);

  // Chromecast / Remote Playback state
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [isCastConnecting, setIsCastConnecting] = useState(false);
  const [castDeviceName, setCastDeviceName] = useState<string>('');

  const currentTimeRef = useRef(0);
  const lastProgressTime = useRef(0);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const streamUrlRef = useRef(streamUrl);
  useEffect(() => {
    streamUrlRef.current = streamUrl;
  }, [streamUrl, streamDelivery]);

  const lastCastedUrlRef = useRef<string>('');
  const lastCastedKeyRef = useRef<string>('');

  // Active episode / target ID
  const [activeEpisode, setActiveEpisode] = useState<Episode | undefined>(episode);
  const [activePlayableId, setActivePlayableId] = useState<string | undefined>(
    episode?.id ||
    item.playableEpisodeId ||
    (item.type !== 'Series' ? item.id : undefined)
  );

  const fallbackPlayback = usePlaybackFallback(activePlayableId || item.playableEpisodeId || (item.type !== 'Series' ? item.id : undefined), selectedVersionId, selectedAudioIndex);
  const { subtitles, selectedSubtitleId, setSelectedSubtitleId, isLoadingSubtitles } = useSubtitles(activePlayableId, videoRef, selectedVersionId);
  const torrentTmdb = isTorrentStream ? tmdbIdFor(item) : undefined;
  const torrentProgressId = torrentTmdb ? item.type === 'Movie' ? `tmdb-movie-${torrentTmdb}`
    : `tmdb-ep-${torrentTmdb}-${activeEpisode?.seasonNumber || item.seasonNumber || 1}-${activeEpisode?.episodeNumber || item.episodeNumber || 1}` : undefined;
  const reportProgress = useProgress(torrentProgressId || activePlayableId || item.playableEpisodeId || (item.type !== 'Series' ? item.id : undefined), videoRef, isPlaying && !isLoadingStream,
    () => isCasting ? currentTimeRef.current : torrentStartSeconds + (videoRef.current?.currentTime || 0));
  const state = playbackState({ stopped, error: streamError, loading: isLoadingStream || isLoadingEpisode, buffering: isMidStreamBuffering, playing: isPlaying });

  const isLibraryItem = Boolean(item.source === 'native' || String(item.id || '').startsWith('nat-'));

  // Series playlist episodes
  const [seriesEpisodes, setSeriesEpisodes] = useState<Episode[]>(
    item.seasons?.flatMap((s) => s.episodes || []) || []
  );

  // Load full media details (especially durationMinutes / runtime) for accurate timeline display
  useEffect(() => {
    const hasDuration =
      (item.durationMinutes && item.durationMinutes > 0) ||
      (item.totalDurationTicks && item.totalDurationTicks > 0) ||
      (activeEpisode?.durationMinutes && activeEpisode.durationMinutes > 0);

    if (!hasDuration && item.id && !item.id.startsWith('yt-')) {
      apiFetch(`/api/media/${item.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.item?.durationMinutes) {
            const durSec = data.item.durationMinutes * 60;
            setPlaybackDuration(durSec);
            setDuration(durSec);
          }
        })
        .catch(() => {});
    }
  }, [item.id, item.durationMinutes, item.totalDurationTicks, activeEpisode?.durationMinutes]);

  // For torrent streaming, probe the exact duration from the swarm before playback starts
  useEffect(() => {
    if (!isTorrentStream || !isTorrentStreamUrl(streamUrl)) return;
    const controller = new AbortController();
    apiFetch(`${streamUrl}${streamUrl.includes('?') ? '&' : '?'}probe=1`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.durationSeconds && data.durationSeconds > 0) {
          setPlaybackDuration(data.durationSeconds);
          setDuration(data.durationSeconds);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isTorrentStream, streamUrl]);

  // If item is a series, ensure series seasons/episodes are loaded for navigation & next episode
  useEffect(() => {
    if (item.type === 'Series') {
      if (item.seasons && item.seasons.length > 0) {
        const allEps = item.seasons.flatMap((s) => s.episodes || []);
        const isPlayableEp = (ep: Episode) => Boolean(isTorrentStream || ep.videoStreamUrl || String(ep.id || '').startsWith('nat-') || (item.source === 'native' && ep.id));
        setSeriesEpisodes(allEps.filter(isPlayableEp).sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber));
        if (!activeEpisode) {
          const found = activePlayableId
            ? allEps.find((ep) => ep.id === activePlayableId)
            : allEps.find(isPlayableEp);
          if (found) {
            setActiveEpisode(found);
            if (!activePlayableId) setActivePlayableId(found.id);
          }
        }
        return;
      }

      setIsLoadingEpisode(true);
      apiFetch(`/api/media/${item.id}`)
        .then((res) => res.json())
        .then((data) => {
          const media = data.item;
          if (!media) return;
          const targetPlayableId = activePlayableId || media.playableEpisodeId;
          if (targetPlayableId && !activePlayableId) {
            setActivePlayableId(targetPlayableId);
          }
          if (media.seasons) {
            const allEps = media.seasons.flatMap((s: any) => s.episodes || []);
            const isPlayableEp = (ep: Episode) => Boolean(isTorrentStream || ep.videoStreamUrl || String(ep.id || '').startsWith('nat-') || (media.source === 'native' && ep.id));
            setSeriesEpisodes(allEps.filter(isPlayableEp).sort((a: Episode, b: Episode) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber));
            if (!activeEpisode) {
              const found = targetPlayableId
                ? allEps.find((ep: any) => ep.id === targetPlayableId)
                : allEps.find(isPlayableEp);
              if (found) {
                setActiveEpisode(found);
              }
            }
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingEpisode(false));
    }
  }, [item, activeEpisode, activePlayableId]);

  // Compute next episode in TV series
  const nextEpisode = useMemo(() => {
    if (!seriesEpisodes || seriesEpisodes.length === 0) return null;
    const currentId = activeEpisode?.id || activePlayableId;
    const currentIdx = seriesEpisodes.findIndex(
      (ep) => (currentId && ep.id === currentId) ||
              (activeEpisode && ep.seasonNumber === activeEpisode.seasonNumber && ep.episodeNumber === activeEpisode.episodeNumber)
    );
    if (currentIdx !== -1 && currentIdx + 1 < seriesEpisodes.length) {
      return seriesEpisodes[currentIdx + 1];
    }
    return null;
  }, [seriesEpisodes, activeEpisode, activePlayableId]);

  const currentTitle = useMemo(() => {
    return activeEpisode
      ? `${item.title}: S${activeEpisode.seasonNumber}E${activeEpisode.episodeNumber} - ${activeEpisode.name}`
      : item.title;
  }, [item.title, activeEpisode]);

  // Synchronize subtitle track change locally and on remote Chromecast receiver
  const changeSubtitleTrack = useCallback(
    (subId: string | null) => {
      setSelectedSubtitleId(subId);
      const target = subId ? subtitles.find((s) => s.id === subId) : undefined;
      if (target?.burnIn) {
        setVersionResumeSec(videoRef.current?.currentTime || currentTime);
        setBurnSubtitleIndex(target.index);
      } else if (burnSubtitleIndex !== undefined) {
        setVersionResumeSec(videoRef.current?.currentTime || currentTime);
        setBurnSubtitleIndex(undefined);
      }

      // If casting via Google Cast SDK, update active tracks on receiver
      if (isCasting && typeof window !== 'undefined' && (window as any).cast?.framework) {
        try {
          const session = (window as any).cast.framework.CastContext.getInstance().getCurrentSession();
          const media = session?.getMediaSession();
          if (media) {
            let activeTrackIds: number[] = [];
            if (subId !== null) {
              const subIdx = subtitles.findIndex((s) => s.id === subId);
              if (subIdx !== -1) {
                activeTrackIds = [subIdx + 1];
              }
            }
            selectCastSubtitles({ createRequest: ids => new (window as any).chrome.cast.media.EditTracksInfoRequest(ids), editTracks: (request, success, failure) => media.editTracksInfo(request, success, failure) }, activeTrackIds.length ? activeTrackIds[0] - 1 : -1);
          }
        } catch (e) {
          console.warn('Chromecast subtitle edit exception:', e);
        }
      }
    },
    [burnSubtitleIndex, currentTime, isCasting, setSelectedSubtitleId, subtitles]
  );

  const returnFromFailedCast = useCallback((start: { position: number; autoplay: boolean }) => {
    cancelCastLoad();
    setIsCastConnecting(false);
    setIsCasting(false);
    setCastError(true);
    (window as any).cast?.framework?.CastContext.getInstance().endCurrentSession(true);
    if (videoRef.current) {
      videoRef.current.currentTime = start.position;
      if (start.autoplay) void videoRef.current.play().catch(() => {});
    }
  }, [cancelCastLoad]);

  // Load media stream with metadata and subtitles onto connected Chromecast receiver
  const loadCastMedia = useCallback(async (compatible = false) => {
    const generation = ++castLoadGeneration.current;
    castCompatibilityRef.current = compatible;
    const previous = compatible ? castStartup.current : null;
    setCastError(false);
    const start = {
      position: previous?.position ?? (compatible ? currentTimeRef.current : videoRef.current?.currentTime ?? currentTimeRef.current),
      autoplay: previous?.autoplay ?? (videoRef.current ? !videoRef.current.paused : true),
      attempt: generation,
      deadline: Date.now() + 30_000,
    };
    castStartup.current = start;
    const failed = () => {
      if (generation !== castLoadGeneration.current) return;
      if (!compatible) { void castLoadRef.current(true); return; }
      returnFromFailedCast(start);
    };
    try {
      if (typeof window === 'undefined' || !(window as any).cast?.framework) return;
      const castContext = (window as any).cast.framework.CastContext.getInstance();
      const session = castContext.getCurrentSession();
      if (!session) { cancelCastLoad(); return; }

      const deviceName = session.getCastDevice()?.friendlyName;
      if (deviceName) setCastDeviceName(deviceName);

      const localUrl = streamUrlRef.current || videoRef.current?.currentSrc || videoRef.current?.src;
      let rawUrl = localUrl;
      let negotiatedContentType = '';
      let negotiatedDuration = 0;
      const torrentTarget = isTorrentStream ? torrentStreamUrl(item, activeEpisode) : undefined;
      const torrentTmdbId = torrentTarget ? new URL(torrentTarget, window.location.origin).searchParams.get('tmdbId') : undefined;
      const targetId = torrentTmdbId ? `tmdb-${item.type === 'Movie' ? 'movie' : 'tv'}-${torrentTmdbId}`
        : activePlayableId || activeEpisode?.id || item.playableEpisodeId || item.id;
      if (targetId) {
        const params = new URLSearchParams({ itemId: targetId, receiver: 'cast', audioCodecs: 'aac,mp3', forceTranscode: String(compatible) });
        if (selectedVersionId) params.set('versionId', selectedVersionId);
        if (selectedAudioIndex !== undefined) params.set('audioIndex', String(selectedAudioIndex));
        if (activeEpisode) {
          if (activeEpisode.seasonNumber) params.set('season', String(activeEpisode.seasonNumber));
          if (activeEpisode.episodeNumber) params.set('episode', String(activeEpisode.episodeNumber));
          params.set('type', 'tv');
        } else if (item.type) {
          params.set('type', item.type === 'Movie' ? 'movie' : 'tv');
        }
        if (item.title) params.set('title', item.title);
        const capabilities = compatible || castReceiverId() === DEFAULT_RECEIVER_ID
          ? undefined : await requestCastCapabilities(session);
        if (generation !== castLoadGeneration.current) return;
        if (capabilities) {
          params.set('videoCapabilities', capabilities.video);
          if (capabilities.audioCodecs !== undefined) params.set('audioCodecs', capabilities.audioCodecs);
        }
        const response = await apiFetch(`/api/playback?${params}`);
        if (!response.ok) throw new Error('Cast stream negotiation failed');
        const result = await response.json();
        rawUrl = result.streamUrl;
        negotiatedContentType = result.contentType || '';
        negotiatedDuration = result.durationSeconds || 0;
      }
      if (generation !== castLoadGeneration.current) return;
      if (!rawUrl || castContext.getCurrentSession() !== session) { failed(); return; }

      const absoluteMediaUrl = new URL(rawUrl, window.location.href).href;
      lastCastedUrlRef.current = absoluteMediaUrl;
      lastCastedKeyRef.current = targetId;

      const isHls = absoluteMediaUrl.includes('.m3u8');
      const contentType = negotiatedContentType || (isHls ? 'application/x-mpegURL' : new URL(absoluteMediaUrl).pathname.endsWith('.webm') ? 'video/webm' : 'video/mp4');

      const mediaInfo = new (window as any).chrome.cast.media.MediaInfo(absoluteMediaUrl, contentType);
      mediaInfo.metadata = new (window as any).chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = currentTitle;
      mediaInfo.metadata.subtitle = activeEpisode ? item.title : (item.overview || '');

      const poster = activeEpisode?.thumbnailUrl || item.backdropUrl || item.posterUrl;
      if (poster) {
        mediaInfo.metadata.images = [{ url: new URL(poster, window.location.href).href }];
      }

      mediaInfo.streamType = (window as any).chrome.cast.media.StreamType.BUFFERED;
      const finalDuration = negotiatedDuration > 0
        ? negotiatedDuration
        : (item.durationMinutes ? item.durationMinutes * 60 : 0) || (activeEpisode?.totalDurationTicks ? activeEpisode.totalDurationTicks / 10000000 : 0);
      if (finalDuration > 0) {
        mediaInfo.duration = finalDuration;
      }

      mediaInfo.customData = { itemId: targetId, streamItemId: torrentProgressId || targetId, attempt: generation, playback: { durationSeconds: finalDuration > 0 ? finalDuration : undefined } };
      clearCastIdle(session);

      if (subtitles && subtitles.length > 0 && (window as any).chrome?.cast?.media?.Track) {
        mediaInfo.tracks = subtitles.map((sub, idx) => {
          const track = new (window as any).chrome.cast.media.Track(
            idx + 1,
            (window as any).chrome.cast.media.TrackType.TEXT
          );
          const normalizedSub = sub.src.startsWith('/api/native/') ? sub.src.replace(/^\/api\/native\//, '/api/v1/native/') : sub.src;
          track.trackContentId = new URL(normalizedSub, window.location.href).href;
          track.trackContentType = 'text/vtt';
          track.subtype = (window as any).chrome.cast.media.TextTrackType.SUBTITLES;
          track.name = sub.title;
          track.language = sub.language;
          return track;
        });
      }

      const request = new (window as any).chrome.cast.media.LoadRequest(mediaInfo);
      request.currentTime = start.position;
      request.autoplay = start.autoplay;
      const selectedTrack = subtitles.findIndex(track => track.id === selectedSubtitleId);
      if (selectedTrack >= 0) request.activeTrackIds = [selectedTrack + 1];

      session.loadMedia(request).then(
        () => {
          if (generation !== castLoadGeneration.current) return;
          setIsCasting(true);
          setIsCastConnecting(false);
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
          }
        },
        failed
      );
    } catch {
      failed();
    }
  }, [currentTitle, item, activeEpisode, subtitles, activePlayableId, isTorrentStream, torrentProgressId, selectedSubtitleId, selectedVersionId, selectedAudioIndex, cancelCastLoad, returnFromFailedCast]);
  castLoadRef.current = loadCastMedia;

  const inspectCastStartup = useCallback((media: unknown) => {
    const pending = castStartup.current;
    if (!pending) return false;
    const state = castStartupState(pending, media);
    if (state === 'ready') {
      castStartup.current = null;
      return false;
    }
    if (state === 'failed') {
      if (!castCompatibilityRef.current) void castLoadRef.current(true);
      else returnFromFailedCast(pending);
    }
    return true;
  }, [returnFromFailedCast]);

  // Disconnect from Chromecast session
  const handleDisconnectCast = useCallback(() => {
    cancelCastLoad();
    if (typeof window !== 'undefined' && (window as any).cast?.framework) {
      try {
        const castContext = (window as any).cast.framework.CastContext.getInstance();
        castContext.endCurrentSession(true);
      } catch (e) {}
    }
    const video = videoRef.current;
    if (video && (video as any).remote?.state === 'connected') {
      (video as any).remote.prompt().catch(() => {});
    }
    setIsCasting(false);
    setIsCastConnecting(false);
    setCastDeviceName('');
    lastCastedUrlRef.current = '';
    lastCastedKeyRef.current = '';
    if (videoRef.current) {
      videoRef.current.currentTime = currentTimeRef.current || currentTime;
      if (isPlaying) {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [cancelCastLoad, currentTime, isPlaying]);

  // Cast button click handler supporting both Google Cast SDK and RemotePlayback API
  const handleCastClick = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (isCasting) {
      handleDisconnectCast();
      return;
    }

    setIsCastConnecting(true);

    // 1. Guard against insecure HTTP contexts where Chrome explicitly blocks casting
    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.protocol === 'http:' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setIsCastConnecting(false);
      const httpsUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}`;
      const confirmed = window.confirm(
        'Chromecast casting is disabled by Google Chrome on unencrypted HTTP.\n\nWould you like to switch to HTTPS on this server now?'
      );
      if (confirmed) {
        window.location.href = httpsUrl;
      }
      return;
    }

    // 2. Google Cast Framework (Chrome macOS, Windows, Linux, Android)
    if (typeof window !== 'undefined' && (window as any).cast?.framework) {
      try {
        const castContext = (window as any).cast.framework.CastContext.getInstance();
        try {
          castContext.setOptions({
            receiverApplicationId: castReceiverId(),
            autoJoinPolicy: (window as any).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED,
          });
        } catch (initErr) {
          // Already initialized
        }
        await castContext.requestSession();
        return;
      } catch (err: any) {
        if (err?.errorCode === 'cancel' || err?.message?.includes('cancel')) {
          setIsCastConnecting(false);
          return;
        }
        console.warn('Google Cast requestSession fallback:', err);
      }
    }

    // 3. HTMLMediaElement Remote Playback API (Android Chrome / Samsung Internet)
    const video = videoRef.current;
    if (video && 'remote' in video && (video as any).remote?.prompt) {
      try {
        await (video as any).remote.prompt();
        return;
      } catch (err: any) {
        setIsCastConnecting(false);
        if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') {
          return;
        }
        console.warn('RemotePlayback prompt fallback:', err);
      }
    }

    setIsCastConnecting(false);
    alert(
      'To cast to Chromecast or Google TV:\n• Open HomeStream using your server’s HTTPS address\n• Ensure your phone/Mac is on the same Wi-Fi as your Chromecast.\n• Use Google Chrome or Samsung Internet.'
    );
  }, [isCasting, handleDisconnectCast]);

  useCastSession({videoRef, loadCastMedia: castLoadRef, cancelCastLoad, inspectCastStartup, syncCastVolume, setIsCastConnecting, setIsCasting, setIsCastAvailable, setCastDeviceName, lastCastedUrlRef, lastCastedKeyRef, isCasting, isScrubbing, setCurrentTime, castCompatibilityRef, castLoadRef, castFinishedItem, autoplayEpisodes, nextEpisodeHandler, setIsPlaying});

  // Auto-reload on Chromecast ONLY when media/episode actually changes while casting
  useEffect(() => {
    if (isCasting && streamUrl && lastCastedKeyRef.current) {
      const currentItemKey = activePlayableId || activeEpisode?.id || item.playableEpisodeId || item.id;
      if (lastCastedKeyRef.current !== currentItemKey) {
        lastCastedKeyRef.current = currentItemKey;
        loadCastMedia();
      }
    }
  }, [streamUrl, activeEpisode, activePlayableId, item, isCasting, loadCastMedia]);

  // Resolve known media duration in seconds
  const knownDurationSeconds =
    playbackDuration ||
    (activeEpisode?.totalDurationTicks ? activeEpisode.totalDurationTicks / 10000000 : undefined) ||
    (activeEpisode?.durationMinutes ? activeEpisode.durationMinutes * 60 : undefined) ||
    (item.totalDurationTicks ? item.totalDurationTicks / 10000000 : undefined) ||
    (item.durationMinutes ? item.durationMinutes * 60 : undefined) ||
    0;

  useEffect(() => {
    if (knownDurationSeconds > 0) {
      setDuration((prev) => {
        if (!prev || prev <= 10 || Math.abs(prev - knownDurationSeconds) > 60) {
          return knownDurationSeconds;
        }
        return prev;
      });
    }
  }, [knownDurationSeconds]);

  // Negotiate dynamic playback stream (DirectPlay / Transcoding)
  useEffect(() => {
    if (isTorrentStream) {
      const controller = new AbortController();
      const raw = torrentStreamUrl(item, activeEpisode) || activeEpisode?.videoStreamUrl || item.videoStreamUrl || item.downloadStreamUrl;
      setIsLoadingStream(true);
      setStreamError(false);
      void browserDecoderParameters(mime => videoRef.current?.canPlayType(mime) || '',
        navigator.mediaCapabilities?.decodingInfo.bind(navigator.mediaCapabilities)).then(capabilities => {
        if (controller.signal.aborted) return;
        if (!raw) { setStreamError(true); setIsLoadingStream(false); return; }
        const url = new URL(raw, window.location.origin);
        const resume = (activeEpisode?.playbackPositionTicks || item.playbackPositionTicks || 0) / 10000000;
        if (resume > 0) { url.searchParams.set('start', String(resume)); setCurrentTime(resume); }
        capabilities.forEach((value, key) => url.searchParams.set(key, value));
        if (qualityMode === '720p') { url.searchParams.set('maxWidth', '1280'); url.searchParams.set('maxHeight', '720'); }
        if (qualityMode === '1080p') { url.searchParams.set('maxWidth', '1920'); url.searchParams.set('maxHeight', '1080'); }
        setStreamDelivery({ url: url.pathname + url.search, type: 'video/mp4' });
        setStreamUrl(url.pathname + url.search);
      }).catch(() => { if (!controller.signal.aborted) setStreamError(true); });
      return () => controller.abort();
    }

    if (!activePlayableId && item.type === 'Series') {
      return;
    }

    if (!isLibraryItem) {
      setStreamUrl(activeEpisode?.videoStreamUrl || item.downloadStreamUrl || item.videoStreamUrl || '');
      setIsLoadingStream(false);
      return;
    }

    const targetId = activePlayableId || item.playableEpisodeId || (item.type !== 'Series' ? item.id : undefined);
    if (!targetId) return;

    setIsLoadingStream(true);
    setStreamError(false);
    setHasTriedFallbackTranscode(false);

    const controller = new AbortController();
    let isMounted = true;
    negotiatePlayback(targetId, mime => videoRef.current?.canPlayType(mime) || '', controller.signal, false, selectedVersionId, selectedAudioIndex, burnSubtitleIndex, qualityMode)
      .then((data) => {
        if (!isMounted) return;
        if (data.streamUrl) {
          setStreamDelivery({ url: data.streamUrl, type: data.contentType || '' });
          setStreamUrl(data.streamUrl);
          setIsTranscoding(Boolean(data.isTranscoding));
          setPlaybackDiag({
            playMethod: data.playMethod || (data.isTranscoding ? 'Transcode' : 'DirectPlay'),
            resolution: data.resolution,
            sourceVideoCodec: data.sourceVideoCodec,
            sourceAudioCodec: data.sourceAudioCodec,
            transcodeReasons: data.transcodeReasons,
          });
          setSkipSegments(Array.isArray(data.skipSegments) ? data.skipSegments : []);
          setVersions(Array.isArray(data.versions) ? data.versions : []);
          if (!selectedVersionId && data.selectedVersionId) {
            setSelectedVersionId(data.selectedVersionId);
          }
          setAudioTracks(data.audioTracks || []);
          setTrickplayUrl(data.trickplayUrl);
          if (data.durationSeconds && data.durationSeconds > 0) {
            setPlaybackDuration(data.durationSeconds);
            setDuration(data.durationSeconds);
          }
        } else {
          setStreamError(true);
        }
      })
      .catch((err) => {
        console.error('Failed to negotiate playback stream:', err);
        if (!isMounted) return;
        setStreamError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoadingStream(false);
      });

    return () => {
      isMounted = false; controller.abort();
    };
  }, [activePlayableId, item, isLibraryItem, isTorrentStream, activeEpisode, selectedVersionId, selectedAudioIndex, burnSubtitleIndex, qualityMode]);

  // Parse Trickplay WebVTT sprite sheet cues when trickplayUrl is available
  useEffect(() => {
    setTrickplayCues([]);
    if (!trickplayUrl) return;
    const controller = new AbortController();
    const apiPath = trickplayUrl.startsWith('/api/native/')
      ? trickplayUrl.replace('/api/', '/api/v1/')
      : trickplayUrl;
    fetch(apiPath, { credentials: 'same-origin', signal: controller.signal })
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        if (controller.signal.aborted || !text) return;
        const parseTs = (ts: string) => {
          const parts = ts.trim().split(':').map(Number);
          if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
          if (parts.length === 2) return parts[0] * 60 + parts[1];
          return 0;
        };
        const lines = text.split(/\r?\n/);
        const parsed: Array<{ start: number; end: number; src: string; x: number; y: number; w: number; h: number }> = [];
        for (let i = 0; i < lines.length; i++) {
          const m = /^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s*-->\s*(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/.exec(lines[i]);
          if (!m) continue;
          const nextLine = (lines[i + 1] || '').trim();
          const xy = /#xywh=(\d+),(\d+),(\d+),(\d+)/.exec(nextLine);
          if (!xy) continue;
          const rawSrc = nextLine.split('#')[0];
          const src = rawSrc.startsWith('/api/native/') ? rawSrc.replace('/api/', '/api/v1/') : rawSrc;
          parsed.push({
            start: parseTs(m[1]),
            end: parseTs(m[2]),
            src,
            x: Number(xy[1]),
            y: Number(xy[2]),
            w: Number(xy[3]),
            h: Number(xy[4]),
          });
        }
        setTrickplayCues(parsed);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [trickplayUrl]);

  // SyncPlay polling when inside a room
  useEffect(() => {
    if (!syncRoomCode) return;
    const localItem = activePlayableId || item.id;
    const timer = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/syncplay?code=${encodeURIComponent(syncRoomCode)}`);
        if (!res.ok) return;
        const d = await res.json();
        const room = d.room;
        if (!room) return;
        const roomItem = room.episodeId || room.itemId;
        if (roomItem && localItem && roomItem !== localItem) {
          setSyncRoomCode('');
          setSyncParticipants([]);
          return;
        }
        setSyncParticipants(Array.isArray(room.participants) ? room.participants : []);
        const video = videoRef.current;
        if (video) {
          const targetSec = (room.positionTicks || 0) / 10_000_000;
          if (Math.abs(video.currentTime - targetSec) > 2.5) {
            video.currentTime = targetSec;
          }
          if (room.isPaused && !video.paused) {
            video.pause();
            setIsPlaying(false);
          } else if (!room.isPaused && video.paused) {
            void video.play().catch(() => {});
            setIsPlaying(true);
          }
        }
      } catch {}
    }, 2000);
    return () => clearInterval(timer);
  }, [syncRoomCode, activePlayableId, item.id]);

  const activeSkipSegment = useMemo(
    () => skipSegments.find((s) => currentTime >= s.startSeconds && currentTime < s.endSeconds - 1),
    [skipSegments, currentTime]
  );

  const activeHoverCue = useMemo(() => {
    if (hoverTime === null || trickplayCues.length === 0) return null;
    return trickplayCues.find((c) => hoverTime >= c.start && hoverTime < c.end) || null;
  }, [hoverTime, trickplayCues]);

  const handlePlaybackError = useCallback(() => {
    const targetId = activePlayableId || item.playableEpisodeId || (item.type !== 'Series' ? item.id : undefined);

    if (isLibraryItem && targetId && !hasTriedFallbackTranscode) {
      console.warn('Playback error encountered on direct stream. Attempting automatic transcoding fallback...');
      setHasTriedFallbackTranscode(true);
      setIsLoadingStream(true);

      void fallbackPlayback({
        ready: data => {
          setStreamDelivery({url:data.streamUrl,type:data.contentType || ''});
          setStreamUrl(data.streamUrl);setIsTranscoding(true);setStreamError(false);
          if(data.durationSeconds){setPlaybackDuration(data.durationSeconds);setDuration(data.durationSeconds);}
        },
        failed: () => {setStreamError(true);setIsPlaying(false);},
        finished: () => setIsLoadingStream(false),
      });
      return;
    }

    setStreamError(true);
    setIsPlaying(false);
    setIsLoadingStream(false);
  }, [activePlayableId, item, isLibraryItem, hasTriedFallbackTranscode, fallbackPlayback]);

  const handleRetryPlayback = () => {
    const targetId = activePlayableId || item.playableEpisodeId || (item.type !== 'Series' ? item.id : undefined);
    setStreamError(false);
    setIsLoadingStream(true);

    if (isLibraryItem && targetId) {
      setHasTriedFallbackTranscode(true);
      void fallbackPlayback({
        ready: data => {
          setStreamDelivery({url:data.streamUrl,type:data.contentType || ''});
          setStreamUrl(data.streamUrl);setIsTranscoding(true);setStreamError(false);
          if(data.durationSeconds){setPlaybackDuration(data.durationSeconds);setDuration(data.durationSeconds);}
        },
        failed: () => {setStreamError(true);setIsPlaying(false);},
        finished: () => setIsLoadingStream(false),
      });
    } else {
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play().catch(console.error);
      }
      setIsLoadingStream(false);
    }
  };

  // Auto-hide controls timer
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !activeMenu && !isCasting) {
        setShowControls(false);
      }
    }, 3500);
  }, [isPlaying, activeMenu, isCasting]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [resetControlsTimer]);

  useMediaDelivery({
    url: streamUrl, contentType: streamDelivery?.url === streamUrl ? streamDelivery.type : '', itemId: activePlayableId,
    resumeSeconds: isTorrentStream ? 0 : versionResumeSec !== null
      ? versionResumeSec
      : (activeEpisode ? activeEpisode.playbackPositionTicks || 0 : item.playbackPositionTicks || 0) / 10000000,
    videoRef, hlsRef, revision: streamDelivery, setIsLoadingStream, setIsPlaying, setCurrentTime, onError: handlePlaybackError,
  });

  // Video event handlers
  const updateBufferState = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const effectiveDuration = duration > 0 ? duration : (knownDurationSeconds > 0 ? knownDurationSeconds : (videoRef.current.duration || 0));
    if (effectiveDuration > 0 && videoRef.current.buffered.length > 0) {
      const b = videoRef.current.buffered;
      let buffEnd = 0;
      for (let i = 0; i < b.length; i++) {
        if (b.start(i) <= cur + 2 && cur <= b.end(i)) {
          buffEnd = b.end(i);
          break;
        }
      }
      if (buffEnd === 0 && b.length > 0) {
        buffEnd = b.end(b.length - 1);
      }
      setBuffered(Math.min(100, Math.max(0, ((torrentStartSeconds + buffEnd) / effectiveDuration) * 100)));
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isScrubbing) {
      const cur = torrentStartSeconds + videoRef.current.currentTime;
      setCurrentTime(cur);

      // Always anchor duration to true whole movie length (knownDurationSeconds)
      setDuration((prev) => {
        if (knownDurationSeconds > 0) {
          return knownDurationSeconds;
        }
        return Math.max(prev, cur);
      });

      if (item.id?.startsWith('yt-') && Math.abs(cur - lastProgressTime.current) >= 5) {
        lastProgressTime.current = cur;
        const videoId = item.id.replace(/^yt-(?:archive-)?/, '');
        apiFetch('/api/youtube/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            title: item.title,
            channelName: item.genres?.[1] || 'YouTube',
            thumbnailUrl: item.posterUrl,
            positionSeconds: cur,
            durationSeconds: duration > 0 ? duration : (knownDurationSeconds > 0 ? knownDurationSeconds : cur),
            streamUrl: item.videoStreamUrl || item.downloadStreamUrl,
          }),
        }).catch(() => {});
      }

      updateBufferState();
    }
  };

  const handleProgress = () => {
    updateBufferState();
  };

  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetDur = displayDuration || 100;
    setHoverTime(pos * targetDur);
    setHoverPos(pos * 100);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const videoDur = videoRef.current.duration;
      // Prefer knownDurationSeconds so transcode chunk duration never shrinks or skews the whole movie length
      if (knownDurationSeconds > 0) {
        setDuration(knownDurationSeconds);
      } else if (Number.isFinite(videoDur) && videoDur > 30) {
        setDuration(videoDur);
      }
    }
  };

  const displayDuration = knownDurationSeconds > 0
    ? knownDurationSeconds
    : duration > 0
      ? duration
      : (item.durationMinutes ? item.durationMinutes * 60 : 0);

  const playPercent = displayDuration > 0
    ? Math.min(100, Math.max(0, (currentTime / displayDuration) * 100))
    : 0;

  const togglePlay = () => {
    if (isCasting && typeof window !== 'undefined' && (window as any).cast?.framework) {
      try {
        const session = (window as any).cast.framework.CastContext.getInstance().getCurrentSession();
        const media = session?.getMediaSession();
        if (media) {
          if (isPlaying) {
            media.pause(null, () => setIsPlaying(false), console.error);
          } else {
            media.play(null, () => setIsPlaying(true), console.error);
          }
          return;
        }
      } catch (err) {
        console.warn('Cast play/pause error:', err);
      }
    }
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
      resetControlsTimer();
    }
  };

  const seekTorrentTo = (seconds: number) => {
    const next = seekTorrentStreamUrl(streamUrl, seconds);
    setStreamError(false);
    setIsLoadingStream(true);
    setCurrentTime(seconds);
    setIsTranscoding(seconds > 0);
    setStreamDelivery({ url: next, type: 'video/mp4' });
    setStreamUrl(next);
  };

  const seek = (seconds: number) => {
    const targetDuration = duration > 0 ? duration : (knownDurationSeconds || videoRef.current?.duration || 100);
    const newTime = Math.max(0, Math.min(currentTime + seconds, targetDuration));
    if (isCasting && typeof window !== 'undefined' && (window as any).cast?.framework) {
      try {
        const session = (window as any).cast.framework.CastContext.getInstance().getCurrentSession();
        const media = session?.getMediaSession();
        if (media) {
          const seekReq = new (window as any).chrome.cast.media.SeekRequest();
          seekReq.currentTime = newTime;
          media.seek(seekReq, () => setCurrentTime(newTime), console.error);
          resetControlsTimer();
          return;
        }
      } catch (err) {
        console.warn('Cast seek error:', err);
      }
    }
    if (!videoRef.current) return;
    if (isTorrentStream) { seekTorrentTo(newTime); resetControlsTimer(); return; }
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    resetControlsTimer();
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    setIsScrubbing(true);
    resetControlsTimer();
  };

  const mediaSessionDuration = duration > 0 ? duration : (knownDurationSeconds || videoRef.current?.duration || 0);
  const mediaSessionSubtitle = episode
    ? `S${episode.seasonNumber} E${episode.episodeNumber}${episode.name ? ` · ${episode.name}` : ''}`
    : (item.year ? String(item.year) : '');
  const mediaSessionArtwork = episode?.thumbnailUrl || item.backdropUrl || item.posterUrl;

  useMediaSession({
    active: !stopped,
    title: item.title,
    artist: mediaSessionSubtitle,
    album: episode ? item.title : '',
    artworkUrl: mediaSessionArtwork,
    isPlaying,
    currentTime,
    duration: mediaSessionDuration,
    onPlay: () => {
      if (!isPlaying) togglePlay();
    },
    onPause: () => {
      if (isPlaying) togglePlay();
    },
    onSeekTo: (time) => {
      seek(time - currentTime);
    },
    onSeekBackward: (offset) => {
      seek(-offset);
    },
    onSeekForward: (offset) => {
      seek(offset);
    },
    onNextTrack: (nextEpisode || onNextEpisode) ? () => nextEpisodeHandler.current() : undefined,
    onStop: onClose,
  });

  useSessionHeartbeat({
    active: !stopped,
    mediaId: episode?.id || item.id,
    mediaType: 'video',
    title: item.title,
    subtitle: mediaSessionSubtitle,
    artworkUrl: mediaSessionArtwork,
    isPlaying,
    positionMs: currentTime * 1000,
    durationMs: mediaSessionDuration * 1000,
    canSeek: mediaSessionDuration > 0,
    canSkipNext: Boolean(nextEpisode || onNextEpisode),
    canSkipPrev: false,
    onCommand: (cmd) => {
      switch (cmd.type) {
        case 'play':
          if (!isPlaying) togglePlay();
          break;
        case 'pause':
          if (isPlaying) togglePlay();
          break;
        case 'togglePlayPause':
          togglePlay();
          break;
        case 'stop':
          onClose();
          break;
        case 'seekTo':
          if (typeof cmd.positionMs === 'number') seek(cmd.positionMs / 1000 - currentTime);
          break;
        case 'seekBy':
          if (typeof cmd.deltaMs === 'number') seek(cmd.deltaMs / 1000);
          break;
        case 'next':
          if (nextEpisode || onNextEpisode) nextEpisodeHandler.current();
          break;
        case 'muteToggle':
          if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
          break;
        case 'volumeUp':
          if (videoRef.current) videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
          break;
        case 'volumeDown':
          if (videoRef.current) videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
          break;
      }
    },
  });

  const handleScrubEnd = () => {
    setIsScrubbing(false);
    if (isCasting && typeof window !== 'undefined' && (window as any).cast?.framework) {
      try {
        const session = (window as any).cast.framework.CastContext.getInstance().getCurrentSession();
        const media = session?.getMediaSession();
        if (media) {
          const seekReq = new (window as any).chrome.cast.media.SeekRequest();
          seekReq.currentTime = currentTime;
          media.seek(seekReq, () => {}, console.error);
          resetControlsTimer();
          return;
        }
      } catch (err) {
        console.warn('Cast scrub seek error:', err);
      }
    }
    if (isTorrentStream) seekTorrentTo(currentTime);
    else if (videoRef.current) videoRef.current.currentTime = currentTime;
    resetControlsTimer();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = Number(e.target.value);
    if (isCasting && typeof window !== 'undefined' && (window as any).cast?.framework) {
      try {
        const castContext = (window as any).cast.framework.CastContext.getInstance();
        const session = castContext.getCurrentSession();
        if (session) { void session.setVolume(newVol).catch(() => {}); return; }
      } catch (e) {}
    }
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    if (isCasting && typeof window !== 'undefined' && (window as any).cast?.framework) {
      try {
        const castContext = (window as any).cast.framework.CastContext.getInstance();
        const session = castContext.getCurrentSession();
        if (session) { void session.setMute(nextMuted).catch(() => {}); return; }
      } catch (e) {}
    }
    setIsMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  const handleRestart = () => {
    if (isCasting && typeof window !== 'undefined' && (window as any).cast?.framework) {
      try {
        const session = (window as any).cast.framework.CastContext.getInstance().getCurrentSession();
        const media = session?.getMediaSession();
        if (media) {
          const seekReq = new (window as any).chrome.cast.media.SeekRequest();
          seekReq.currentTime = 0;
          media.seek(seekReq, () => {
            setCurrentTime(0);
            setIsPlaying(true);
          }, console.error);
        }
      } catch (err) {
        console.warn('Cast restart error:', err);
      }
    }
    if (isTorrentStream && !isCasting) { seekTorrentTo(0); resetControlsTimer(); return; }
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
    setCurrentTime(0);
    reportProgress(false, 0);
    resetControlsTimer();
  };

  const handleSelectEpisode = (targetEp: Episode) => {
    reportProgress(true);
    setActiveEpisode(targetEp);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(targetEp.totalDurationTicks ? targetEp.totalDurationTicks / 10000000 : 0);
    setPlaybackDuration(0);

    if (isTorrentStream) {
      const nextUrl = torrentStreamUrl(item, targetEp);
      if (nextUrl) {
        setStreamUrl('');
        setStreamDelivery(null);
        setIsLoadingStream(true);
        setActiveMenu(null);
        resetControlsTimer();
        return;
      }
    }

    setActivePlayableId(targetEp.id);
    setStreamUrl('');
    setStreamDelivery({ url: '', type: '' });
    setSkipSegments([]);
    setVersions([]);
    setSelectedVersionId(undefined);
    setAudioTracks([]);
    setSelectedAudioIndex(undefined);
    setVersionResumeSec(null);
    setTrickplayUrl(undefined);
    setTrickplayCues([]);
    setHasTriedFallbackTranscode(false);
    setIsLoadingStream(true);
    setActiveMenu(null);
    resetControlsTimer();
  };

  const handleNextEpisode = () => {
    if (onNextEpisode) {
      onNextEpisode();
      return;
    }
    if (nextEpisode) {
      handleSelectEpisode(nextEpisode);
    }
  };

  nextEpisodeHandler.current = handleNextEpisode;

  const handleClose = () => {
    setStopped(true);
    reportProgress(true);
    if (isCasting) {
      handleDisconnectCast();
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    onClose();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'ArrowLeft') seek(-10);
      if (e.key === 'ArrowRight') seek(10);
      if (e.key === '0' || e.key === 'Home') handleRestart();
      if ((e.key === 'n' || e.key === 'N') && (nextEpisode || onNextEpisode)) {
        handleNextEpisode();
      }
      if (e.key === 'f') toggleFullscreen();
      if (e.key === 'm') toggleMute();
      if (e.key === 'c' || e.key === 'C') {
        setActiveMenu((prev) => (prev === 'subtitles' ? null : 'subtitles'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration, currentTime, nextEpisode, onNextEpisode]);

  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef} data-playback-state={state}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden cursor-auto"
    >
      {/* Loading Indicator */}
      {(isLoadingEpisode || isLoadingStream) && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-40 space-y-4 p-6 text-center">
          <div className="relative">
            <div className="w-14 h-14 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
            {isTorrentStream && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Download size={18} className="text-red-500 animate-pulse" />
              </div>
            )}
          </div>
          <div className="space-y-1.5 max-w-sm">
            <span className="text-sm font-bold text-white">
              {isTorrentStream
                ? 'Connecting to torrent swarm...'
                : isLoadingEpisode
                ? 'Loading series episode...'
                : isTranscoding
                ? 'Preparing hardware-accelerated stream...'
                : 'Loading media stream...'}
            </span>
            {isTorrentStream && (
              <p className="text-xs text-neutral-400">
                Playback begins automatically once enough data has arrived
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stream Error Dialog */}
      {castError && (
        <button type="button" role="alert" onClick={() => setCastError(false)}
          className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded bg-black/90 px-4 py-2 text-sm text-white">
          Chromecast could not start playback. Playback returned to this device.
        </button>
      )}
      {streamError && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center z-40 space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-white">Playback Error</h3>
          <p className="text-sm text-gray-400 max-w-md">
            Unable to stream this media. Verify your server is online and the media file is accessible.
          </p>
          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={handleRetryPlayback}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded transition-all shadow-lg"
            >
              Retry Playback
            </button>
            <button
              onClick={handleClose}
              className="bg-neutral-800 hover:bg-neutral-700 text-gray-300 font-semibold px-4 py-2.5 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* HTML5 Stream Player & PC Static Backdrop Preview */}
      <div className="relative w-full h-full flex items-center justify-center" onClick={togglePlay}>
        <video
          ref={videoRef}
          crossOrigin="anonymous"
          onTimeUpdate={() => {
            if (isMidStreamBuffering) setIsMidStreamBuffering(false);
            handleTimeUpdate();
          }}
          onProgress={handleProgress}
          onWaiting={() => setIsMidStreamBuffering(true)}
          onStalled={() => setIsMidStreamBuffering(true)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onPlaying={() => { setIsPlaying(true); setIsLoadingStream(false); setIsMidStreamBuffering(false); }}
          onCanPlay={() => setIsMidStreamBuffering(false)}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handlePlaybackError}
          onEnded={() => {
            reportProgress(true);
            if (nextEpisode || onNextEpisode) {
              if (autoplayEpisodes) handleNextEpisode();
              return;
            }
            setShowEndOverlay(true);
            setEndTrailerKey(null);
            void (async () => {
              try {
                const res = await apiFetch(`/api/media/${encodeURIComponent(item.id)}/recommendations`);
                if (!res.ok) return;
                const data = (await res.json()) as { items?: MediaItem[] };
                const recs = (data.items || []).slice(0, 8);
                setEndRecommendations(recs);
                const lead = recs[0];
                if (lead) {
                  const params = new URLSearchParams({
                    title: lead.title,
                    type: lead.type === 'Series' ? 'tv' : 'movie',
                  });
                  if (lead.tmdbId) params.set('tmdbId', String(lead.tmdbId));
                  const tr = await apiFetch(`/api/trailer?${params.toString()}`);
                  if (tr.ok) {
                    const trData = (await tr.json()) as { trailer?: { key?: string }; trailerKey?: string; key?: string };
                    setEndTrailerKey(trData.trailer?.key || trData.trailerKey || trData.key || null);
                  }
                }
              } catch {
                // Ignore recommendation fetch errors on end screen.
              }
            })();
          }}
          className={isCasting ? 'hidden' : 'w-full h-full object-contain cursor-pointer'}
          playsInline
        >
          {subtitles.filter((sub) => !sub.burnIn && sub.src).map((sub) => (
            <track
              key={sub.id}
              id={`sub-${sub.id}`}
              data-subtitle-id={sub.id}
              kind="subtitles"
              src={sub.src}
              srcLang={sub.language}
              label={sub.title}
              default={sub.isDefault}
            />
          ))}
        </video>

        {/* Mid-Stream Buffering Overlay when waiting for data */}
        {isMidStreamBuffering && !isLoadingEpisode && !isLoadingStream && !isCasting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
            <div className="px-6 py-4 rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 flex flex-col items-center space-y-2.5 shadow-2xl animate-in fade-in duration-200">
              <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-xs sm:text-sm font-semibold text-white/95">
                  {isTorrentStream ? 'Buffering torrent stream...' : 'Buffering stream...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Static Backdrop Preview when Casting on PC */}
        {isCasting && (
          <div className="hidden md:flex absolute inset-0 w-full h-full items-center justify-center overflow-hidden">
            <img
              src={activeEpisode?.thumbnailUrl || item.backdropUrl || item.posterUrl}
              alt={currentTitle}
              className="w-full h-full object-cover opacity-50 filter blur-sm scale-105 pointer-events-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/80 pointer-events-none" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4 z-10 pointer-events-auto">
              <div className="w-20 h-20 rounded-full bg-red-600/20 border-2 border-red-500/60 flex items-center justify-center text-red-500 animate-pulse shadow-2xl">
                <Cast size={40} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold text-white drop-shadow">
                  Casting to {castDeviceName || 'Chromecast'}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 max-w-md">
                  {currentTitle} is playing on your TV screen.
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDisconnectCast();
                }}
                className="px-4 py-1.5 rounded-full bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors shadow"
              >
                Disconnect Cast
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cast Remote UI (Samsung S26 / Mobile phones) */}
      {isCasting && (
        <div className="flex md:hidden absolute inset-0 flex-col justify-between p-4 pb-8 z-40 bg-neutral-950/95 overflow-y-auto pointer-events-auto">
          {/* Top Bar: Back button, Casting status badge, Disconnect */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleClose}
              className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white"
              title="Close"
            >
              <ArrowLeft size={24} />
            </button>

            <div className="flex items-center space-x-1.5 bg-red-950/80 border border-red-800/80 px-2.5 py-1 rounded-full text-xs text-red-300 font-medium shadow">
              <Cast size={13} className="text-red-400" />
              <span className="truncate max-w-[130px]">{castDeviceName || 'Chromecast'}</span>
            </div>

            <button
              onClick={handleDisconnectCast}
              className="text-xs text-neutral-300 hover:text-white px-2.5 py-1 rounded border border-neutral-700 bg-neutral-900 active:bg-neutral-800"
            >
              Disconnect
            </button>
          </div>

          {/* Center: Static Artwork Preview & Metadata */}
          <div className="flex flex-col items-center justify-center my-auto space-y-4 px-2 py-4">
            <div className="relative w-44 aspect-[2/3] sm:w-52 rounded-xl overflow-hidden shadow-2xl border border-neutral-800">
              <img
                src={activeEpisode?.thumbnailUrl || item.posterUrl || item.backdropUrl}
                alt={currentTitle}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                <div className="flex items-center space-x-1 text-[11px] text-red-400 font-semibold">
                  <Cast size={12} />
                  <span>Playing on TV</span>
                </div>
              </div>
            </div>

            <div className="text-center space-y-1 max-w-xs">
              <h2 className="text-lg font-bold text-white line-clamp-1">{item.title}</h2>
              {activeEpisode && (
                <p className="text-xs text-neutral-400 font-medium line-clamp-1">
                  S{activeEpisode.seasonNumber}:E{activeEpisode.episodeNumber} • {activeEpisode.name}
                </p>
              )}
            </div>
          </div>

          {/* Bottom: Timeline Scrubber + Controls + Settings */}
          <div className="space-y-4">
            {/* Timeline Scrubber */}
            <div className="space-y-1.5">
              <div className="relative w-full flex items-center py-1">
                {/* Track background */}
                <div className="relative w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  {/* Browser buffer in RAM */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-white/40 transition-all duration-150"
                    style={{ width: `${buffered}%` }}
                  />
                  {/* Playback progress */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-red-600 transition-none"
                    style={{ width: `${playPercent}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={displayDuration || 100}
                  step={0.5}
                  value={currentTime}
                  onChange={handleScrubChange}
                  onMouseUp={handleScrubEnd}
                  onTouchEnd={handleScrubEnd}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
              </div>
              <div className="flex justify-between text-xs font-mono text-neutral-400">
                <span>{formatTime(currentTime)}</span>

                <span>{formatTime(displayDuration)}</span>
              </div>
            </div>

            {seriesEpisodes.length > 0 && <label className="flex items-center justify-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" checked={autoplayEpisodes} onChange={event => { setAutoplayEpisodes(event.target.checked); localStorage.setItem('homestream-autoplay', String(event.target.checked)); }} />
              Play next episode automatically
            </label>}
            {/* Primary Remote Touch Buttons */}
            <div className="flex items-center justify-center space-x-5 sm:space-x-7">
              <button
                onClick={handleRestart}
                className="p-2 text-neutral-400 hover:text-white active:scale-95 transition-all flex flex-col items-center"
                title="Restart from 0:00"
              >
                <RotateCcw size={20} />
                <span className="text-[10px] mt-0.5">Restart</span>
              </button>

              <button
                onClick={() => seek(-10)}
                className="p-2.5 rounded-full bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 active:scale-95 transition-all"
                title="Rewind 10s"
              >
                <RotateCcw size={22} />
              </button>

              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center active:scale-90 transition-all shadow-xl"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={28} /> : <Play size={28} className="fill-white ml-0.5" />}
              </button>

              <button
                onClick={() => seek(10)}
                className="p-2.5 rounded-full bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 active:scale-95 transition-all"
                title="Forward 10s"
              >
                <RotateCw size={22} />
              </button>

              {(item.type === 'Series' || onNextEpisode || nextEpisode) && (
                <button
                  onClick={handleNextEpisode}
                  disabled={!nextEpisode && !onNextEpisode}
                  className={`p-2 transition-all active:scale-95 flex flex-col items-center ${
                    nextEpisode || onNextEpisode ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 opacity-40'
                  }`}
                  title="Next Episode"
                >
                  <SkipForward size={20} />
                  <span className="text-[10px] mt-0.5">Next</span>
                </button>
              )}
            </div>

            {/* Subtitles & Audio bar */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 px-1">
              <button
                onClick={() => {
                  setActiveMenu('subtitles');
                }}
                className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  selectedSubtitleId
                    ? 'bg-red-950/80 border-red-700 text-red-400'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                }`}
              >
                <Subtitles size={14} />
                <span>
                  Subtitles:{' '}
                  {selectedSubtitleId ? subtitles.find((s) => s.id === selectedSubtitleId)?.title || 'On' : 'Off'}
                </span>
              </button>

              <button
                onClick={toggleMute}
                className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Web Player Overlay Controls (Desktop / Standard View) */}
      <div
        className={`${isCasting ? 'hidden md:flex' : 'flex'} absolute inset-0 pointer-events-none transition-opacity duration-300 flex-col justify-between ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top Header Bar */}
        <div className="p-3 sm:p-6 md:p-8 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between pointer-events-auto">
          {/* Back button + Media Title + In-Progress Badge */}
          <div className="flex items-center space-x-2.5 sm:space-x-4 min-w-0 flex-1 mr-4">
            <button
              onClick={handleClose}
              className="p-1.5 sm:p-2 rounded-full hover:bg-white/20 text-white transition-colors shrink-0"
              title="Back (Esc)"
            >
              <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center space-x-3">
                <h2 className="text-white font-bold text-base sm:text-lg md:text-xl drop-shadow truncate">
                  {item.title}
                </h2>
                {isTorrentStream && (
                  <div className="flex items-center space-x-1.5 px-2.5 py-0.5 bg-blue-600/30 border border-blue-500/40 rounded-full text-blue-300 text-xs backdrop-blur-md shrink-0 shadow">
                    <Download className="w-3 h-3" />
                    <span>Torrent stream</span>
                  </div>
                )}
              </div>
              {activeEpisode && (
                <p className="text-neutral-400 text-xs sm:text-sm font-medium truncate">
                  Season {activeEpisode.seasonNumber}, Episode {activeEpisode.episodeNumber}: {activeEpisode.name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Center Floating Play/Pause for Mobile & Quick Touch (Hidden while casting) */}
        {!isCasting && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              onClick={togglePlay}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-white flex items-center justify-center pointer-events-auto hover:scale-110 active:scale-90 transition-all shadow-2xl backdrop-blur-sm"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-white" />
              ) : (
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-white ml-1" />
              )}
            </button>
          </div>
        )}

        {/* Bottom Controls Bar */}
        <div
          className="p-3 sm:p-6 md:p-8 pb-4 sm:pb-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-auto space-y-2 sm:space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Timeline Scrubber Container */}
          <div
            className="relative group/scrubber cursor-pointer w-full flex items-center py-2 select-none"
            onMouseMove={handleScrubberMouseMove}
            onMouseLeave={() => {
              setHoverTime(null);
              setHoverPos(null);
            }}
          >
            {/* Scrubber Track Bar */}
            <div className="relative w-full h-1 group-hover/scrubber:h-2 bg-neutral-800 rounded-full overflow-hidden transition-all duration-150">

              {/* Browser Buffered Bar (in memory) */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/40 transition-all duration-150"
                style={{ width: `${buffered}%` }}
              />

              {/* Playback Progress Bar */}
              <div
                className="absolute left-0 top-0 bottom-0 bg-red-600 transition-none"
                style={{ width: `${playPercent}%` }}
              />
            </div>

            {/* Scrubber Thumb Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-red-600 rounded-full shadow-lg scale-0 group-hover/scrubber:scale-100 transition-transform pointer-events-none z-10"
              style={{ left: `${playPercent}%` }}
            />

            {/* Hover Timestamp, Trickplay Thumbnail & Buffer Preview Tooltip */}
            {hoverTime !== null && hoverPos !== null && (
              <div
                className="absolute bottom-full mb-2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-30"
                style={{ left: `${hoverPos}%` }}
              >
                {activeHoverCue && (
                  <div
                    className="rounded-md border border-neutral-600 shadow-2xl overflow-hidden bg-black"
                    style={{
                      width: `${Math.min(180, activeHoverCue.w)}px`,
                      height: `${Math.round((Math.min(180, activeHoverCue.w) * activeHoverCue.h) / activeHoverCue.w)}px`,
                    }}
                  >
                    <div
                      style={{
                        width: `${activeHoverCue.w}px`,
                        height: `${activeHoverCue.h}px`,
                        backgroundImage: `url(${activeHoverCue.src})`,
                        backgroundPosition: `-${activeHoverCue.x}px -${activeHoverCue.y}px`,
                        backgroundRepeat: 'no-repeat',
                        transform: `scale(${Math.min(180, activeHoverCue.w) / activeHoverCue.w})`,
                        transformOrigin: 'top left',
                      }}
                    />
                  </div>
                )}
                <div className="px-2.5 py-1 bg-black/90 backdrop-blur-md border border-neutral-700 rounded text-[11px] font-mono text-white shadow-xl whitespace-nowrap">
                  <span>{formatTime(hoverTime)}</span>

                </div>
              </div>
            )}

            {/* Transparent native range input over top for frictionless scrub & drag */}
            <input
              type="range"
              min={0}
              max={displayDuration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleScrubChange}
              onMouseUp={handleScrubEnd}
              onTouchEnd={handleScrubEnd}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              aria-label="Seek time"
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between text-white pt-0.5 sm:pt-1">
            {/* Left: Play/Pause, Rewind, Forward, Volume, Time */}
            <div className="flex items-center space-x-2 sm:space-x-4 md:space-x-6 min-w-0">
              <button
                onClick={togglePlay}
                className="hover:text-red-500 transition-colors p-1"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white" />}
              </button>

              <button
                onClick={() => seek(-10)}
                className="hover:text-neutral-300 transition-colors p-1"
                title="Rewind 10 seconds"
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                onClick={() => seek(10)}
                className="hover:text-neutral-300 transition-colors p-1"
                title="Fast forward 10 seconds"
              >
                <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Volume control: mute toggle everywhere; range slider on desktop/tablet hover */}
              <div
                className="flex items-center space-x-1 sm:space-x-2 group/volume relative py-1"
                onMouseEnter={() => setIsVolumeHovered(true)}
                onMouseLeave={() => setIsVolumeHovered(false)}
              >
                <button onClick={toggleMute} className="hover:text-neutral-300 transition-colors p-1" title={isMuted ? 'Unmute' : 'Mute'}>
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
                {(isVolumeHovered || isVolumeInteracting) && (
                  <div className="hidden sm:flex items-center w-20 transition-all duration-200">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      onMouseDown={() => setIsVolumeInteracting(true)}
                      onMouseUp={() => setIsVolumeInteracting(false)}
                      onTouchStart={() => setIsVolumeInteracting(true)}
                      onTouchEnd={() => setIsVolumeInteracting(false)}
                      className="w-20 h-1 bg-neutral-600 rounded appearance-none cursor-pointer accent-white"
                    />
                  </div>
                )}
              </div>

              {/* Time Display */}
              <div className="text-[11px] sm:text-xs md:text-sm font-mono text-neutral-300 whitespace-nowrap">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1 text-neutral-500">/</span>
                <span>{formatTime(displayDuration)}</span>
              </div>
            </div>

            {/* Center: Title on Tablet/Desktop */}
            <div className="hidden xl:block text-sm font-semibold text-neutral-300 truncate max-w-sm px-4">
              {currentTitle}
            </div>

            {/* Right: SyncPlay, Audio, Subtitles, Settings, Next Episode (Series), Fullscreen */}
            <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 relative shrink-0">
              {/* SyncPlay Button */}
              <button
                onClick={() => setActiveMenu((prev) => (prev === 'syncplay' ? null : 'syncplay'))}
                className={`transition-colors p-1.5 rounded-lg hover:bg-white/10 flex items-center gap-1 ${
                  syncRoomCode ? 'text-emerald-400' : 'text-neutral-300 hover:text-white'
                }`}
                title="SyncPlay (Watch Together)"
                aria-label="SyncPlay"
              >
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                {syncRoomCode && <span className="text-[11px] font-mono">{syncRoomCode}</span>}
              </button>

              {/* Audio Button */}
              <button
                onClick={() => setActiveMenu((prev) => (prev === 'audio' ? null : 'audio'))}
                className={`transition-colors p-1.5 rounded-lg hover:bg-white/10 ${
                  selectedAudioIndex !== undefined ? 'text-red-500' : 'text-neutral-300 hover:text-white'
                }`}
                title="Audio"
                aria-label="Audio"
              >
                <AudioLines className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Subtitles Button */}
              <button
                onClick={() => setActiveMenu((prev) => (prev === 'subtitles' ? null : 'subtitles'))}
                className={`transition-colors p-1.5 rounded-lg hover:bg-white/10 ${
                  selectedSubtitleId ? 'text-red-500' : 'text-neutral-300 hover:text-white'
                }`}
                title="Subtitles (C)"
                aria-label="Subtitles"
              >
                <Subtitles className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Settings Button (Quality, Video Version, Cast, Restart, Playback Info) */}
              <button
                onClick={() => setActiveMenu((prev) => (prev === 'settings' ? null : 'settings'))}
                className={`transition-colors p-1.5 rounded-lg hover:bg-white/10 relative ${
                  activeMenu === 'settings' || isCasting
                    ? 'text-white'
                    : 'text-neutral-300 hover:text-white'
                }`}
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                {(isCasting || isCastConnecting) && (
                  <span
                    className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${
                      isCasting
                        ? 'bg-red-500'
                        : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                )}
              </button>

              {/* Episodes / Mix Playlist listing button */}
              {seriesEpisodes.length > 0 && (
                <button
                  onClick={() => setActiveMenu((prev) => (prev === 'episodes' ? null : 'episodes'))}
                  className={`flex items-center space-x-1 sm:space-x-1.5 transition-colors text-xs sm:text-sm font-semibold p-1.5 rounded-lg hover:bg-white/10 ${
                    activeMenu === 'episodes' ? 'text-white bg-white/15' : 'text-neutral-300 hover:text-white'
                  }`}
                  title={item.id?.startsWith('yt-') ? 'Mix Playlist' : 'Episodes'}
                  aria-label={item.id?.startsWith('yt-') ? 'Mix Playlist' : 'Episodes'}
                >
                  <ListVideo className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden lg:inline">{item.id?.startsWith('yt-') ? 'Mix' : 'Episodes'}</span>
                </button>
              )}

              {/* Skip Forward / Next Episode on TV shows */}
              {(item.type === 'Series' || onNextEpisode || nextEpisode) && (
                <button
                  onClick={handleNextEpisode}
                  disabled={!nextEpisode && !onNextEpisode}
                  className={`flex items-center space-x-1 sm:space-x-1.5 transition-colors text-xs sm:text-sm font-semibold p-1.5 rounded-lg hover:bg-white/10 ${
                    nextEpisode || onNextEpisode
                      ? 'hover:text-white text-neutral-300 cursor-pointer'
                      : 'text-neutral-600 cursor-not-allowed opacity-50'
                  }`}
                  title={nextEpisode ? `Next Episode: ${nextEpisode.name || `S${nextEpisode.seasonNumber}E${nextEpisode.episodeNumber}`}` : 'Next Episode (N)'}
                  aria-label="Next Episode"
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden lg:inline">Next</span>
                </button>
              )}

              <button
                onClick={toggleFullscreen}
                className="hover:text-neutral-300 transition-colors p-1.5 rounded-lg hover:bg-white/10"
                title="Fullscreen (F)"
                aria-label="Fullscreen"
              >
                {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeMenu === 'episodes' && seriesEpisodes.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-24 sm:right-6 z-40 w-full sm:w-96 max-h-[75vh] flex flex-col bg-[#141414]/95 backdrop-blur-xl border-t sm:border border-white/15 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ListVideo className="w-4 h-4 text-[#E50914]" />
              <span className="text-sm font-bold text-white">
                {item.id?.startsWith('yt-') ? 'Mix Playlist' : 'Episodes'}
              </span>
              <span className="text-xs text-neutral-400">({seriesEpisodes.length})</span>
            </div>
            <button
              onClick={() => setActiveMenu(null)}
              className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto p-2 space-y-1">
            {seriesEpisodes.map((ep, idx) => {
              const isCurrent = ep.id === activePlayableId || ep.id === activeEpisode?.id;
              const isYouTube = item.id?.startsWith('yt-');
              return (
                <button
                  key={ep.id}
                  onClick={() => handleSelectEpisode(ep)}
                  className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition ${
                    isCurrent ? 'bg-[#E50914]/20 border border-[#E50914]/50' : 'hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <span className={`text-xs font-bold w-8 shrink-0 ${isCurrent ? 'text-[#E50914]' : 'text-neutral-400'}`}>
                    {isYouTube ? `${idx + 1}.` : `S${ep.seasonNumber}E${ep.episodeNumber}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-white' : 'text-neutral-200'}`}>
                      {ep.name}
                    </p>
                    {ep.overview && (
                      <p className="text-xs text-neutral-400 truncate mt-0.5">{ep.overview}</p>
                    )}
                  </div>
                  {isCurrent && <Play className="w-3.5 h-3.5 text-[#E50914] shrink-0 fill-current" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Universal Subtitles Selection Sheet / Modal (Responsive: Mobile Bottom Sheet + Desktop Centered) */}
      {activeSkipSegment && (
        <button
          onClick={() => {
            const targetSec = activeSkipSegment.endSeconds;
            const castMedia = (window as any).cast?.framework?.CastContext?.getInstance?.()?.getCurrentSession?.()?.getMediaSession?.();
            if (isCasting && castMedia && (window as any).chrome?.cast?.media?.SeekRequest) {
              const req = new (window as any).chrome.cast.media.SeekRequest();
              req.currentTime = targetSec;
              castMedia.seek(req, () => {}, () => {});
            } else if (videoRef.current) {
              videoRef.current.currentTime = targetSec;
            }
            setCurrentTime(targetSec);
          }}
          className="absolute bottom-24 right-6 z-40 bg-white/95 hover:bg-white text-black font-bold text-xs sm:text-sm px-4 py-2 rounded-lg shadow-2xl transition"
        >
          {activeSkipSegment.type === 'credits'
            ? 'Skip Credits →'
            : activeSkipSegment.type === 'recap'
              ? 'Skip Recap →'
              : 'Skip Intro →'}
        </button>
      )}

      {activeMenu === 'audio' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setActiveMenu(null)}
        >
          <div
            className="w-full sm:max-w-md bg-neutral-900 border border-neutral-800 rounded-t-2xl sm:rounded-xl p-5 space-y-4 max-h-[75vh] overflow-y-auto animate-fade-in shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Audio tracks"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center space-x-2 text-white font-bold text-base">
                <AudioLines size={18} className="text-red-500" />
                <span>Audio</span>
              </div>
              <button
                onClick={() => setActiveMenu(null)}
                className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={() => {
                  setVersionResumeSec(currentTimeRef.current);
                  setHasTriedFallbackTranscode(false);
                  setSelectedAudioIndex(undefined);
                  setActiveMenu(null);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm flex items-center justify-between transition-colors ${
                  selectedAudioIndex === undefined
                    ? 'bg-red-600/20 text-red-400 font-bold border border-red-600/40'
                    : 'text-neutral-300 hover:bg-neutral-800 border border-transparent'
                }`}
              >
                <span>Auto audio</span>
                {selectedAudioIndex === undefined && <Check size={18} />}
              </button>

              {audioTracks.map((track) => (
                <button
                  key={track.index}
                  onClick={() => {
                    setVersionResumeSec(currentTimeRef.current);
                    setHasTriedFallbackTranscode(false);
                    setSelectedAudioIndex(track.index);
                    setActiveMenu(null);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm flex items-center justify-between transition-colors ${
                    selectedAudioIndex === track.index
                      ? 'bg-red-600/20 text-red-400 font-bold border border-red-600/40'
                      : 'text-neutral-300 hover:bg-neutral-800 border border-transparent'
                  }`}
                >
                  <span className="truncate pr-2">{track.title}</span>
                  {selectedAudioIndex === track.index && <Check size={18} />}
                </button>
              ))}

              {audioTracks.length === 0 && (
                <div className="text-sm text-neutral-500 py-3 text-center italic">
                  Using default audio track
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeMenu === 'subtitles' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setActiveMenu(null)}
        >
          <div
            className="w-full sm:max-w-md bg-neutral-900 border border-neutral-800 rounded-t-2xl sm:rounded-xl p-5 space-y-4 max-h-[75vh] overflow-y-auto animate-fade-in shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Subtitles"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center space-x-2 text-white font-bold text-base">
                <Subtitles size={18} className="text-red-500" />
                <span>Subtitles</span>
              </div>
              <button
                onClick={() => setActiveMenu(null)}
                className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={() => {
                  changeSubtitleTrack(null);
                  setActiveMenu(null);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm flex items-center justify-between transition-colors ${
                  selectedSubtitleId === null
                    ? 'bg-red-600/20 text-red-400 font-bold border border-red-600/40'
                    : 'text-neutral-300 hover:bg-neutral-800 border border-transparent'
                }`}
              >
                <span>Off</span>
                {selectedSubtitleId === null && <Check size={18} />}
              </button>

              {subtitles.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => {
                    changeSubtitleTrack(sub.id);
                    setActiveMenu(null);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm flex items-center justify-between transition-colors ${
                    selectedSubtitleId === sub.id
                      ? 'bg-red-600/20 text-red-400 font-bold border border-red-600/40'
                      : 'text-neutral-300 hover:bg-neutral-800 border border-transparent'
                  }`}
                >
                  <span className="truncate pr-2">{sub.title}</span>
                  {selectedSubtitleId === sub.id && <Check size={18} />}
                </button>
              ))}

              {subtitles.length === 0 && !isLoadingSubtitles && (
                <div className="text-sm text-neutral-500 py-4 text-center italic">
                  No subtitle tracks available for this title
                </div>
              )}

              {isLoadingSubtitles && (
                <div className="py-4 flex items-center justify-center space-x-2 text-neutral-400 text-sm">
                  <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  <span>Loading subtitle tracks...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeMenu === 'syncplay' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setActiveMenu(null)}
        >
          <div
            className="w-full sm:max-w-md bg-neutral-900 border border-neutral-800 rounded-t-2xl sm:rounded-xl p-5 space-y-4 max-h-[80vh] overflow-y-auto animate-fade-in shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="SyncPlay"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center space-x-2 text-white font-bold text-base">
                <Users size={18} className="text-emerald-400" />
                <span>SyncPlay (Watch Together)</span>
              </div>
              <button
                onClick={() => setActiveMenu(null)}
                className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                aria-label="Close SyncPlay"
              >
                <X size={18} />
              </button>
            </div>

            {syncRoomCode ? (
              <div className="space-y-3 text-xs">
                <div className="bg-black/60 border border-neutral-700 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-neutral-400">Room Code</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{syncRoomCode}</span>
                </div>
                <div className="text-neutral-400">
                  Participants ({syncParticipants.length}): {syncParticipants.map((p) => p.name).join(', ')}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      void apiFetch('/api/syncplay', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'sync',
                          code: syncRoomCode,
                          itemId: activePlayableId || item.id,
                          isPaused: !isPlaying,
                          positionTicks: Math.round(currentTime * 10_000_000),
                        }),
                      })
                    }
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 rounded-lg"
                  >
                    Push Sync
                  </button>
                  <button
                    onClick={() => {
                      void apiFetch('/api/syncplay', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'leave', code: syncRoomCode }),
                      });
                      setSyncRoomCode('');
                      setSyncParticipants([]);
                    }}
                    className="px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 py-2 rounded-lg"
                  >
                    Leave
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <button
                  onClick={async () => {
                    const res = await apiFetch('/api/syncplay', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'create',
                        itemId: activePlayableId || item.id,
                        title: currentTitle,
                        isPaused: !isPlaying,
                        positionTicks: Math.round(currentTime * 10_000_000),
                      }),
                    });
                    const d = await res.json().catch(() => ({}));
                    if (d.room?.code) {
                      setSyncRoomCode(d.room.code);
                      setSyncParticipants(d.room.participants || []);
                    }
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg"
                >
                  Create SyncPlay Room
                </button>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={syncJoinCode}
                    onChange={(e) => setSyncJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter room code"
                    className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 font-mono text-white"
                  />
                  <button
                    onClick={async () => {
                      if (!syncJoinCode.trim()) return;
                      const res = await apiFetch('/api/syncplay', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'join',
                          code: syncJoinCode.trim(),
                          itemId: activePlayableId || item.id,
                        }),
                      });
                      const d = await res.json().catch(() => ({}));
                      if (res.ok && d.room?.code) {
                        setSyncRoomCode(d.room.code);
                        setSyncParticipants(d.room.participants || []);
                        setSyncJoinCode('');
                      } else if (d?.error) {
                        alert(d.error);
                      }
                    }}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white font-semibold px-4 py-2 rounded-lg"
                  >
                    Join
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeMenu === 'settings' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setActiveMenu(null)}
        >
          <div
            className="w-full sm:max-w-md bg-neutral-900 border border-neutral-800 rounded-t-2xl sm:rounded-xl p-5 space-y-4 max-h-[80vh] overflow-y-auto animate-fade-in shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Player settings"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center space-x-2 text-white font-bold text-base">
                <Settings size={18} className="text-red-500" />
                <span>Settings</span>
              </div>
              <button
                onClick={() => setActiveMenu(null)}
                className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                aria-label="Close settings"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quality */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Quality
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['auto', 'original', '1080p', '720p'] as QualityMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      const cur = currentTimeRef.current;
                      if (Number.isFinite(cur) && cur >= 0) setVersionResumeSec(cur);
                      setHasTriedFallbackTranscode(false);
                      setQualityMode(mode);
                    }}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold capitalize transition-colors border ${
                      qualityMode === mode
                        ? 'bg-red-600/20 text-red-400 border-red-600/40'
                        : 'bg-neutral-800/70 text-neutral-300 hover:bg-neutral-800 border-transparent'
                    }`}
                  >
                    {mode === 'auto' ? 'Auto' : mode === 'original' ? 'Original' : mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Video Version */}
            {versions.length > 1 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Video Version
                </div>
                <div className="space-y-1.5">
                  {versions.map((v) => {
                    const isSelected = (selectedVersionId || versions[0]?.id || '') === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => {
                          const cur = currentTimeRef.current;
                          if (Number.isFinite(cur) && cur >= 0) setVersionResumeSec(cur);
                          setHasTriedFallbackTranscode(false);
                          setSelectedAudioIndex(undefined);
                          setSelectedVersionId(v.id);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors border ${
                          isSelected
                            ? 'bg-red-600/20 text-red-400 font-semibold border-red-600/40'
                            : 'text-neutral-300 hover:bg-neutral-800 border-transparent'
                        }`}
                      >
                        <span className="truncate pr-2">{v.label}</span>
                        {isSelected && <Check size={16} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Other Controls: Cast, Restart */}
            <div className="space-y-1.5 pt-1 border-t border-neutral-800">
              <button
                onClick={() => {
                  handleCastClick();
                  setActiveMenu(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-neutral-200 hover:bg-neutral-800 flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2.5">
                  <Cast
                    size={16}
                    className={
                      isCasting
                        ? 'text-red-500'
                        : isCastConnecting
                        ? 'text-amber-400 animate-pulse'
                        : 'text-neutral-400'
                    }
                  />
                  <span>
                    {isCasting
                      ? `Casting to ${castDeviceName || 'Chromecast'}`
                      : isCastConnecting
                      ? 'Connecting to Chromecast...'
                      : 'Cast to Chromecast'}
                  </span>
                </span>
                <span className="text-xs text-neutral-500">
                  {isCasting ? 'Disconnect' : isCastAvailable ? 'Ready' : ''}
                </span>
              </button>

                  <button
                    onClick={() => {
                      handleRestart();
                      setActiveMenu(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-neutral-200 hover:bg-neutral-800 flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <RotateCcw size={16} className="text-neutral-400" />
                      <span>Restart {activeEpisode ? 'Episode' : 'Movie'}</span>
                    </span>
                    <span className="text-xs text-neutral-500">0:00</span>
                  </button>
                </div>

                {/* Playback Info */}
                {playbackDiag && (
                  <div className="pt-2 border-t border-neutral-800 text-[11px] text-neutral-400 space-y-0.5">
                    <div className="font-semibold text-neutral-300">Playback Info</div>
                    <div>
                      {[
                        playbackDiag.playMethod,
                        playbackDiag.resolution,
                        playbackDiag.sourceVideoCodec,
                        playbackDiag.sourceAudioCodec,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {playbackDiag.transcodeReasons && (
                      <div className="text-neutral-500">Reason: {playbackDiag.transcodeReasons}</div>
                    )}
                  </div>
                )}
          </div>
        </div>
      )}

      {showEndOverlay && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-6 md:p-10 overflow-y-auto">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-neutral-400">Up Next</p>
              <h2 className="text-xl md:text-2xl font-bold text-white">
                {endRecommendations[0]?.title ? `Trailer: ${endRecommendations[0].title}` : `More Like ${item.title}`}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowEndOverlay(false);
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    void videoRef.current.play();
                  }
                }}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-semibold transition"
              >
                Replay
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEndOverlay(false);
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>

          {endTrailerKey && (
            <div className="my-5 w-full max-w-4xl mx-auto aspect-video rounded-xl overflow-hidden border border-neutral-800 bg-black shadow-2xl">
              <video
                key={endTrailerKey}
                src={`/api/v1/youtube/stream-video?videoId=${encodeURIComponent(endTrailerKey)}`}
                controls
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain bg-black"
              />
            </div>
          )}

          {endRecommendations.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">More Like This</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {endRecommendations.map((rec) => (
                  <a
                    key={rec.id}
                    href={`/${rec.type === 'Series' ? 'tvshows' : 'movies'}/play/${encodeURIComponent(rec.id)}`}
                    className="group relative flex-shrink-0 w-36 sm:w-44 aspect-square rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-white transition"
                  >
                    {(rec.backdropUrl || rec.posterUrl) && (
                      <img
                        src={rec.backdropUrl || rec.posterUrl}
                        alt={rec.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-2.5">
                      <p className="text-xs font-bold text-white truncate">{rec.title}</p>
                      <p className="text-[11px] text-neutral-300">
                        {rec.year ? `${rec.year} • ` : ''}Play now
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
