'use client';
import { apiFetch } from '@/api/client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Plus, Check, ThumbsUp, ChevronDown, Download, Clock, Volume2, VolumeX } from 'lucide-react';
import { MediaItem } from '@/types';

interface MediaCardProps {
  item: MediaItem;
  onPlay: (item: MediaItem) => void;
  onOpenModal: (item: MediaItem) => void;
  onRequest?: (item: MediaItem) => void;
  rankNumber?: number; // For Top 10 rows!
  isFirst?: boolean;
  isLast?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  onPlay,
  onOpenModal,
  onRequest,
  rankNumber,
  isFirst = false,
  isLast = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isPreviewMuted, setIsPreviewMuted] = useState(true);
  const [trailerKey, setTrailerKey] = useState<string | null>(item.trailerKey || null);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>(
    isFirst ? 'left' : isLast ? 'right' : 'center'
  );
  const [horizontalOffset, setHorizontalOffset] = useState<number | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trailerRequestRef = useRef<AbortController | null>(null);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const libraryPreview = item.videoStreamUrl?.startsWith('/api/preview-stream?')
    ? item.videoStreamUrl : undefined;
  const isAvailable = item.status === 'available' || item.source === 'jellyfin' || item.source === 'demo';
  const isRequested = item.status === 'requested' || item.status === 'processing';

  // Smooth hover intent delay & preview trigger
  const handleMouseEnter = () => {
    // Dynamically calculate bounded positioning so hover card NEVER gets clipped by parent container edges
    if (cardRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      const parentScroll = cardRef.current.closest('.overflow-x-auto') as HTMLElement | null;
      const containerRect = parentScroll
        ? parentScroll.getBoundingClientRect()
        : { left: 0, right: window.innerWidth };

      // Desktop width is 320px (w-80), tablet is 288px (w-72)
      const isMd = typeof window !== 'undefined' && window.innerWidth >= 768;
      const hoverWidth = isMd ? 320 : 288;
      const cardWidth = cardRect.width;

      // Ideal centered position in viewport coordinates
      const idealLeftInViewport = cardRect.left + (cardWidth - hoverWidth) / 2;
      const idealRightInViewport = idealLeftInViewport + hoverWidth;

      // Safe bounds inside container (with 16px breathing room from edges)
      const minLeft = containerRect.left + 16;
      const maxRight = containerRect.right - 16;

      let targetLeftInViewport = idealLeftInViewport;

      if (idealRightInViewport > maxRight) {
        targetLeftInViewport -= (idealRightInViewport - maxRight);
      }
      if (targetLeftInViewport < minLeft) {
        targetLeftInViewport = minLeft;
      }

      // Store relative pixel offset from card's left edge
      const offset = Math.round(targetLeftInViewport - cardRect.left);
      setHorizontalOffset(offset);

      // Fallback alignment flag
      const spaceRight = containerRect.right - cardRect.right;
      const spaceLeft = cardRect.left - containerRect.left;
      if (spaceRight < 140) {
        setAlignment('right');
      } else if (spaceLeft < 100) {
        setAlignment('left');
      } else {
        setAlignment('center');
      }

      // Smoothly bring partially hidden cards into full view
      if (parentScroll) {
        if (spaceRight < 40) {
          parentScroll.scrollBy({ left: 60 - spaceRight, behavior: 'smooth' });
        } else if (spaceLeft < 40) {
          parentScroll.scrollBy({ left: spaceLeft - 60, behavior: 'smooth' });
        }
      }
    }

    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
      if (libraryPreview) {
        previewTimeoutRef.current = setTimeout(() => setIsPlayingPreview(true), 400);
        return;
      }
      if (item.source === 'jellyfin') return;

      const tmdb = item.tmdbId || (item.id.startsWith('seerr-') ? Number(item.id.replace(/^seerr-(?:movie-|tv-)?/, '')) : undefined);
      const type = item.type === 'Series' ? 'tv' : 'movie';
      const controller = new AbortController();
      trailerRequestRef.current = controller;
      apiFetch(`/api/trailer?tmdbId=${tmdb || ''}&type=${type}&itemId=${item.id}`, { signal: controller.signal })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!controller.signal.aborted && data?.trailer?.key) {
            setTrailerKey(data.trailer.key);
            previewTimeoutRef.current = setTimeout(() => setIsPlayingPreview(true), 400);
          }
        })
        .catch(() => {});
    }, 280);
  };

  const handleMouseLeave = () => {
    trailerRequestRef.current?.abort();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    setIsHovered(false);
    setIsPlayingPreview(false);
  };

  useEffect(() => {
    return () => {
      trailerRequestRef.current?.abort();
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className="relative shrink-0 select-none group cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top 10 Layout: Large stylized rank number on left + poster */}
      {rankNumber ? (
        <div className="flex items-center">
          {/* Big Stylized Rank Number */}
          <div className="text-7xl md:text-8xl font-black text-stroke-white text-transparent select-none tracking-tighter opacity-80 -mr-4 md:-mr-6 z-10 font-sans scale-y-110 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            <span className="text-stroke-gray">{rankNumber}</span>
          </div>

          {/* Poster */}
          <div
            onClick={() => onOpenModal(item)}
            className="w-32 sm:w-36 md:w-44 aspect-[2/3] rounded overflow-hidden relative shadow-lg group-hover:scale-105 transition-transform duration-300 bg-neutral-900"
          >
            <img
              src={item.posterUrl || item.backdropUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      ) : (
        /* Standard 16:9 Backdrop Card */
        <div
          onClick={() => onOpenModal(item)}
          className="w-48 sm:w-56 md:w-64 aspect-video rounded overflow-hidden relative shadow-md bg-neutral-900 group-hover:scale-105 transition-transform duration-300"
        >
          <img
            src={item.backdropUrl || item.posterUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />

          {/* Continue Watching Progress Bar */}
          {typeof item.progressPercent === 'number' && item.progressPercent > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-700">
              <div
                className="h-full bg-red-600"
                style={{ width: `${item.progressPercent}%` }}
              />
            </div>
          )}

          {/* Watched Badge */}
          {item.played && (
            <div
              className="absolute top-2 left-2 z-10 bg-emerald-600/95 text-white rounded-full p-0.5 shadow-md border border-emerald-400/30"
              title="Watched"
            >
              <Check size={12} strokeWidth={3} />
            </div>
          )}

          {/* Status badge in top right corner if from Seerr or Actively Downloading */}
          {item.isDownloading ? (
            <div className="absolute top-2 right-2 z-10">
              <span className="bg-blue-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow backdrop-blur-sm flex items-center space-x-1 border border-blue-400/40">
                <Download size={10} className="animate-pulse" />
                <span>DOWNLOADING {item.downloadProgress || 0}%</span>
              </span>
            </div>
          ) : item.source === 'seerr' && (
            <div className="absolute top-2 right-2 z-10">
              {isAvailable ? (
                <span className="bg-emerald-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow backdrop-blur-sm">
                  ON JELLYFIN
                </span>
              ) : isRequested ? (
                <span className="bg-amber-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow backdrop-blur-sm flex items-center space-x-1">
                  <Clock size={10} />
                  <span>REQUESTED</span>
                </span>
              ) : (
                <span className="bg-blue-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow backdrop-blur-sm flex items-center space-x-1">
                  <Download size={10} />
                  <span>REQUEST</span>
                </span>
              )}
            </div>
          )}

          {/* Title overlay on bottom of card */}
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end">
            <h4 className="text-white text-xs sm:text-sm font-semibold truncate drop-shadow">
              {item.title}
            </h4>
          </div>
        </div>
      )}

      {/* Floating Hover Card with Random Section Video Preview */}
      {isHovered && !rankNumber && (
        <div
          className="hidden md:block absolute -top-24 md:-top-28 z-50 w-72 md:w-80 bg-[#181818] rounded-md shadow-[0_22px_50px_rgba(0,0,0,0.98)] overflow-hidden border border-neutral-700/80 animate-fade-in pointer-events-auto"
          style={{
            left: horizontalOffset !== null
              ? `${horizontalOffset}px`
              : alignment === 'left'
              ? '0px'
              : alignment === 'right'
              ? undefined
              : '50%',
            right: horizontalOffset === null && alignment === 'right' ? '0px' : undefined,
            transform: horizontalOffset === null && alignment === 'center' ? 'translateX(-50%)' : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Card Media Header with Live Video Preview */}
          <div
            onClick={() => onOpenModal(item)}
            className="relative aspect-video w-full bg-neutral-900 cursor-pointer overflow-hidden group/preview"
          >
            {/* Poster / Backdrop Image */}
            <img
              src={item.backdropUrl || item.posterUrl}
              alt={item.title}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isPlayingPreview && !libraryPreview && trailerKey ? 'opacity-0' : 'opacity-100'
              }`}
            />

            {isPlayingPreview && libraryPreview && (
              <video key={libraryPreview} src={libraryPreview} autoPlay muted loop playsInline
                onError={() => setIsPlayingPreview(false)}
                className="absolute inset-0 h-full w-full object-cover pointer-events-none" />
            )}

            {isPlayingPreview && !libraryPreview && trailerKey && (
              <div className="absolute inset-0 w-full h-full overflow-hidden bg-black pointer-events-none">
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=${isPreviewMuted ? 1 : 0}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&loop=1&playlist=${trailerKey}&playsinline=1&enablejsapi=1`}
                  title={item.title}
                  className="w-full h-full object-cover scale-135 pointer-events-none"
                  allow="autoplay; encrypted-media"
                />
              </div>
            )}

            {/* Preview Audio Mute/Unmute Button */}
            {isPlayingPreview && !libraryPreview && trailerKey && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const nextMute = !isPreviewMuted;
                  setIsPreviewMuted(nextMute);
                  if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage(
                      JSON.stringify({ event: 'command', func: nextMute ? 'mute' : 'unMute', args: [] }),
                      '*'
                    );
                  }
                }}
                className="absolute bottom-2 right-2 z-20 p-1.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-sm transition-colors border border-white/30"
                title={isPreviewMuted ? 'Unmute video preview' : 'Mute video preview'}
              >
                {isPreviewMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            )}

            {/* Continue Watching Progress Bar */}
            {typeof item.progressPercent === 'number' && item.progressPercent > 0 && !isPlayingPreview && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-700">
                <div
                  className="h-full bg-red-600"
                  style={{ width: `${item.progressPercent}%` }}
                />
              </div>
            )}
          </div>

          {/* Card Hover Details */}
          <div className="p-3 space-y-2 bg-[#181818]">
            {/* Quick Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isAvailable ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(item);
                    }}
                    className="w-8 h-8 rounded-full bg-white hover:bg-neutral-200 text-black flex items-center justify-center transition-transform hover:scale-105 shadow"
                    title="Play"
                  >
                    <Play size={16} className="fill-black ml-0.5" />
                  </button>
                ) : item.isDownloading || item.downloadStreamUrl ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay({
                        ...item,
                        videoStreamUrl: item.downloadStreamUrl || item.videoStreamUrl,
                      });
                    }}
                    className="px-2.5 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center space-x-1.5 transition-transform hover:scale-105 shadow text-xs font-semibold"
                    title={`Watch In-Progress (${item.downloadProgress || 0}% downloaded)`}
                  >
                    <Play size={13} className="fill-white" />
                    <span>Watch ({item.downloadProgress || 0}%)</span>
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onRequest) {
                        onRequest(item);
                      } else {
                        onOpenModal(item);
                      }
                    }}
                    disabled={isRequested}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform hover:scale-105 shadow ${
                      isRequested
                        ? 'bg-amber-600 cursor-not-allowed opacity-80'
                        : 'bg-red-600 hover:bg-red-500'
                    }`}
                    title={isRequested ? 'Requested' : 'Request to Download via Seerr'}
                  >
                    {isRequested ? <Clock size={15} /> : <Download size={15} />}
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFavorite(!isFavorite);
                  }}
                  className="w-8 h-8 rounded-full border border-gray-400 hover:border-white text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                  title="Add to My List"
                >
                  {isFavorite ? <Check size={16} /> : <Plus size={16} />}
                </button>

                <button
                  onClick={(e) => e.stopPropagation()}
                  className="w-8 h-8 rounded-full border border-gray-400 hover:border-white text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                  title="Like"
                >
                  <ThumbsUp size={14} />
                </button>
              </div>

              {/* Chevron to open full modal */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenModal(item);
                }}
                className="w-8 h-8 shrink-0 rounded-full border border-gray-400 hover:border-white text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                title="Episode & Details Info"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            {/* Title */}
            <div>
              {item.type === 'Episode' && item.seriesName ? (
                <>
                  <div className="font-bold text-white text-sm truncate leading-snug">
                    {item.seriesName}
                  </div>
                  <div className="text-neutral-400 text-xs truncate">
                    {item.title}
                  </div>
                </>
              ) : (
                <div className="font-bold text-white text-sm truncate">
                  {item.title}
                </div>
              )}
            </div>

            {/* Badges & Meta */}
            <div className="flex items-center space-x-2 text-xs font-semibold">
              <span className="text-emerald-400">{item.matchPercentage || 97}% Match</span>
              <span className="border border-gray-400/50 px-1 py-0.2 rounded text-[10px] text-gray-300">
                {item.rating || 'TV-MA'}
              </span>
              <span className="text-gray-400 text-[11px]">
                {item.seasonsCount
                  ? `${item.seasonsCount} Season${item.seasonsCount > 1 ? 's' : ''}`
                  : item.durationMinutes
                  ? `${item.durationMinutes}m`
                  : item.year || ''}
              </span>
              {item.resolution ? (
                <span className="border border-gray-400/40 text-[9px] px-1 rounded font-mono text-gray-300">
                  {item.resolution === '4K UHD' ? '4K' : item.resolution === '1080p HD' ? 'HD' : item.resolution}
                </span>
              ) : item.source !== 'seerr' ? (
                <span className="border border-gray-400/40 text-[9px] px-1 rounded font-mono text-gray-400">
                  HD
                </span>
              ) : null}
            </div>

            {/* Genres */}
            {item.genres && item.genres.length > 0 && (
              <div className="flex items-center space-x-1.5 text-[11px] text-gray-300 truncate">
                {item.genres.slice(0, 3).map((g, idx) => (
                  <span key={g} className="flex items-center">
                    {g}
                    {idx < Math.min(item.genres.length, 3) - 1 && (
                      <span className="mx-1 text-neutral-500">•</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
