'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '@/api/client';
import {
  Play,
  Download,
  Search,
  Check,
  RefreshCw,
  Trash2,
  Plus,
  Sliders,
  Clock,
  Radio,
  HardDrive,
  AlertCircle,
  Loader2,
  ArrowLeft,
  X,
  PlaySquare,
  Sparkles,
} from 'lucide-react';
import { MediaItem } from '@/types';

export interface YouTubeSearchResult {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  channelAvatarUrl?: string;
  durationSeconds: number;
  durationFormatted: string;
  thumbnailUrl: string;
  uploadDate?: string;
  viewCount?: string;
  description?: string;
  isShort: boolean;
  isDownloaded?: boolean;
}

export interface YouTubeSubscription {
  id: string;
  title: string;
  handle?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  description?: string;
  subscribedAt: string;
  autoDownload: boolean;
  minDurationSeconds: number;
  maxDurationSeconds?: number;
  includeKeywords?: string[];
  excludeKeywords?: string[];
  ignoreShorts: boolean;
  lastCheckedAt?: string;
  lastVideoId?: string;
}

export interface YouTubeDownloadItem {
  videoId: string;
  channelId?: string;
  channelTitle?: string;
  title: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  uploadDate?: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'ignored';
  progressPercent: number;
  speedBytes: number;
  etaSeconds?: number;
  filePath?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface YouTubeArchiveItem {
  id: string;
  title: string;
  channelName: string;
  filePath: string;
  fileSize: number;
  thumbnailUrl?: string;
  modifiedAt: string;
  streamUrl: string;
}

interface YouTubeHubProps {
  onPlay: (item: MediaItem) => void;
  onBackToHome: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDurationSeconds(sec?: number): string {
  if (!sec || sec <= 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const YouTubeHub: React.FC<YouTubeHubProps> = ({ onPlay, onBackToHome }) => {
  const [activeTab, setActiveTab] = useState<'search' | 'subscriptions' | 'queue' | 'archive'>('search');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState<'all' | 'podcasts' | 'longform'>('all');
  const [resolvingStreamId, setResolvingStreamId] = useState<string | null>(null);

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState<YouTubeSubscription[]>([]);
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false);
  const [newSubChannelInput, setNewSubChannelInput] = useState('');
  const [newSubMinDuration, setNewSubMinDuration] = useState(30); // 30 mins
  const [newSubExcludeKeywords, setNewSubExcludeKeywords] = useState('shorts,clip,teaser,trailer,highlight');
  const [newSubIncludeKeywords, setNewSubIncludeKeywords] = useState('');
  const [newSubAutoDownload, setNewSubAutoDownload] = useState(true);
  const [newSubIgnoreShorts, setNewSubIgnoreShorts] = useState(true);
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);
  const [subModalError, setSubModalError] = useState<string | null>(null);
  const [checkingChannelId, setCheckingChannelId] = useState<string | null>(null);

  // Queue State
  const [downloadQueue, setDownloadQueue] = useState<YouTubeDownloadItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  // Archive State
  const [archiveItems, setArchiveItems] = useState<YouTubeArchiveItem[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [archiveChannelFilter, setArchiveChannelFilter] = useState<string>('all');

  // Toast / notification message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Fetch Subscriptions
  const loadSubscriptions = useCallback(async () => {
    setIsLoadingSubs(true);
    try {
      const res = await apiFetch('/api/youtube/subscriptions');
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (err) {
      console.error('Failed fetching subscriptions:', err);
    } finally {
      setIsLoadingSubs(false);
    }
  }, []);

  // Fetch Download Queue
  const loadQueue = useCallback(async () => {
    try {
      const res = await apiFetch('/api/youtube/queue');
      if (res.ok) {
        const data = await res.json();
        setDownloadQueue(data.queue || []);
      }
    } catch (err) {
      console.error('Failed fetching download queue:', err);
    }
  }, []);

  // Fetch Archive
  const loadArchive = useCallback(async () => {
    setIsLoadingArchive(true);
    try {
      const res = await apiFetch('/api/youtube/archive');
      if (res.ok) {
        const data = await res.json();
        setArchiveItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed fetching archive:', err);
    } finally {
      setIsLoadingArchive(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSubscriptions();
    loadQueue();
    loadArchive();
  }, [loadSubscriptions, loadQueue, loadArchive]);

  // Periodic polling for queue if active items exist
  useEffect(() => {
    const hasActive = downloadQueue.some((q) => q.status === 'downloading' || q.status === 'queued');
    const interval = setInterval(() => {
      loadQueue();
      if (hasActive) {
        loadArchive();
      }
    }, hasActive ? 3000 : 10000);

    return () => clearInterval(interval);
  }, [downloadQueue, loadQueue, loadArchive]);

  // Search Handler
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await apiFetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error('Failed YouTube search:', err);
      showToast('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Filtered search results
  const filteredSearchResults = useMemo(() => {
    if (searchFilter === 'podcasts') {
      return searchResults.filter((r) => r.durationSeconds >= 20 * 60);
    }
    if (searchFilter === 'longform') {
      return searchResults.filter((r) => r.durationSeconds >= 60 * 60);
    }
    return searchResults;
  }, [searchResults, searchFilter]);

  // Stream Resolution & Play
  const handlePlayStream = async (video: YouTubeSearchResult | { id: string; title: string; thumbnailUrl?: string; durationSeconds?: number }) => {
    setResolvingStreamId(video.id);
    try {
      const res = await apiFetch(`/api/youtube/stream?videoId=${encodeURIComponent(video.id)}`);
      if (!res.ok) throw new Error('Could not resolve stream');
      const data = await res.json();
      if (!data.streamUrl) throw new Error('No stream URL available');

      // Create a transient MediaItem to play inside BuiltinPlayer
      const mediaItem: MediaItem = {
        id: `yt-${video.id}`,
        title: video.title,
        overview: (video as any).description || 'YouTube Stream',
        type: 'Movie',
        posterUrl: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        backdropUrl: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        durationMinutes: video.durationSeconds ? Math.round(video.durationSeconds / 60) : 0,
        genres: ['YouTube', (video as any).channelTitle || 'YouTube'],
        source: 'demo' as any,
        status: 'available',
        videoStreamUrl: data.streamUrl,
      };

      onPlay(mediaItem);
    } catch (err) {
      console.error('Failed playing YouTube video:', err);
      showToast('Failed to stream video. It may be restricted.');
    } finally {
      setResolvingStreamId(null);
    }
  };

  // Play from Archive (local NAS storage)
  const handlePlayArchiveItem = (item: YouTubeArchiveItem) => {
    const mediaItem: MediaItem = {
      id: `yt-archive-${item.id}`,
      title: item.title,
      overview: `Channel: ${item.channelName}`,
      type: 'Movie',
      posterUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
      backdropUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
      genres: ['YouTube', item.channelName],
      source: 'demo' as any,
      status: 'available',
      videoStreamUrl: item.streamUrl,
    };

    onPlay(mediaItem);
  };

  // Queue Video Download
  const handleQueueDownload = async (video: YouTubeSearchResult) => {
    try {
      const res = await apiFetch('/api/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          channelId: video.channelId,
          channelTitle: video.channelTitle,
          title: video.title,
          durationSeconds: video.durationSeconds,
          thumbnailUrl: video.thumbnailUrl,
          uploadDate: video.uploadDate,
        }),
      });

      if (res.ok) {
        showToast(`Queued "${video.title.slice(0, 35)}..." for download`);
        loadQueue();
      } else {
        showToast('Could not queue download');
      }
    } catch {
      showToast('Failed to queue download');
    }
  };

  // Add Subscription
  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubChannelInput.trim()) return;

    setIsSubmittingSub(true);
    setSubModalError(null);

    try {
      const res = await apiFetch('/api/youtube/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelUrlOrHandle: newSubChannelInput.trim(),
          autoDownload: newSubAutoDownload,
          minDurationSeconds: newSubMinDuration * 60,
          excludeKeywords: newSubExcludeKeywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          includeKeywords: newSubIncludeKeywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          ignoreShorts: newSubIgnoreShorts,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Subscribed to ${data.subscription.title}`);
        setIsAddSubModalOpen(false);
        setNewSubChannelInput('');
        loadSubscriptions();
      } else {
        setSubModalError(data.error || 'Failed to add subscription');
      }
    } catch (err: any) {
      setSubModalError(err?.message || 'Network error adding subscription');
    } finally {
      setIsSubmittingSub(false);
    }
  };

  // Check Channel New Uploads
  const handleCheckChannel = async (channelId?: string) => {
    setCheckingChannelId(channelId || 'all');
    try {
      const res = await apiFetch('/api/youtube/subscriptions/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channelId ? { channelId } : {}),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(
          channelId
            ? `Checked channel: ${data.downloadedCount || 0} new episode(s) queued`
            : 'Polled all channel subscriptions'
        );
        loadQueue();
        loadSubscriptions();
      } else {
        showToast('Failed checking channel');
      }
    } catch {
      showToast('Error checking channel uploads');
    } finally {
      setCheckingChannelId(null);
    }
  };

  // Delete Subscription
  const handleDeleteSubscription = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to unsubscribe from "${title}"?`)) return;

    try {
      const res = await apiFetch(`/api/youtube/subscriptions?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast(`Unsubscribed from ${title}`);
        loadSubscriptions();
      }
    } catch {
      showToast('Failed to unsubscribe');
    }
  };

  // Cancel Download
  const handleCancelDownload = async (videoId: string) => {
    try {
      const res = await apiFetch(`/api/youtube/queue?videoId=${encodeURIComponent(videoId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Removed from download queue');
        loadQueue();
      }
    } catch {
      showToast('Failed to cancel download');
    }
  };

  // Distinct channels in archive
  const archiveChannels = useMemo(() => {
    const set = new Set<string>();
    archiveItems.forEach((item) => set.add(item.channelName));
    return ['all', ...Array.from(set)];
  }, [archiveItems]);

  // Filtered archive items
  const filteredArchiveItems = useMemo(() => {
    if (archiveChannelFilter === 'all') return archiveItems;
    return archiveItems.filter((i) => i.channelName === archiveChannelFilter);
  }, [archiveItems, archiveChannelFilter]);

  // Total archive stats
  const archiveTotalBytes = useMemo(() => {
    return archiveItems.reduce((acc, cur) => acc + cur.fileSize, 0);
  }, [archiveItems]);

  return (
    <div className="min-h-screen bg-[#141414] text-white pt-20 pb-24 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 border border-neutral-700 px-5 py-3 rounded-xl shadow-2xl flex items-center space-x-3 text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          <Sparkles size={18} className="text-red-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar with Back Button & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-neutral-800">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToHome}
            className="p-2.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 transition text-neutral-300 hover:text-white"
            title="Back to Home"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-950/40">
                <PlaySquare size={18} className="text-white fill-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">YouTube Hub</h1>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-red-950/80 text-red-400 border border-red-800/60 px-2 py-0.5 rounded-full">
                Dedicated
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Search & stream public YouTube videos, subscribe to podcast channels, and manage local downloads
            </p>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center bg-neutral-900/90 border border-neutral-800 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'search'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Search size={14} />
            <span>Search & Stream</span>
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'subscriptions'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Radio size={14} />
            <span>Subscriptions</span>
            {subscriptions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-black/40 rounded-full text-[10px]">
                {subscriptions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'queue'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Download size={14} />
            <span>Queue</span>
            {downloadQueue.filter((q) => q.status === 'downloading' || q.status === 'queued').length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-500 text-black font-extrabold rounded-full text-[10px]">
                {downloadQueue.filter((q) => q.status === 'downloading' || q.status === 'queued').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'archive'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <HardDrive size={14} />
            <span>Archive</span>
            {archiveItems.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-black/40 rounded-full text-[10px]">
                {archiveItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: Search & Stream */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          {/* Search Box & Filters */}
          <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-2xl">
            <form onSubmit={handleSearch} className="flex gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search YouTube videos, podcasts, shows (e.g. Joe Rogan, Lex Fridman, Huberman)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-950 border border-neutral-700/80 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center space-x-2 transition shrink-0 shadow-lg shadow-red-950/40"
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                <span>Search</span>
              </button>
            </form>

            {/* Quick Filter Pills */}
            <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-neutral-800/60 text-xs font-semibold">
              <span className="text-neutral-500 text-[11px] uppercase tracking-wider">Duration Filter:</span>
              <button
                onClick={() => setSearchFilter('all')}
                className={`px-3 py-1 rounded-full transition ${
                  searchFilter === 'all'
                    ? 'bg-neutral-200 text-black font-bold'
                    : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
                }`}
              >
                All Videos
              </button>
              <button
                onClick={() => setSearchFilter('podcasts')}
                className={`px-3 py-1 rounded-full transition flex items-center space-x-1 ${
                  searchFilter === 'podcasts'
                    ? 'bg-red-600 text-white font-bold'
                    : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
                }`}
              >
                <span>🎙️ Full Podcasts (≥ 20m)</span>
              </button>
              <button
                onClick={() => setSearchFilter('longform')}
                className={`px-3 py-1 rounded-full transition flex items-center space-x-1 ${
                  searchFilter === 'longform'
                    ? 'bg-red-600 text-white font-bold'
                    : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
                }`}
              >
                <span>⏳ Longform (≥ 60m)</span>
              </button>
            </div>
          </div>

          {/* Search Results Grid */}
          {isSearching ? (
            <div className="py-24 flex flex-col items-center justify-center space-y-3">
              <Loader2 size={36} className="animate-spin text-red-600" />
              <p className="text-xs text-neutral-400 font-semibold tracking-wide uppercase">
                Searching YouTube...
              </p>
            </div>
          ) : filteredSearchResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredSearchResults.map((video) => {
                const isResolving = resolvingStreamId === video.id;
                const isQueued = downloadQueue.some(
                  (q) => q.videoId === video.id && (q.status === 'queued' || q.status === 'downloading')
                );
                const isDownloaded = video.isDownloaded || archiveItems.some((a) => a.id === video.id);

                return (
                  <div
                    key={video.id}
                    className="group bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 rounded-xl overflow-hidden flex flex-col transition duration-200 shadow-lg"
                  >
                    {/* Thumbnail + Duration Badge */}
                    <div className="relative aspect-video bg-neutral-950 overflow-hidden">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-sm px-2 py-0.5 rounded text-[11px] font-bold text-white tracking-wide">
                        {video.durationFormatted}
                      </div>
                      {video.isShort && (
                        <div className="absolute top-2 left-2 bg-red-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider text-white">
                          Short
                        </div>
                      )}
                      {isDownloaded && (
                        <div className="absolute top-2 right-2 bg-emerald-600/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center space-x-1">
                          <Check size={12} />
                          <span>On NAS</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-3.5 flex flex-col flex-1 justify-between space-y-3">
                      <div>
                        <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-red-400 transition">
                          {video.title}
                        </h3>
                        <div className="flex items-center space-x-2 mt-2">
                          {video.channelAvatarUrl && (
                            <img
                              src={video.channelAvatarUrl}
                              alt={video.channelTitle}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          )}
                          <span className="text-xs text-neutral-400 font-medium truncate">
                            {video.channelTitle}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-1">
                          {video.viewCount && <span>{video.viewCount}</span>}
                          {video.viewCount && video.uploadDate && <span> • </span>}
                          {video.uploadDate && <span>{video.uploadDate}</span>}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2 pt-2 border-t border-neutral-800/80">
                        <button
                          onClick={() => handlePlayStream(video)}
                          disabled={isResolving}
                          className="flex-1 py-1.5 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition"
                        >
                          {isResolving ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Play size={14} className="fill-white" />
                          )}
                          <span>Stream</span>
                        </button>
                        <button
                          onClick={() => handleQueueDownload(video)}
                          disabled={isQueued || isDownloaded}
                          className={`p-2 rounded-lg text-xs font-semibold border transition ${
                            isDownloaded
                              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400 opacity-60 cursor-default'
                              : isQueued
                              ? 'bg-amber-950/40 border-amber-800 text-amber-400 opacity-80 cursor-default'
                              : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200 hover:text-white'
                          }`}
                          title={
                            isDownloaded
                              ? 'Already in NAS Archive'
                              : isQueued
                              ? 'In Download Queue'
                              : 'Download to NAS'
                          }
                        >
                          {isDownloaded ? <Check size={14} /> : <Download size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center text-neutral-500 space-y-2">
              <PlaySquare size={44} className="mx-auto text-neutral-700" />
              <p className="text-sm font-semibold text-neutral-400">Search for any YouTube video or podcast</p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Stream videos directly without ads or queue full podcast episodes to download directly to your NAS storage mount.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Subscriptions */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          {/* Subscriptions Header with Add & Poll Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/60 border border-neutral-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-white">Channel Subscriptions</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Automatically monitor channels and download new podcast episodes matching your duration and keyword filters.
              </p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => handleCheckChannel()}
                disabled={checkingChannelId !== null}
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition border border-neutral-700"
              >
                <RefreshCw size={14} className={checkingChannelId === 'all' ? 'animate-spin' : ''} />
                <span>Check All</span>
              </button>
              <button
                onClick={() => setIsAddSubModalOpen(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-lg shadow-red-950/40"
              >
                <Plus size={15} />
                <span>Add Channel</span>
              </button>
            </div>
          </div>

          {/* Subscriptions Grid */}
          {isLoadingSubs ? (
            <div className="py-20 text-center">
              <Loader2 size={32} className="animate-spin text-red-600 mx-auto" />
            </div>
          ) : subscriptions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subscriptions.map((sub) => {
                const isCheckingThis = checkingChannelId === sub.id;
                return (
                  <div
                    key={sub.id}
                    className="bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-lg transition"
                  >
                    <div>
                      {/* Avatar + Title */}
                      <div className="flex items-start space-x-3">
                        <img
                          src={sub.avatarUrl || 'https://www.youtube.com/s/desktop/f1725cfb/img/logos/favicon_144x144.png'}
                          alt={sub.title}
                          className="w-12 h-12 rounded-full object-cover border border-neutral-700 bg-neutral-950 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-white truncate">{sub.title}</h3>
                          {sub.handle && <p className="text-xs text-neutral-400 truncate">{sub.handle}</p>}
                          <div className="flex items-center space-x-2 mt-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                sub.autoDownload
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}
                            >
                              {sub.autoDownload ? 'Auto-Download: Active' : 'Auto-Download: Paused'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Filter Badges */}
                      <div className="mt-3.5 pt-3 border-t border-neutral-800/80 space-y-1.5 text-xs text-neutral-300">
                        <div className="flex items-center space-x-2 text-[11px] text-neutral-400">
                          <Clock size={13} className="text-neutral-500 shrink-0" />
                          <span>
                            Min Duration:{' '}
                            <strong className="text-white">
                              {Math.round(sub.minDurationSeconds / 60)} minutes
                            </strong>
                          </span>
                        </div>
                        {sub.ignoreShorts && (
                          <div className="flex items-center space-x-2 text-[11px] text-neutral-400">
                            <Check size={13} className="text-emerald-500 shrink-0" />
                            <span>Shorts Skipped Automatically</span>
                          </div>
                        )}
                        {sub.excludeKeywords && sub.excludeKeywords.length > 0 && (
                          <div className="text-[11px] text-neutral-400 line-clamp-1">
                            <span>Excludes: </span>
                            <span className="text-neutral-300">
                              {sub.excludeKeywords.slice(0, 3).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-neutral-800/80">
                      <button
                        onClick={() => handleCheckChannel(sub.id)}
                        disabled={isCheckingThis}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 rounded-lg flex items-center space-x-1.5 transition"
                      >
                        <RefreshCw size={12} className={isCheckingThis ? 'animate-spin' : ''} />
                        <span>Check Uploads</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSubscription(sub.id, sub.title)}
                        className="p-1.5 text-neutral-500 hover:text-red-400 transition rounded-lg hover:bg-red-950/30"
                        title="Unsubscribe"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center text-neutral-500 space-y-3">
              <Radio size={44} className="mx-auto text-neutral-700" />
              <p className="text-sm font-semibold text-neutral-400">No channel subscriptions yet</p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Subscribe to your favorite podcast channels (e.g. Joe Rogan, Huberman Lab, Lex Fridman). When they post new episodes longer than your set threshold, HomeStream will automatically download them to your NAS storage.
              </p>
              <button
                onClick={() => setIsAddSubModalOpen(true)}
                className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl inline-flex items-center space-x-1.5 transition"
              >
                <Plus size={15} />
                <span>Subscribe to a Channel</span>
              </button>
            </div>
          )}

          {/* Add Channel Modal */}
          {isAddSubModalOpen && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#181818] border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                <button
                  onClick={() => setIsAddSubModalOpen(false)}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-white"
                >
                  <X size={18} />
                </button>

                <h3 className="text-lg font-bold text-white mb-1">Add Channel Subscription</h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Enter a channel handle or URL to automatically monitor uploads
                </p>

                {subModalError && (
                  <div className="mb-4 p-3 bg-red-950/80 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center space-x-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{subModalError}</span>
                  </div>
                )}

                <form onSubmit={handleAddSubscription} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                      Channel Handle or URL
                    </label>
                    <input
                      type="text"
                      value={newSubChannelInput}
                      onChange={(e) => setNewSubChannelInput(e.target.value)}
                      placeholder="@joerogan, @lexfridman, or youtube.com/..."
                      required
                      className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  {/* Preset Button: Full Podcast Episodes */}
                  <div className="p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center space-x-1">
                        <span>🎙️ Podcast Filter Preset</span>
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        Min 30 min • Skip shorts • Exclude clips
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewSubMinDuration(30);
                        setNewSubIgnoreShorts(true);
                        setNewSubExcludeKeywords('shorts,clip,teaser,trailer,highlight');
                      }}
                      className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white border border-red-700/50 rounded-lg text-xs font-semibold transition"
                    >
                      Apply
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                        Minimum Duration Threshold
                      </label>
                      <span className="text-xs font-bold text-red-400">{newSubMinDuration} mins</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={120}
                      step={5}
                      value={newSubMinDuration}
                      onChange={(e) => setNewSubMinDuration(Number(e.target.value))}
                      className="w-full accent-red-600"
                    />
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Videos shorter than this threshold (like 5-minute clips) are ignored.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1">
                      Exclude Keywords (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={newSubExcludeKeywords}
                      onChange={(e) => setNewSubExcludeKeywords(e.target.value)}
                      placeholder="shorts, clip, teaser, highlight"
                      className="w-full px-3.5 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <div className="flex items-center space-x-3 pt-2">
                    <label className="flex items-center space-x-2 text-xs text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSubIgnoreShorts}
                        onChange={(e) => setNewSubIgnoreShorts(e.target.checked)}
                        className="rounded accent-red-600"
                      />
                      <span>Ignore YouTube Shorts</span>
                    </label>
                    <label className="flex items-center space-x-2 text-xs text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newSubAutoDownload}
                        onChange={(e) => setNewSubAutoDownload(e.target.checked)}
                        className="rounded accent-red-600"
                      />
                      <span>Auto-Download Matching Videos</span>
                    </label>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-4 border-t border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setIsAddSubModalOpen(false)}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingSub}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
                    >
                      {isSubmittingSub ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      <span>Subscribe</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Download Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-base font-bold text-white">Download Queue</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Active and queued video downloads to the local `/youtube` mount
              </p>
            </div>
            <button
              onClick={loadQueue}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition"
              title="Refresh queue"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {downloadQueue.length > 0 ? (
            <div className="space-y-3">
              {downloadQueue.map((item) => {
                const isDownloading = item.status === 'downloading';
                const isCompleted = item.status === 'completed';
                const isFailed = item.status === 'failed';

                return (
                  <div
                    key={item.videoId}
                    className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                      {item.thumbnailUrl && (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-24 aspect-video rounded-lg object-cover bg-neutral-950 shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isDownloading
                                ? 'bg-blue-950 text-blue-400 border border-blue-800/60 animate-pulse'
                                : isCompleted
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                : isFailed
                                ? 'bg-red-950 text-red-400 border border-red-800/60'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {item.status}
                          </span>
                          {item.channelTitle && (
                            <span className="text-xs text-neutral-400 font-medium truncate">
                              {item.channelTitle}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-white truncate mt-1">{item.title}</h4>

                        {/* Progress Bar for Downloading or Queued */}
                        {(isDownloading || item.status === 'queued') && (
                          <div className="mt-2 space-y-1">
                            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-600 transition-all duration-300"
                                style={{ width: `${Math.max(item.progressPercent || 0, isDownloading ? 5 : 0)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] text-neutral-400">
                              <span>{Math.round(item.progressPercent || 0)}%</span>
                              {item.etaSeconds ? <span>ETA: {formatDurationSeconds(item.etaSeconds)}</span> : null}
                            </div>
                          </div>
                        )}

                        {isFailed && item.errorMessage && (
                          <p className="text-[11px] text-red-400 mt-1">{item.errorMessage}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
                      {isCompleted ? (
                        <button
                          onClick={() => {
                            const found = archiveItems.find((a) => a.id === item.videoId);
                            if (found) handlePlayArchiveItem(found);
                            else handlePlayStream(item as any);
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 transition"
                        >
                          <Play size={13} className="fill-white" />
                          <span>Play</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCancelDownload(item.videoId)}
                          className="p-2 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-800 transition"
                          title="Cancel Download"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center text-neutral-500 space-y-2">
              <Download size={44} className="mx-auto text-neutral-700" />
              <p className="text-sm font-semibold text-neutral-400">Download queue is empty</p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Search for videos or subscribe to channels to automatically queue episodes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Archive (Local NAS Storage) */}
      {activeTab === 'archive' && (
        <div className="space-y-6">
          {/* Archive Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/60 border border-neutral-800 p-4 rounded-2xl">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">Local Archive Library</h2>
                <span className="text-xs font-bold bg-neutral-800 text-neutral-300 px-2.5 py-0.5 rounded-full">
                  {archiveItems.length} videos • {formatBytes(archiveTotalBytes)}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Saved files on `/youtube` mount available for instant streaming and offline playback
              </p>
            </div>

            <button
              onClick={loadArchive}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition self-start sm:self-auto"
              title="Rescan storage"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {/* Channel Filters */}
          {archiveChannels.length > 2 && (
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs font-medium scrollbar-none">
              {archiveChannels.map((ch) => (
                <button
                  key={ch}
                  onClick={() => setArchiveChannelFilter(ch)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${
                    archiveChannelFilter === ch
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {ch === 'all' ? 'All Channels' : ch}
                </button>
              ))}
            </div>
          )}

          {/* Archive Grid */}
          {isLoadingArchive ? (
            <div className="py-20 text-center">
              <Loader2 size={32} className="animate-spin text-red-600 mx-auto" />
            </div>
          ) : filteredArchiveItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredArchiveItems.map((item) => (
                <div
                  key={item.id + item.filePath}
                  className="group bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 rounded-xl overflow-hidden flex flex-col justify-between transition duration-200 shadow-lg cursor-pointer"
                  onClick={() => handlePlayArchiveItem(item)}
                >
                  <div className="relative aspect-video bg-neutral-950 overflow-hidden">
                    <img
                      src={item.thumbnailUrl || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl">
                        <Play size={20} className="fill-white ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-sm px-2 py-0.5 rounded text-[11px] font-bold text-white tracking-wide">
                      {formatBytes(item.fileSize)}
                    </div>
                  </div>

                  <div className="p-3.5 flex flex-col flex-1 justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-red-400 transition">
                        {item.title}
                      </h4>
                      <p className="text-xs text-neutral-400 font-medium truncate mt-1">
                        {item.channelName}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2.5 mt-2.5 border-t border-neutral-800/80">
                      <span>{new Date(item.modifiedAt).toLocaleDateString()}</span>
                      <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                        <Check size={11} />
                        <span>Ready</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-neutral-500 space-y-2">
              <HardDrive size={44} className="mx-auto text-neutral-700" />
              <p className="text-sm font-semibold text-neutral-400">No videos in archive</p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto">
                Completed downloads will appear here for fast local streaming and seeking.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
