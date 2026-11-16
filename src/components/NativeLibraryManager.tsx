'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/api/client';
import {
  Activity,
  BarChart3,
  Film,
  FolderPlus,
  HardDrive,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Tv,
} from 'lucide-react';

interface NativeLibraryConfig {
  id: string;
  name: string;
  type: 'movie' | 'tv';
  paths: string[];
  enabled: boolean;
  scanIntervalMinutes: number;
  preferNfo: boolean;
  autoDownloadArtwork: boolean;
}

interface NativeSettings {
  mediaEngine: 'jellyfin' | 'native';
  libraries: NativeLibraryConfig[];
  hwAccel: 'none' | 'vaapi' | 'qsv' | 'nvenc' | 'videotoolbox';
  vaapiDevice: string;
  transcodeTempDir: string;
  maxTranscodeBitrateMbps: number;
  transcodePreset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium';
  hdrToneMapping: boolean;
  allowDirectPlay: boolean;
  allowDirectStream: boolean;
  burnInImageSubtitles: boolean;
  transcodeIdleTimeoutSeconds: number;
  hlsSegmentSeconds: number;
  enableSkipIntroCredits: boolean;
  enableMultiVersionGrouping: boolean;
  enableTrickplay: boolean;
  trickplayIntervalSeconds: number;
  trickplayWidth: number;
  enableSyncPlay: boolean;
  enableWatchStats: boolean;
  defaultAudioLanguage: string;
  defaultSubtitleLanguage: string;
  subtitleMode: 'default' | 'forced' | 'always' | 'none';
  metadataLanguage: string;
  artworkCacheDir: string;
}

interface NativeItemSummary {
  id: string;
  title: string;
  type: 'Movie' | 'Series';
  year?: number;
  tmdbId?: number;
  resolution?: string;
  versions?: Array<{ id: string; label: string }>;
}

interface ActiveStream {
  id: string;
  title: string;
  profileId: string;
  mode: string;
  videoCodec: string;
  audioCodec: string;
  bitrateMbps: number;
  startedAt: string;
}

interface WatchStats {
  totalWatchHours: number;
  itemsWatched: number;
  inProgressCount: number;
  recent: Array<{
    itemId: string;
    title: string;
    type: string;
    lastPlayedAt: string;
    played: boolean;
    watchMinutes: number;
  }>;
}

export function NativeLibraryManager() {
  const [settings, setSettings] = useState<NativeSettings | null>(null);
  const [items, setItems] = useState<NativeItemSummary[]>([]);
  const [streams, setStreams] = useState<ActiveStream[]>([]);
  const [stats, setStats] = useState<WatchStats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [newLibName, setNewLibName] = useState('');
  const [newLibType, setNewLibType] = useState<'movie' | 'tv'>('movie');
  const [newLibPath, setNewLibPath] = useState('');
  const [identifyInputs, setIdentifyInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/native/library');
      if (!res.ok) return;
      const d = await res.json();
      setSettings(d.settings || null);
      setItems(d.items || []);
      setStreams(d.activeStreams || []);
      setStats(d.stats || null);
      setScanning(Boolean(d.scanStatus?.running));
    } catch {
      // Ignore transient load error
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const postAction = async (payload: Record<string, unknown>, okText: string) => {
    setStatusMsg('');
    const res = await apiFetch('/api/native/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatusMsg(d.error || 'Action failed');
      return null;
    }
    setStatusMsg(okText);
    await load();
    return d;
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await postAction({ action: 'saveSettings', settings }, 'Native Media Engine settings saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLibName.trim() || !newLibPath.trim()) return;
    await postAction(
      { action: 'addLibrary', name: newLibName.trim(), type: newLibType, path: newLibPath.trim() },
      `Added library "${newLibName.trim()}".`
    );
    setNewLibName('');
    setNewLibPath('');
  };

  const handleScan = async (libraryId?: string) => {
    setScanning(true);
    try {
      const res = await postAction({ action: 'scan', libraryId }, 'Library scan finished.');
      if (res?.scanStatus) {
        setStatusMsg(
          `Scan complete: ${res.scanStatus.scannedFiles} files checked, ${res.scanStatus.addedItems} new items.`
        );
      }
    } finally {
      setScanning(false);
    }
  };

  if (!settings) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 text-sm text-neutral-400">
        Loading Native Media Engine &amp; Library Manager...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Engine Switch + Scan */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <HardDrive size={18} className="text-red-500" />
              <span>Library Manager &amp; Native Media Engine</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              In-house Jellyfin replacement: directory scanner, TMDB indexer, FFmpeg HLS transcoder, Skip Intro/Credits, Multi-Version grouping, opt-in Trickplay, SyncPlay, and Watch Stats.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={settings.mediaEngine}
              onChange={(e) =>
                setSettings({ ...settings, mediaEngine: e.target.value as 'jellyfin' | 'native' })
              }
              className="bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-semibold"
              aria-label="Active Media Engine"
            >
              <option value="jellyfin">Engine: Jellyfin (Legacy)</option>
              <option value="native">Engine: Native HomeStream</option>
            </select>
            <button
              type="button"
              onClick={() => void handleScan()}
              disabled={scanning}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
            >
              <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
              <span>{scanning ? 'Scanning...' : 'Scan All Libraries'}</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="text-xs bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-lg px-3 py-2">
            {statusMsg}
          </div>
        )}

        {/* Libraries List */}
        <div className="space-y-2">
          {settings.libraries.map((lib) => (
            <div
              key={lib.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3.5 py-2.5 text-xs"
            >
              <div className="flex items-center gap-2.5">
                {lib.type === 'movie' ? (
                  <Film size={15} className="text-red-400" />
                ) : (
                  <Tv size={15} className="text-blue-400" />
                )}
                <div>
                  <span className="font-semibold text-white">{lib.name}</span>
                  <span className="ml-2 text-neutral-400 font-mono">{lib.paths.join(', ')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleScan(lib.id)}
                  className="px-2.5 py-1 rounded border border-neutral-700 hover:bg-neutral-800 text-neutral-200"
                >
                  Scan
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void postAction({ action: 'removeLibrary', libraryId: lib.id }, `Removed "${lib.name}".`)
                  }
                  className="p-1.5 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800"
                  title="Remove library"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Library Form */}
        <form onSubmit={handleAddLibrary} className="grid sm:grid-cols-4 gap-2 pt-1">
          <input
            type="text"
            value={newLibName}
            onChange={(e) => setNewLibName(e.target.value)}
            placeholder="Library name (e.g. Anime)"
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
          />
          <select
            value={newLibType}
            onChange={(e) => setNewLibType(e.target.value as 'movie' | 'tv')}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="movie">Movies</option>
            <option value="tv">TV Shows</option>
          </select>
          <input
            type="text"
            value={newLibPath}
            onChange={(e) => setNewLibPath(e.target.value)}
            placeholder="Folder path (e.g. /mnt/movies)"
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg px-3 py-2"
          >
            <FolderPlus size={14} />
            <span>Add Library</span>
          </button>
        </form>
      </div>

      {/* Comprehensive Transcoding, Playback & Feature Settings */}
      <form
        onSubmit={handleSaveSettings}
        className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Settings2 size={16} className="text-red-400" />
            <span>Transcoding, Playback &amp; Metadata Settings</span>
          </h3>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg"
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <label className="space-y-1">
            <span className="text-neutral-400">Hardware Acceleration</span>
            <select
              value={settings.hwAccel}
              onChange={(e) =>
                setSettings({ ...settings, hwAccel: e.target.value as NativeSettings['hwAccel'] })
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white"
            >
              <option value="none">None (Software libx264)</option>
              <option value="vaapi">VAAPI (Intel / AMD Linux)</option>
              <option value="qsv">Intel QuickSync (QSV)</option>
              <option value="nvenc">NVIDIA NVENC</option>
              <option value="videotoolbox">Apple VideoToolbox</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-neutral-400">Transcode Preset</span>
            <select
              value={settings.transcodePreset}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  transcodePreset: e.target.value as NativeSettings['transcodePreset'],
                })
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white"
            >
              {['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-neutral-400">Max Transcode Bitrate (Mbps, 0 = unlimited)</span>
            <input
              type="number"
              min={0}
              max={200}
              value={settings.maxTranscodeBitrateMbps}
              onChange={(e) =>
                setSettings({ ...settings, maxTranscodeBitrateMbps: Number(e.target.value) || 0 })
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white"
            />
          </label>

          <label className="space-y-1">
            <span className="text-neutral-400">Default Audio Language</span>
            <input
              type="text"
              value={settings.defaultAudioLanguage}
              onChange={(e) => setSettings({ ...settings, defaultAudioLanguage: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white font-mono"
            />
          </label>

          <label className="space-y-1">
            <span className="text-neutral-400">Default Subtitle Language &amp; Mode</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.defaultSubtitleLanguage}
                onChange={(e) =>
                  setSettings({ ...settings, defaultSubtitleLanguage: e.target.value })
                }
                className="w-20 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-white font-mono"
              />
              <select
                value={settings.subtitleMode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    subtitleMode: e.target.value as NativeSettings['subtitleMode'],
                  })
                }
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-white"
              >
                <option value="default">Default</option>
                <option value="forced">Forced Only</option>
                <option value="always">Always</option>
                <option value="none">None</option>
              </select>
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-neutral-400">HLS Segment (sec) / Idle Timeout (sec)</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={2}
                max={15}
                value={settings.hlsSegmentSeconds}
                onChange={(e) =>
                  setSettings({ ...settings, hlsSegmentSeconds: Number(e.target.value) || 4 })
                }
                className="w-1/2 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-white"
              />
              <input
                type="number"
                min={30}
                max={3600}
                value={settings.transcodeIdleTimeoutSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    transcodeIdleTimeoutSeconds: Number(e.target.value) || 120,
                  })
                }
                className="w-1/2 bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-2 text-white"
              />
            </div>
          </label>
        </div>

        {/* Feature Toggles */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 text-xs">
          {[
            ['allowDirectPlay', 'Allow Direct Play (HTTP Range)'],
            ['allowDirectStream', 'Allow Direct Stream / Remux'],
            ['hdrToneMapping', 'HDR → SDR Tone Mapping'],
            ['burnInImageSubtitles', 'Burn-in PGS / VOBSUB / ASS'],
            ['enableSkipIntroCredits', 'Skip Intro & Credits (Chapters)'],
            ['enableMultiVersionGrouping', 'Multi-Version Quality Grouping'],
            ['enableTrickplay', 'Trickplay Seek Thumbnails (Opt-in)'],
            ['enableSyncPlay', 'SyncPlay (Watch Together)'],
            ['enableWatchStats', 'Per-Profile Watch Stats'],
          ].map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={Boolean(settings[key as keyof NativeSettings])}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
              />
              <span className="text-neutral-200">{label}</span>
            </label>
          ))}
        </div>
      </form>

      {/* Active Streams & Watch Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Activity size={16} className="text-emerald-400" />
            <span>Active Native Streams ({streams.length})</span>
          </h3>
          {streams.length === 0 ? (
            <p className="text-xs text-neutral-500">No active native transcode sessions.</p>
          ) : (
            <div className="space-y-2">
              {streams.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">{s.title}</div>
                    <div className="text-neutral-400">
                      {s.mode.toUpperCase()} • {s.videoCodec}/{s.audioCodec} • {s.bitrateMbps} Mbps
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void postAction({ action: 'stopStream', sessionId: s.id }, 'Stopped stream.')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30"
                  >
                    <Square size={12} /> Stop
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-400" />
            <span>Watch Stats</span>
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-neutral-950/70 border border-neutral-800 p-2.5">
              <div className="text-lg font-bold">{stats?.totalWatchHours ?? 0}h</div>
              <div className="text-[11px] text-neutral-400">Watch Time</div>
            </div>
            <div className="rounded-lg bg-neutral-950/70 border border-neutral-800 p-2.5">
              <div className="text-lg font-bold">{stats?.itemsWatched ?? 0}</div>
              <div className="text-[11px] text-neutral-400">Watched</div>
            </div>
            <div className="rounded-lg bg-neutral-950/70 border border-neutral-800 p-2.5">
              <div className="text-lg font-bold">{stats?.inProgressCount ?? 0}</div>
              <div className="text-[11px] text-neutral-400">In Progress</div>
            </div>
          </div>
        </div>
      </div>

      {/* Indexed Items / Identify TMDB */}
      {items.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            <span>Indexed Native Items ({items.length})</span>
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-white">{item.title}</span>
                  {item.year && <span className="ml-1.5 text-neutral-400">({item.year})</span>}
                  <span className="ml-2 text-neutral-500">
                    {item.type}
                    {item.versions && item.versions.length > 1
                      ? ` • ${item.versions.length} versions`
                      : item.resolution
                      ? ` • ${item.resolution}`
                      : ''}
                    {item.tmdbId ? ` • TMDB ${item.tmdbId}` : ' • Unmatched'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="TMDB ID"
                    value={identifyInputs[item.id] || ''}
                    onChange={(e) =>
                      setIdentifyInputs({ ...identifyInputs, [item.id]: e.target.value })
                    }
                    className="w-24 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void postAction(
                        { action: 'identify', itemId: item.id, tmdbId: Number(identifyInputs[item.id] || 0) },
                        `Identified "${item.title}".`
                      )
                    }
                    className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                  >
                    <Search size={12} /> Match
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void postAction({ action: 'deleteItem', itemId: item.id }, `Removed "${item.title}".`)
                    }
                    className="p-1 text-neutral-400 hover:text-red-400"
                    title="Delete from native index"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
