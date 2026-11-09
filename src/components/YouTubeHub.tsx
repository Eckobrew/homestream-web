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
  UserCheck,
  LogIn,
  Key,
  Flame,
  Film,
  History,
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

export interface YouTubeContinueItem {
  videoId: string;
  title: string;
  channelName?: string;
  thumbnailUrl: string;
  positionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  streamUrl: string;
  updatedAt: string;
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
  const [currentView, setCurrentView] = useState<'home' | 'search' | 'subscriptions' | 'queue' | 'archive'>('home');

  // Home / Discovery State
  const [heroVideo, setHeroVideo] = useState<YouTubeSearchResult | null>(null);
  const [sections, setSections] = useState<Array<{ id: string; title: string; items: YouTubeSearchResult[] }>>([]);
  const [continueWatching, setContinueWatching] = useState<YouTubeContinueItem[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState<'all' | 'podcasts' | 'longform'>('all');

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState<YouTubeSubscription[]>([]);
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false);
  const [newSubChannelInput, setNewSubChannelInput] = useState('');
  const [newSubMinDuration, setNewSubMinDuration] = useState(30);
  const [newSubExcludeKeywords, setNewSubExcludeKeywords] = useState('shorts,clip,teaser,trailer,highlight');
  const [newSubIncludeKeywords, setNewSubIncludeKeywords] = useState('');
  const [newSubAutoDownload, setNewSubAutoDownload] = useState(true);
  const [newSubIgnoreShorts, setNewSubIgnoreShorts] = useState(true);
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);
  const [subModalError, setSubModalError] = useState<string | null>(null);

  // Queue State
  const [downloadQueue, setDownloadQueue] = useState<YouTubeDownloadItem[]>([]);

  // Archive State
  const [archiveItems, setArchiveItems] = useState<YouTubeArchiveItem[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);

  // YouTube Account Auth State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ connected: boolean; accountName?: string }>({ connected: false });
  const [cookiesInput, setCookiesInput] = useState('');
  const [accountNameInput, setAccountNameInput] = useState('');
  const [isSavingAuth, setIsSavingAuth] = useState(false);

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Fetch Auth Status
  const loadAuthStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/youtube/auth');
      if (res.ok) {
        const data = await res.json();
        setAuthStatus(data);
      }
    } catch {}
  }, []);

  // Fetch Continue Watching
  const loadContinueWatching = useCallback(async () => {
    try {
      const res = await apiFetch('/api/youtube/continue-watching');
      if (res.ok) {
        const data = await res.json();
        setContinueWatching(data.items || []);
      }
    } catch {}
  }, []);

  // Fetch Recommendations & Media Sections
  const loadHomeRecommendations = useCallback(async () => {
    setIsLoadingHome(true);
    try {
      const res = await apiFetch('/api/youtube/recommendations');
      if (res.ok) {
        const data = await res.json();
        setHeroVideo(data.hero || null);
        setSections(data.sections || []);
      }
    } catch (err) {
      console.error('Failed fetching YouTube recommendations:', err);
    } finally {
      setIsLoadingHome(false);
    }
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
    } catch {}
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
    } catch {} finally {
      setIsLoadingArchive(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadAuthStatus();
    loadContinueWatching();
    loadHomeRecommendations();
    loadSubscriptions();
    loadQueue();
    loadArchive();
  }, [loadAuthStatus, loadContinueWatching, loadHomeRecommendations, loadSubscriptions, loadQueue, loadArchive]);

  // Periodic polling for queue & continue watching
  useEffect(() => {
    const hasActive = downloadQueue.some((q) => q.status === 'downloading' || q.status === 'queued');
    const interval = setInterval(() => {
      loadQueue();
      if (hasActive) {
        loadArchive();
      }
    }, hasActive ? 3000 : 12000);

    return () => clearInterval(interval);
  }, [downloadQueue, loadQueue, loadArchive]);

  // Search Handler
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setCurrentView('search');
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

  // Stream Resolution & Play (Direct via proxy-stream for 100% reliable playback)
  const handlePlayVideo = (video: { id: string; title: string; thumbnailUrl?: string; durationSeconds?: number; channelTitle?: string; description?: string }) => {
    const videoStreamUrl = `/api/youtube/stream-video?videoId=${encodeURIComponent(video.id)}`;

    const mediaItem: MediaItem = {
      id: `yt-${video.id}`,
      title: video.title,
      overview: video.description || `Channel: ${video.channelTitle || 'YouTube'}`,
      type: 'Movie',
      posterUrl: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      backdropUrl: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      durationMinutes: video.durationSeconds ? Math.round(video.durationSeconds / 60) : 0,
      genres: ['YouTube', video.channelTitle || 'YouTube'],
      source: 'youtube' as any,
      status: 'available',
      videoStreamUrl,
    };

    onPlay(mediaItem);
  };

  // Resume Continue Watching
  const handleResumeContinueWatching = (item: YouTubeContinueItem) => {
    const mediaItem: MediaItem = {
      id: `yt-${item.videoId}`,
      title: item.title,
      overview: item.channelName || 'YouTube',
      type: 'Movie',
      posterUrl: item.thumbnailUrl,
      backdropUrl: item.thumbnailUrl,
      durationMinutes: item.durationSeconds ? Math.round(item.durationSeconds / 60) : 0,
      playbackPositionTicks: Math.round(item.positionSeconds * 10000000),
      genres: ['YouTube', item.channelName || 'YouTube'],
      source: 'youtube' as any,
      status: 'available',
      videoStreamUrl: item.streamUrl || `/api/youtube/stream-video?videoId=${encodeURIComponent(item.videoId)}`,
    };

    onPlay(mediaItem);
  };

  // Dismiss Continue Watching item
  const handleDismissContinue = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/youtube/progress?videoId=${encodeURIComponent(videoId)}`, { method: 'DELETE' });
      setContinueWatching((prev) => prev.filter((p) => p.videoId !== videoId));
      showToast('Removed from continue watching');
    } catch {}
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
      source: 'youtube' as any,
      status: 'available',
      videoStreamUrl: item.streamUrl,
    };

    onPlay(mediaItem);
  };

  // Queue Video Download to NAS
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
        showToast(`Queued "${video.title}" for download to NAS`);
        loadQueue();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to queue download');
      }
    } catch {
      showToast('Failed to queue download');
    }
  };

  // Save YouTube Auth (Cookies / Session)
  const handleSaveAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookiesInput.trim()) return;

    setIsSavingAuth(true);
    try {
      const res = await apiFetch('/api/youtube/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookiesText: cookiesInput.trim(),
          accountName: accountNameInput.trim() || undefined,
        }),
      });

      if (res.ok) {
        showToast('YouTube account connected! Syncing recommendations...');
        setIsAuthModalOpen(false);
        setCookiesInput('');
        loadAuthStatus();
        loadHomeRecommendations();
      } else {
        showToast('Failed saving YouTube account credentials.');
      }
    } catch {
      showToast('Failed connecting YouTube account.');
    } finally {
      setIsSavingAuth(false);
    }
  };

  // Disconnect YouTube Auth
  const handleDisconnectAuth = async () => {
    try {
      await apiFetch('/api/youtube/auth', { method: 'DELETE' });
      setAuthStatus({ connected: false });
      showToast('YouTube account disconnected.');
      setIsAuthModalOpen(false);
      loadHomeRecommendations();
    } catch {
      showToast('Failed to disconnect.');
    }
  };

  // Submit Add Subscription
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
          excludeKeywords: newSubExcludeKeywords.split(',').map((s) => s.trim()).filter(Boolean),
          includeKeywords: newSubIncludeKeywords.split(',').map((s) => s.trim()).filter(Boolean),
          ignoreShorts: newSubIgnoreShorts,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubModalError(data.error || 'Failed to subscribe to channel');
      } else {
        showToast(`Subscribed to ${data.subscription?.title || 'channel'}`);
        setIsAddSubModalOpen(false);
        setNewSubChannelInput('');
        loadSubscriptions();
      }
    } catch (err: any) {
      setSubModalError(err.message || 'Error subscribing to channel');
    } finally {
      setIsSubmittingSub(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 right-6 z-50 bg-neutral-900 border border-neutral-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in">
          <Sparkles size={18} className="text-red-500 animate-pulse" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-neutral-800/80 px-4 md:px-12 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToHome}
              className="p-2 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
              title="Back to Home"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/40">
                <PlaySquare size={18} className="text-white fill-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">YouTube Hub</span>
            </div>
          </div>

          {/* Search Input Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-2">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos, podcasts, channels..."
                className="w-full bg-neutral-900 border border-neutral-700/80 rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition"
              />
            </div>
          </form>

          {/* Account Login Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition border ${
                authStatus.connected
                  ? 'bg-neutral-900 text-emerald-400 border-emerald-500/40'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
              }`}
            >
              {authStatus.connected ? (
                <>
                  <UserCheck size={14} className="text-emerald-400" />
                  <span>{authStatus.accountName || 'YouTube Connected'}</span>
                </>
              ) : (
                <>
                  <LogIn size={14} className="text-red-500" />
                  <span>Connect YouTube</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* View Switcher Subtabs */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-neutral-900 overflow-x-auto no-scrollbar">
          {[
            { id: 'home', label: 'Home & Explore', icon: Film },
            { id: 'search', label: 'Search Results', icon: Search },
            { id: 'subscriptions', label: `Subscriptions (${subscriptions.length})`, icon: Radio },
            { id: 'queue', label: `Queue (${downloadQueue.filter((q) => q.status === 'downloading' || q.status === 'queued').length})`, icon: Download },
            { id: 'archive', label: `Saved NAS Archive (${archiveItems.length})`, icon: HardDrive },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = currentView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-white text-black shadow-md'
                    : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-4 md:px-12 mt-6">
        {/* VIEW: HOME & EXPLORE */}
        {currentView === 'home' && (
          <div className="space-y-10">
            {/* Featured Hero Banner */}
            {heroVideo && (
              <div className="relative rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl">
                <div className="relative aspect-[21/9] max-h-[460px] w-full overflow-hidden">
                  <img
                    src={heroVideo.thumbnailUrl}
                    alt={heroVideo.title}
                    className="w-full h-full object-cover filter brightness-75 scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-transparent" />

                  <div className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-10 md:right-10 flex flex-col items-start max-w-2xl">
                    <span className="px-3 py-1 rounded-full bg-red-600 text-[11px] font-bold tracking-wider uppercase mb-3 shadow-md">
                      Featured Pick
                    </span>
                    <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white line-clamp-2 drop-shadow-md">
                      {heroVideo.title}
                    </h2>
                    <p className="text-sm md:text-base text-neutral-300 mt-2 font-medium flex items-center gap-3">
                      <span>{heroVideo.channelTitle}</span>
                      {heroVideo.durationFormatted && (
                        <>
                          <span>•</span>
                          <span className="text-neutral-400">{heroVideo.durationFormatted}</span>
                        </>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-5">
                      <button
                        onClick={() => handlePlayVideo(heroVideo)}
                        className="flex items-center gap-2 bg-white text-black hover:bg-neutral-200 px-6 py-2.5 rounded-full font-bold text-sm transition shadow-lg"
                      >
                        <Play size={18} className="fill-black" />
                        <span>Play Now</span>
                      </button>
                      <button
                        onClick={() => handleQueueDownload(heroVideo)}
                        className="flex items-center gap-2 bg-neutral-800/80 hover:bg-neutral-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition border border-neutral-700 backdrop-blur-md"
                      >
                        <Download size={16} />
                        <span>Save to NAS</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Continue Watching Row */}
            {continueWatching.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <History size={18} className="text-red-500" />
                  <h3 className="text-lg md:text-xl font-bold tracking-tight">Continue Watching</h3>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {continueWatching.map((item) => (
                    <div
                      key={item.videoId}
                      onClick={() => handleResumeContinueWatching(item)}
                      className="group relative flex-none w-64 md:w-72 bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 hover:border-neutral-600 cursor-pointer transition duration-200"
                    >
                      <div className="relative aspect-video w-full bg-neutral-950 overflow-hidden">
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition" />
                        <button
                          onClick={(e) => handleDismissContinue(e, item.videoId)}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition"
                          title="Remove from continue watching"
                        >
                          <X size={14} />
                        </button>
                        {/* Play Button Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                            <Play size={16} className="fill-white ml-0.5" />
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="absolute bottom-0 inset-x-0 h-1.5 bg-neutral-800">
                          <div
                            className="h-full bg-red-600 transition-all duration-300"
                            style={{ width: `${item.progressPercent}%` }}
                          />
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">
                          {item.title}
                        </h4>
                        <div className="flex items-center justify-between mt-2 text-[11px] text-neutral-400">
                          <span className="truncate">{item.channelName || 'YouTube'}</span>
                          <span>{formatDurationSeconds(item.positionSeconds)} left</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Media Rows */}
            {isLoadingHome ? (
              <div className="flex items-center justify-center py-20 text-neutral-500 gap-3">
                <Loader2 size={24} className="animate-spin text-red-500" />
                <span>Loading YouTube rows...</span>
              </div>
            ) : (
              sections.map((section) => (
                <section key={section.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg md:text-xl font-bold tracking-tight">{section.title}</h3>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                    {section.items.map((video) => (
                      <div
                        key={video.id}
                        onClick={() => handlePlayVideo(video)}
                        className="group relative flex-none w-60 md:w-68 bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800/80 hover:border-neutral-600 cursor-pointer transition duration-200"
                      >
                        <div className="relative aspect-video w-full bg-neutral-950 overflow-hidden">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          {video.durationFormatted && (
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-mono font-bold text-white">
                              {video.durationFormatted}
                            </span>
                          )}
                          {/* Quick Download Overlay */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQueueDownload(video);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-neutral-800 text-white opacity-0 group-hover:opacity-100 transition"
                            title="Download to NAS"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                        <div className="p-3">
                          <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">
                            {video.title}
                          </h4>
                          <div className="flex items-center justify-between mt-2 text-[11px] text-neutral-400">
                            <span className="truncate">{video.channelTitle}</span>
                            {video.uploadDate && <span>{video.uploadDate}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        )}

        {/* VIEW: SEARCH RESULTS */}
        {currentView === 'search' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-xl font-bold tracking-tight">
                Search Results for &ldquo;{searchQuery}&rdquo;
              </h3>
              <div className="flex items-center gap-2">
                {[
                  { id: 'all', label: 'All Results' },
                  { id: 'podcasts', label: 'Podcasts (≥20m)' },
                  { id: 'longform', label: 'Longform (≥60m)' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSearchFilter(f.id as any)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                      searchFilter === f.id
                        ? 'bg-white text-black'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {isSearching ? (
              <div className="flex items-center justify-center py-20 text-neutral-500 gap-3">
                <Loader2 size={24} className="animate-spin text-red-500" />
                <span>Searching YouTube with yt-dlp...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-20 text-neutral-500">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p>No results found. Try adjusting your search query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {searchResults
                  .filter((v) => {
                    if (searchFilter === 'podcasts') return v.durationSeconds >= 20 * 60;
                    if (searchFilter === 'longform') return v.durationSeconds >= 60 * 60;
                    return true;
                  })
                  .map((video) => (
                    <div
                      key={video.id}
                      onClick={() => handlePlayVideo(video)}
                      className="group bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 hover:border-neutral-600 cursor-pointer transition flex flex-col justify-between"
                    >
                      <div className="relative aspect-video w-full bg-neutral-950 overflow-hidden">
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        {video.durationFormatted && (
                          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-mono font-bold text-white">
                            {video.durationFormatted}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQueueDownload(video);
                          }}
                          className="absolute top-2 right-2 p-2 rounded-full bg-black/70 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition shadow-lg"
                          title="Save to NAS"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                      <div className="p-3">
                        <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">
                          {video.title}
                        </h4>
                        <p className="text-[11px] text-neutral-400 mt-1 truncate">{video.channelTitle}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: SUBSCRIPTIONS */}
        {currentView === 'subscriptions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Channel Subscriptions</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Channels automatically checked for new podcast episodes.
                </p>
              </div>
              <button
                onClick={() => setIsAddSubModalOpen(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full text-xs font-bold transition shadow-lg shadow-red-900/30"
              >
                <Plus size={16} />
                <span>Add Channel</span>
              </button>
            </div>

            {subscriptions.length === 0 ? (
              <div className="text-center py-20 text-neutral-500">
                <Radio size={32} className="mx-auto mb-2 opacity-50" />
                <p>No channels subscribed yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex items-start gap-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-neutral-800 overflow-hidden flex-shrink-0">
                      {sub.avatarUrl ? (
                        <img src={sub.avatarUrl} alt={sub.title} className="w-full h-full object-cover" />
                      ) : (
                        <Radio size={24} className="m-3 text-neutral-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{sub.title}</h4>
                      <p className="text-xs text-neutral-400 truncate">{sub.handle || sub.id}</p>
                      <div className="flex items-center gap-2 mt-3 text-[11px] text-neutral-500">
                        <span>Min {Math.round(sub.minDurationSeconds / 60)}m</span>
                        <span>•</span>
                        <span>{sub.autoDownload ? 'Auto-Download' : 'Manual'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: DOWNLOAD QUEUE */}
        {currentView === 'queue' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold tracking-tight">NAS Download Queue</h3>
            {downloadQueue.length === 0 ? (
              <div className="text-center py-20 text-neutral-500">
                <Download size={32} className="mx-auto mb-2 opacity-50" />
                <p>No active or recent downloads.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {downloadQueue.map((item) => (
                  <div
                    key={item.videoId}
                    className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-20 aspect-video rounded-lg bg-neutral-950 overflow-hidden flex-shrink-0">
                        {item.thumbnailUrl && (
                          <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs md:text-sm font-semibold text-white truncate">{item.title}</h4>
                        <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1">
                          <span className="capitalize text-red-400 font-semibold">{item.status}</span>
                          {item.status === 'downloading' && (
                            <>
                              <span>•</span>
                              <span>{item.progressPercent.toFixed(0)}%</span>
                              <span>•</span>
                              <span>{formatBytes(item.speedBytes)}/s</span>
                            </>
                          )}
                        </div>
                        {item.status === 'downloading' && (
                          <div className="w-full h-1.5 bg-neutral-800 rounded-full mt-2 overflow-hidden">
                            <div
                              className="h-full bg-red-600 transition-all duration-300"
                              style={{ width: `${item.progressPercent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: SAVED ARCHIVE */}
        {currentView === 'archive' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-tight">Saved NAS Archive</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Stored directly on /mnt/pve/nas-youtube for instant local playback.
                </p>
              </div>
            </div>

            {archiveItems.length === 0 ? (
              <div className="text-center py-20 text-neutral-500">
                <HardDrive size={32} className="mx-auto mb-2 opacity-50" />
                <p>No saved videos found in /youtube NAS storage.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {archiveItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handlePlayArchiveItem(item)}
                    className="group bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 hover:border-neutral-600 cursor-pointer transition flex flex-col justify-between"
                  >
                    <div className="relative aspect-video w-full bg-neutral-950 overflow-hidden">
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-emerald-600/90 text-[10px] font-bold text-white uppercase tracking-wider">
                        NAS Archive
                      </div>
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-mono text-neutral-300">
                        {formatBytes(item.fileSize)}
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 mt-1 truncate">{item.channelName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* YouTube Account Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                  <Key size={16} className="text-white" />
                </div>
                <h3 className="text-lg font-bold">Connect YouTube Account</h3>
              </div>
              <button onClick={() => setIsAuthModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Connect your YouTube session cookies to receive your personalized subscriptions, recommended feed, and continue watching history.
            </p>

            {authStatus.connected ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Check size={18} />
                  <span>Connected as {authStatus.accountName || 'YouTube User'}</span>
                </div>
                <p className="text-xs text-neutral-400">
                  Your YouTube session is active for this profile.
                </p>
                <button
                  type="button"
                  onClick={handleDisconnectAuth}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition"
                >
                  Disconnect YouTube Account
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Account Name / Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={accountNameInput}
                    onChange={(e) => setAccountNameInput(e.target.value)}
                    placeholder="e.g. Nathan Willems"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    YouTube Cookie / Session Data
                  </label>
                  <textarea
                    rows={4}
                    value={cookiesInput}
                    onChange={(e) => setCookiesInput(e.target.value)}
                    placeholder="Paste cookies (Netscape format or cookie header with SID, HSID, SSID, etc.)"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-red-500"
                    required
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Export your cookies using any browser extension (e.g. &ldquo;Get cookies.txt LOCALLY&rdquo;) and paste here.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingAuth || !cookiesInput.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-lg"
                  >
                    {isSavingAuth && <Loader2 size={14} className="animate-spin" />}
                    <span>Save &amp; Connect</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Subscription Modal */}
      {isAddSubModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Add Channel Subscription</h3>
              <button onClick={() => setIsAddSubModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {subModalError && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {subModalError}
              </div>
            )}

            <form onSubmit={handleAddSubscription} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Channel Handle or URL
                </label>
                <input
                  type="text"
                  value={newSubChannelInput}
                  onChange={(e) => setNewSubChannelInput(e.target.value)}
                  placeholder="@lexfridman or https://youtube.com/@joerogan"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Minimum Duration (Minutes)
                </label>
                <input
                  type="number"
                  value={newSubMinDuration}
                  onChange={(e) => setNewSubMinDuration(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Filters out short clips and non-podcast uploads.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoDl"
                  checked={newSubAutoDownload}
                  onChange={(e) => setNewSubAutoDownload(e.target.checked)}
                  className="rounded bg-neutral-950 border-neutral-700 text-red-600 focus:ring-0"
                />
                <label htmlFor="autoDl" className="text-xs text-neutral-300 cursor-pointer">
                  Auto-download matching episodes to NAS
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSubModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSub}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition shadow-lg"
                >
                  {isSubmittingSub && <Loader2 size={14} className="animate-spin" />}
                  <span>Subscribe</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
