'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/api/client';
import type { AdminDownloadManagerResponse, AdminTorrentItem, AdminTorrentFile, AdminSystemDownloadItem } from '@/types';
import {
  HardDriveDownload,
  RefreshCw,
  Plus,
  Pause,
  Play,
  Trash2,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  AlertTriangle,
  Music2,
  BookOpen,
  PlaySquare,
  Disc,
  Zap,
  RotateCcw,
  X,
  Loader2,
  Settings,
} from 'lucide-react';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec >= 1048576) return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
  return `${Math.max(1, Math.round(bytesPerSec / 1024))} KB/s`;
}

function formatEta(seconds?: number): string {
  if (!seconds || seconds <= 0 || seconds >= 8640000) return '—';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function stateBadge(state: string) {
  const s = (state || '').toLowerCase();
  if (s === 'downloading' || s === 'forceddl' || s === 'metadl') {
    return { label: 'Downloading', cls: 'bg-red-500/20 text-red-300 border-red-500/40' };
  }
  if (s === 'uploading' || s === 'forcedup' || s === 'stalledup') {
    return { label: 'Seeding', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
  }
  if (s.includes('paused') || s.includes('stopped')) {
    return { label: 'Paused', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
  }
  if (s === 'stalleddl') {
    return { label: 'Stalled', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
  }
  if (s.includes('queued') || s.includes('checking') || s === 'allocating') {
    return { label: state, cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
  }
  if (s === 'error' || s === 'missingfiles') {
    return { label: 'Error', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
  }
  return { label: state || 'Unknown', cls: 'bg-neutral-800 text-neutral-300 border-neutral-700' };
}

export function AdminDownloadManager({
  activeProfileId,
  onOpenAdminSettings,
}: {
  activeProfileId?: string;
  onOpenAdminSettings?: () => void;
}) {
  const [data, setData] = useState<AdminDownloadManagerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // View & Filter state
  const [section, setSection] = useState<'all' | 'qbittorrent' | 'system'>('all');
  const [qbFilter, setQbFilter] = useState<'all' | 'downloading' | 'seeding' | 'paused' | 'books' | 'movies_tv'>('all');
  const [sysFilter, setSysFilter] = useState<'all' | 'music' | 'books' | 'youtube' | 'slskd'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Add Torrent modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addUrls, setAddUrls] = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [addPaused, setAddPaused] = useState(false);
  const [adding, setAdding] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<AdminTorrentItem | null>(null);
  const [deleteWithFiles, setDeleteWithFiles] = useState(false);

  // Expanded torrent files inspector
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [torrentFiles, setTorrentFiles] = useState<Record<string, AdminTorrentFile[]>>({});
  const [loadingFilesHash, setLoadingFilesHash] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(prev => (prev === msg ? '' : prev)), 4000);
  };

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const qs = activeProfileId ? `?profileId=${encodeURIComponent(activeProfileId)}` : '';
      const res = await apiFetch(`/api/downloads/manager${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load Download Manager');
      setData(json);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Download Manager');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeProfileId]);

  useEffect(() => {
    void loadData();
    const timer = setInterval(() => {
      if (!document.hidden) void loadData(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [loadData]);

  const loadTorrentFiles = async (hash: string) => {
    setLoadingFilesHash(hash);
    try {
      const qs = new URLSearchParams({ hash, ...(activeProfileId ? { profileId: activeProfileId } : {}) });
      const res = await apiFetch(`/api/downloads/manager?${qs.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setTorrentFiles(prev => ({ ...prev, [hash]: json.files || [] }));
      }
    } catch {
      // ignore
    } finally {
      setLoadingFilesHash(null);
    }
  };

  const toggleExpandFiles = (hash: string) => {
    if (expandedHash === hash) {
      setExpandedHash(null);
    } else {
      setExpandedHash(hash);
      if (!torrentFiles[hash]) {
        void loadTorrentFiles(hash);
      }
    }
  };

  const runAction = async (payload: Record<string, unknown>, busyKey: string) => {
    setBusyAction(busyKey);
    try {
      const res = await apiFetch('/api/downloads/manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Action failed');
      }
      if (json.message) showToast(json.message);
      await loadData(true);
      if (typeof payload.hash === 'string' && expandedHash === payload.hash) {
        await loadTorrentFiles(payload.hash);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddTorrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUrls.trim()) return;
    setAdding(true);
    try {
      const res = await apiFetch('/api/downloads/manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          urls: addUrls.trim(),
          category: addCategory.trim() || undefined,
          paused: addPaused,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Failed to add torrent');
      }
      showToast('Added to qBittorrent');
      setAddUrls('');
      setAddCategory('');
      setAddPaused(false);
      setIsAddOpen(false);
      await loadData(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add torrent');
    } finally {
      setAdding(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await runAction(
      { action: 'delete', hash: target.hash, deleteFiles: deleteWithFiles },
      `delete:${target.hash}`
    );
    setDeleteWithFiles(false);
  };

  const torrents = data?.torrents || [];
  const sysItems = data?.systemDownloads || [];

  const totalDlSpeed = torrents.reduce((sum, t) => sum + (t.downloadSpeed || 0), 0) +
    sysItems.reduce((sum, s) => sum + (s.downloadSpeed || 0), 0);
  const totalUlSpeed = torrents.reduce((sum, t) => sum + (t.uploadSpeed || 0), 0);
  const activeTorrentsCount = torrents.filter(t => t.progress < 1 || t.downloadSpeed > 0).length;
  const activeSysCount = sysItems.filter(s => !['available', 'completed', 'Succeeded', 'Completed'].includes(s.status)).length;

  const filteredTorrents = torrents.filter(t => {
    if (searchTerm && !`${t.name} ${t.category} ${t.tags}`.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    const st = (t.state || '').toLowerCase();
    if (qbFilter === 'downloading') return t.progress < 1 && !st.includes('paused') && !st.includes('stopped');
    if (qbFilter === 'seeding') return t.progress >= 1 && (st.includes('up') || st === 'uploading' || st === 'stalledup');
    if (qbFilter === 'paused') return st.includes('paused') || st.includes('stopped');
    if (qbFilter === 'books') return /book|readarr|bookshelf/i.test(`${t.category} ${t.tags}`);
    if (qbFilter === 'movies_tv') return /sonarr|radarr|movie|tv/i.test(`${t.category} ${t.tags}`);
    return true;
  });

  const filteredSysItems = sysItems.filter(s => {
    if (searchTerm && !`${s.title} ${s.subtitle || ''} ${s.requestedBy || ''}`.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (sysFilter !== 'all' && s.source !== sysFilter) return false;
    return true;
  });

  return (
    <main className="pt-24 md:pt-28 pb-36 px-4 md:px-12 max-w-screen-2xl mx-auto">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 border border-red-500/50 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 size={18} className="text-red-500 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5 text-red-500 text-xs font-bold uppercase tracking-widest mb-2">
            <HardDriveDownload size={16} />
            <span>Admin Control Center</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Download Manager
          </h1>
          <p className="text-neutral-400 text-sm mt-2 max-w-2xl">
            Manage qBittorrent transfers, selective multi-file packs, and active system downloads across Movies, TV, Bookshelf, Soulseek Music, and YouTube.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-950/40 transition cursor-pointer"
          >
            <Plus size={17} />
            <span>Add Magnet / Torrent</span>
          </button>
          <button
            onClick={() => void loadData()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/70 hover:bg-neutral-800 px-3.5 py-2.5 text-sm text-neutral-200 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-red-400' : ''} />
            <span>Refresh</span>
          </button>
          {onOpenAdminSettings && (
            <button
              onClick={onOpenAdminSettings}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 px-3.5 py-2.5 text-sm text-neutral-300 transition cursor-pointer"
              title="Configure qBittorrent & Integrations"
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Integrations</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Summary Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 my-6">
        <div className="rounded-xl border border-neutral-800/90 bg-neutral-900/50 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">Download Speed</p>
            <p className="text-2xl font-bold text-white mt-1 font-mono">{formatSpeed(totalDlSpeed)}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <ArrowDownToLine size={20} />
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800/90 bg-neutral-900/50 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">Upload Speed</p>
            <p className="text-2xl font-bold text-white mt-1 font-mono">{formatSpeed(totalUlSpeed)}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ArrowUpFromLine size={20} />
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800/90 bg-neutral-900/50 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">qBittorrent Queue</p>
            <p className="text-2xl font-bold text-white mt-1">
              {torrents.length} <span className="text-xs font-normal text-neutral-400">({activeTorrentsCount} downloading)</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <HardDriveDownload size={20} />
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800/90 bg-neutral-900/50 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">System Tasks</p>
            <p className="text-2xl font-bold text-white mt-1">
              {sysItems.length} <span className="text-xs font-normal text-neutral-400">({activeSysCount} active)</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Zap size={20} />
          </div>
        </div>
      </div>

      {/* Top Section Switcher & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
          {[
            ['all', `All Downloads (${torrents.length + sysItems.length})`],
            ['qbittorrent', `qBittorrent (${torrents.length})`],
            ['system', `System Queues (${sysItems.length})`],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSection(id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer ${
                section === id ? 'bg-red-600 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Filter downloads by title, category..."
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/80 px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:border-red-500 outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-300 flex items-center gap-3">
          <AlertTriangle size={18} className="shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
          <Loader2 size={32} className="animate-spin text-red-500" />
          <p className="text-sm">Connecting to qBittorrent & download services…</p>
        </div>
      )}

      {/* SECTION 1: qBittorrent Torrents */}
      {!loading && (section === 'all' || section === 'qbittorrent') && (
        <section className="mb-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <HardDriveDownload size={20} className="text-red-500" />
              <span>qBittorrent Torrents</span>
            </h2>

            <div className="flex flex-wrap gap-1.5">
              {[
                ['all', 'All'],
                ['downloading', 'Downloading'],
                ['seeding', 'Seeding'],
                ['paused', 'Paused'],
                ['movies_tv', 'Movies & TV'],
                ['books', 'Books'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setQbFilter(id as any)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                    qbFilter === id
                      ? 'bg-white text-black font-semibold'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!data?.qbittorrentConfigured ? (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-8 text-center">
              <p className="text-neutral-300 font-semibold">qBittorrent is not configured</p>
              <p className="text-neutral-500 text-sm mt-1">Connect your qBittorrent Web UI in Admin Integrations to manage torrents.</p>
              {onOpenAdminSettings && (
                <button
                  onClick={onOpenAdminSettings}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Configure qBittorrent
                </button>
              )}
            </div>
          ) : filteredTorrents.length === 0 ? (
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-8 text-center text-neutral-400 text-sm">
              No torrents match the selected filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTorrents.map(t => {
                const badge = stateBadge(t.state);
                const isPaused = (t.state || '').toLowerCase().includes('paused') || (t.state || '').toLowerCase().includes('stopped');
                const isExpanded = expandedHash === t.hash;
                const files = torrentFiles[t.hash] || [];

                return (
                  <div
                    key={t.hash}
                    className="rounded-xl border border-neutral-800/90 bg-neutral-900/50 hover:border-neutral-700/80 transition overflow-hidden"
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.cls}`}>
                              {badge.label}
                            </span>
                            {t.category && (
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                                {t.category}
                              </span>
                            )}
                            {t.seqDl && (
                              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30">
                                Sequential
                              </span>
                            )}
                            <span className="text-xs text-neutral-400 font-mono">
                              {formatBytes(t.downloaded)} / {formatBytes(t.size)}
                            </span>
                            {t.ratio > 0 && (
                              <span className="text-xs text-neutral-500 font-mono">
                                Ratio {t.ratio.toFixed(2)}
                              </span>
                            )}
                          </div>

                          <h3 className="font-semibold text-base sm:text-lg text-white break-words">
                            {t.name}
                          </h3>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPaused ? (
                            <button
                              onClick={() => void runAction({ action: 'resume', hash: t.hash }, `resume:${t.hash}`)}
                              disabled={busyAction === `resume:${t.hash}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                              title="Resume torrent"
                            >
                              <Play size={14} />
                              <span>Resume</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => void runAction({ action: 'pause', hash: t.hash }, `pause:${t.hash}`)}
                              disabled={busyAction === `pause:${t.hash}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 px-3 py-1.5 text-xs font-semibold transition cursor-pointer"
                              title="Pause torrent"
                            >
                              <Pause size={14} />
                              <span>Pause</span>
                            </button>
                          )}

                          {!t.seqDl && t.progress < 1 && (
                            <button
                              onClick={() => void runAction({ action: 'sequential', hash: t.hash }, `seq:${t.hash}`)}
                              disabled={busyAction === `seq:${t.hash}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-2.5 py-1.5 text-xs transition cursor-pointer"
                              title="Enable Sequential & First/Last Piece Priority"
                            >
                              <Zap size={13} className="text-red-400" />
                              <span className="hidden sm:inline">Sequential</span>
                            </button>
                          )}

                          <button
                            onClick={() => toggleExpandFiles(t.hash)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                              isExpanded
                                ? 'border-red-500/50 bg-red-500/15 text-white'
                                : 'border-neutral-700 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200'
                            }`}
                            title="Inspect & select individual files in this torrent"
                          >
                            <FolderOpen size={14} />
                            <span>Files</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>

                          <button
                            onClick={() => void runAction({ action: 'recheck', hash: t.hash }, `recheck:${t.hash}`)}
                            disabled={busyAction === `recheck:${t.hash}`}
                            className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
                            title="Force Recheck"
                          >
                            <RotateCcw size={14} />
                          </button>

                          <button
                            onClick={() => {
                              setDeleteTarget(t);
                              setDeleteWithFiles(false);
                            }}
                            className="p-1.5 rounded-lg border border-red-900/50 bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-200 transition cursor-pointer"
                            title="Remove torrent"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
                          <div className="flex flex-wrap items-center gap-4">
                            {t.downloadSpeed > 0 && (
                              <span className="text-red-400 font-mono font-semibold">
                                ↓ {formatSpeed(t.downloadSpeed)}
                              </span>
                            )}
                            {t.uploadSpeed > 0 && (
                              <span className="text-emerald-400 font-mono">
                                ↑ {formatSpeed(t.uploadSpeed)}
                              </span>
                            )}
                            <span>Seeds: {t.seeds} · Peers: {t.leechers}</span>
                            {t.downloadSpeed > 0 && t.eta > 0 && (
                              <span>ETA: {formatEta(t.eta)}</span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-white">{t.progressPercent}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              t.progress >= 1 ? 'bg-emerald-500' : isPaused ? 'bg-amber-500' : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, t.progressPercent))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Expandable Per-File Priority Inspector (for Multi-Book / Season Packs) */}
                    {isExpanded && (
                      <div className="border-t border-neutral-800 bg-black/40 p-4 sm:px-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                            Torrent Files ({files.length}) — Toggle files to skip unwanted items in packs
                          </p>
                          {files.length > 1 && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  void runAction(
                                    {
                                      action: 'file-priority',
                                      hash: t.hash,
                                      fileIds: files.map(f => f.index),
                                      priority: 1,
                                    },
                                    `prio-all:${t.hash}`
                                  )
                                }
                                className="text-[11px] px-2.5 py-1 rounded border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer"
                              >
                                Select All
                              </button>
                              <button
                                onClick={() =>
                                  void runAction(
                                    {
                                      action: 'file-priority',
                                      hash: t.hash,
                                      fileIds: files.map(f => f.index),
                                      priority: 0,
                                    },
                                    `prio-none:${t.hash}`
                                  )
                                }
                                className="text-[11px] px-2.5 py-1 rounded border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                              >
                                Skip All
                              </button>
                            </div>
                          )}
                        </div>

                        {loadingFilesHash === t.hash ? (
                          <div className="py-4 flex items-center gap-2 text-xs text-neutral-400">
                            <Loader2 size={14} className="animate-spin text-red-500" />
                            <span>Loading torrent files…</span>
                          </div>
                        ) : files.length === 0 ? (
                          <p className="text-xs text-neutral-500 py-2">No file metadata available yet.</p>
                        ) : (
                          <div className="max-h-72 overflow-y-auto divide-y divide-neutral-800/60 border border-neutral-800 rounded-lg">
                            {files.map(f => {
                              const skipped = f.priority === 0;
                              const high = f.priority >= 6;
                              const pct = Math.round((f.progress || 0) * 100);
                              return (
                                <div
                                  key={f.index}
                                  className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs ${
                                    skipped ? 'opacity-50 bg-neutral-950/40' : 'bg-neutral-900/30'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-neutral-200 truncate font-mono" title={f.name}>
                                      {f.name}
                                    </p>
                                    <p className="text-[11px] text-neutral-500 mt-0.5">
                                      {formatBytes(f.size)} · {pct}%
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      onClick={() =>
                                        void runAction(
                                          {
                                            action: 'file-priority',
                                            hash: t.hash,
                                            fileIds: [f.index],
                                            priority: skipped ? 1 : 0,
                                          },
                                          `fprio:${t.hash}:${f.index}`
                                        )
                                      }
                                      className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                                        skipped
                                          ? 'bg-neutral-800 text-neutral-400 hover:text-white'
                                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      }`}
                                    >
                                      {skipped ? 'Skipped' : 'Download'}
                                    </button>
                                    {!skipped && (
                                      <button
                                        onClick={() =>
                                          void runAction(
                                            {
                                              action: 'file-priority',
                                              hash: t.hash,
                                              fileIds: [f.index],
                                              priority: high ? 1 : 7,
                                            },
                                            `fhigh:${t.hash}:${f.index}`
                                          )
                                        }
                                        className={`px-2 py-1 rounded cursor-pointer ${
                                          high
                                            ? 'bg-red-600 text-white font-semibold'
                                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                                        }`}
                                        title="Max priority"
                                      >
                                        {high ? 'Max Prio' : 'Prioritize'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: System Downloads (Bookshelf, Soulseek Music, YouTube) */}
      {!loading && (section === 'all' || section === 'system') && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap size={20} className="text-red-500" />
              <span>System Downloads (Bookshelf, Soulseek Music & YouTube)</span>
            </h2>

            <div className="flex flex-wrap gap-1.5">
              {[
                ['all', 'All Sources'],
                ['books', 'Bookshelf'],
                ['music', 'Music Requests'],
                ['slskd', 'Soulseek Transfers'],
                ['youtube', 'YouTube'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setSysFilter(id as any)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                    sysFilter === id
                      ? 'bg-white text-black font-semibold'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredSysItems.length === 0 ? (
            <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-8 text-center text-neutral-400 text-sm">
              No system downloads match the selected filter.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredSysItems.map(item => (
                <div
                  key={item.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 mt-0.5">
                      {item.source === 'books' ? (
                        <BookOpen size={18} className="text-red-400" />
                      ) : item.source === 'youtube' ? (
                        <PlaySquare size={18} className="text-rose-400" />
                      ) : item.source === 'slskd' ? (
                        <Disc size={18} className="text-emerald-400" />
                      ) : (
                        <Music2 size={18} className="text-emerald-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                          {item.source}
                        </span>
                        <span className="text-xs capitalize text-neutral-300 font-medium">
                          {item.status}
                        </span>
                        {item.requestedBy && (
                          <span className="text-[11px] text-neutral-400">
                            · Profile: <strong className="text-neutral-200">{item.requestedBy}</strong>
                          </span>
                        )}
                      </div>

                      <h3 className="font-semibold text-sm sm:text-base text-white mt-1 truncate" title={item.title}>
                        {item.title}
                      </h3>
                      {item.subtitle && (
                        <p className="text-xs text-neutral-400 truncate mt-0.5">{item.subtitle}</p>
                      )}
                      {item.error && (
                        <p className="text-xs text-rose-400 mt-1 line-clamp-2">{item.error}</p>
                      )}

                      <div className="mt-2.5">
                        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                          <span>
                            {item.downloadSpeed && item.downloadSpeed > 0
                              ? formatSpeed(item.downloadSpeed)
                              : item.size
                              ? formatBytes(item.size)
                              : ''}
                          </span>
                          <span className="font-mono text-neutral-300">{item.progressPercent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              item.progressPercent >= 100 ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      void runAction(
                        {
                          action: 'cancel-system',
                          id: item.id,
                          queueId: item.meta?.queueId ? String(item.meta.queueId) : undefined,
                        },
                        `cancel:${item.id}`
                      )
                    }
                    disabled={busyAction === `cancel:${item.id}`}
                    className="p-2 rounded-lg border border-neutral-800 hover:border-red-800 bg-neutral-900 hover:bg-red-950/40 text-neutral-400 hover:text-red-300 transition shrink-0 cursor-pointer"
                    title="Cancel / remove from queue"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modal: Add Magnet / Torrent URL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddTorrent}
            className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-[#161616] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Add Torrent to qBittorrent</h2>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X size={18} />
              </button>
            </div>

            <label className="block text-sm text-neutral-300">
              Magnet Link or Torrent HTTP URL (one per line)
              <textarea
                rows={4}
                required
                value={addUrls}
                onChange={e => setAddUrls(e.target.value)}
                placeholder="magnet:?xt=urn:btih:..."
                className="mt-2 block w-full rounded-xl border border-neutral-700 bg-black/50 p-3 text-xs font-mono text-white focus:border-red-500 outline-none"
              />
            </label>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block text-sm text-neutral-300">
                Category (optional)
                <input
                  type="text"
                  value={addCategory}
                  onChange={e => setAddCategory(e.target.value)}
                  placeholder="e.g. books, radarr, tv-sonarr"
                  className="mt-2 block w-full rounded-xl border border-neutral-700 bg-black/50 p-2.5 text-sm text-white focus:border-red-500 outline-none"
                />
              </label>

              <label className="flex items-center gap-2.5 text-sm text-neutral-300 pt-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addPaused}
                  onChange={e => setAddPaused(e.target.checked)}
                  className="rounded border-neutral-700 bg-black text-red-600 focus:ring-red-500"
                />
                <span>Start paused (select files first)</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="rounded-xl border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adding}
                className="rounded-xl bg-red-600 hover:bg-red-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {adding ? 'Adding…' : 'Add to qBittorrent'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Delete Torrent Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-[#161616] p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">Remove Torrent</h2>
            <p className="text-sm text-neutral-300 break-words">
              Are you sure you want to remove <strong className="text-white">{deleteTarget.name}</strong> from qBittorrent?
            </p>

            <label className="flex items-center gap-2.5 text-sm text-neutral-300 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={deleteWithFiles}
                onChange={e => setDeleteWithFiles(e.target.checked)}
                className="rounded border-neutral-700 bg-black text-red-600 focus:ring-red-500"
              />
              <span>Also permanently delete downloaded files from disk</span>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-semibold text-white"
              >
                Remove Torrent
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
