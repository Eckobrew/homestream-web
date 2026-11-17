'use client';
import { apiFetch } from '@/api/client';

import React, { useState, useEffect } from 'react';
import { Search, Play, Download, Clock, CheckCircle2, Film, Tv, Loader2 } from 'lucide-react';
import { MediaItem } from '@/types';
import { torrentStreamUrl } from '@/player/torrent-stream';

interface SearchOverlayProps {
  query: string;
  onClose?: () => void;
  onPlay: (item: MediaItem) => void;
  onOpenModal: (item: MediaItem) => void;
  onRequest: (item: MediaItem) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  query,
  onPlay,
  onOpenModal,
  onRequest,
}) => {
  const [results, setResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'available' | 'movies' | 'tv'>('all');

  useEffect(() => {
    const controller = new AbortController();
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (res.ok && !controller.signal.aborted) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error('Search request failed:', err);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => { controller.abort(); clearTimeout(timer); };
  }, [query]);

  // Apply filters
  const filteredResults = results.filter((item) => {
    if (activeFilter === 'available') return item.status === 'available' || item.source === 'native';
    if (activeFilter === 'movies') return item.type === 'Movie';
    if (activeFilter === 'tv') return item.type === 'Series';
    return true;
  });

  // Titles that are not in the library stream straight from the swarm (no qBittorrent download).
  const handleStreamNow = (item: MediaItem) => {
    const url = torrentStreamUrl(item, { seasonNumber: 1, episodeNumber: 1 });
    if (!url) {
      onOpenModal(item);
      return;
    }
    onPlay({ ...item, videoStreamUrl: url });
  };

  return (
    <div className="pt-24 px-4 md:px-12 pb-20 min-h-screen">
      {/* Search Header & Filter Pills */}
      <div className="space-y-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black text-white">
              Search Results for <span className="text-red-500">&quot;{query}&quot;</span>
            </h1>
            <p className="text-xs text-neutral-400">
              Live index from TMDB &amp; HomeStream library. Click on any title to play or request automated download.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeFilter === 'all'
                  ? 'bg-red-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white'
              }`}
            >
              All ({results.length})
            </button>
            <button
              onClick={() => setActiveFilter('available')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center space-x-1 ${
                activeFilter === 'available'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white'
              }`}
            >
              <CheckCircle2 size={12} />
              <span>In Library</span>
            </button>
            <button
              onClick={() => setActiveFilter('movies')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center space-x-1 ${
                activeFilter === 'movies'
                  ? 'bg-neutral-700 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white'
              }`}
            >
              <Film size={12} />
              <span>Movies</span>
            </button>
            <button
              onClick={() => setActiveFilter('tv')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center space-x-1 ${
                activeFilter === 'tv'
                  ? 'bg-neutral-700 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white'
              }`}
            >
              <Tv size={12} />
              <span>TV Series</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400 space-y-3">
          <Loader2 size={36} className="animate-spin text-red-600" />
          <span className="text-sm">Searching TMDB &amp; HomeStream...</span>
        </div>
      )}

      {/* No results */}
      {!isLoading && filteredResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <Search size={48} className="text-neutral-600" />
          <h3 className="text-lg font-bold text-white">No results found</h3>
          <p className="text-sm text-neutral-400 max-w-sm">
            Try checking spelling or search for alternative movie titles, actors, or directors.
          </p>
        </div>
      )}

      {/* Search Results Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
        {filteredResults.map((item) => {
          const isAvailable = item.status === 'available' || item.source === 'native' || item.source === 'demo';
          const isRequested = item.status === 'requested' || item.status === 'processing';

          return (
            <div
              key={item.id}
              onClick={() => onOpenModal(item)}
              className="group relative bg-[#181818] rounded-md overflow-hidden cursor-pointer border border-neutral-800/80 hover:border-neutral-600 transition-all duration-300 hover:scale-105 shadow-lg flex flex-col"
            >
              {/* Poster Image */}
              <div className="relative aspect-[2/3] w-full bg-neutral-900 overflow-hidden">
                <img
                  src={item.posterUrl || item.backdropUrl}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                  {isAvailable ? (
                    <span className="bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow backdrop-blur-sm flex items-center space-x-1">
                      <CheckCircle2 size={11} />
                      <span>IN LIBRARY</span>
                    </span>
                  ) : isRequested ? (
                    <span className="bg-amber-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow backdrop-blur-sm flex items-center space-x-1">
                      <Clock size={11} />
                      <span>REQUESTED</span>
                    </span>
                  ) : (
                    <span className="bg-blue-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow backdrop-blur-sm flex items-center space-x-1">
                      <Download size={11} />
                      <span>TMDB</span>
                    </span>
                  )}
                </div>

                {/* Hover Quick Actions Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-3">
                  <div className="flex flex-col items-center space-y-1.5 w-full">
                    {isAvailable ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlay(item);
                        }}
                        className="w-full py-2 rounded bg-white text-black font-bold text-xs flex items-center justify-center space-x-1 hover:bg-neutral-200 transition-colors shadow"
                      >
                        <Play size={14} className="fill-black" />
                        <span>Stream Now</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStreamNow(item);
                          }}
                          className="w-full py-2 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center space-x-1 transition-colors shadow"
                        >
                          <Play size={14} className="fill-white" />
                          <span>Stream Now</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequest(item);
                          }}
                          disabled={isRequested}
                          className={`w-full py-1.5 rounded font-medium text-xs flex items-center justify-center space-x-1 transition-colors border ${
                            isRequested
                              ? 'bg-amber-600/30 border-amber-600/50 text-amber-300 cursor-default'
                              : 'bg-neutral-800/90 hover:bg-neutral-700 text-neutral-300 hover:text-white border-neutral-700'
                          }`}
                        >
                          {isRequested ? <Clock size={12} /> : <Download size={12} />}
                          <span>{isRequested ? 'Requested' : 'Request Only'}</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenModal(item);
                      }}
                      className="w-full py-1.5 rounded bg-neutral-800/90 hover:bg-neutral-700 text-white font-medium text-xs transition-colors border border-neutral-700"
                    >
                      Details &amp; Cast
                    </button>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-2.5 space-y-1">
                <h4 className="text-white text-xs sm:text-sm font-bold truncate">
                  {item.title}
                </h4>
                <div className="flex items-center space-x-2 text-[11px] text-neutral-400">
                  <span>{item.type}</span>
                  <span>•</span>
                  <span>{item.year || '2024'}</span>
                  {item.matchPercentage && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-400 font-semibold">{item.matchPercentage}%</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
