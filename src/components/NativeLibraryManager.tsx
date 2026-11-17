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
  mediaEngine: 'native';
  libraries: NativeLibraryConfig[];
  hwAccel: 'none' | 'auto' | 'vaapi' | 'qsv' | 'nvenc' | 'videotoolbox';
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

const hardwareLabels = {
  vaapi: 'VAAPI (Intel / AMD Linux)',
  qsv: 'Intel QuickSync (QSV)',
  nvenc: 'NVIDIA NVENC',
  videotoolbox: 'Apple VideoToolbox',
} as const;
type HardwareMode = keyof typeof hardwareLabels;

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

export function NativeLibraryManager({ section = 'all' }: { section?: 'all' | 'libraries' | 'playback' | 'maintenance' } = {}) {
  const showLibraries = section === 'all' || section === 'libraries';
  const showPlayback = section === 'all' || section === 'playback';
  const showMaintenance = section === 'all' || section === 'maintenance';
  const [settings, setSettings] = useState<NativeSettings | null>(null);
  const [hardwareAcceleration, setHardwareAcceleration] = useState<HardwareMode[]>([]);
  const [items, setItems] = useState<NativeItemSummary[]>([]);
  const [streams, setStreams] = useState<ActiveStream[]>([]);
  const [stats, setStats] = useState<WatchStats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ scannedFiles: number; addedItems: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [newLibName, setNewLibName] = useState('');
  const [playbackGroup, setPlaybackGroup] = useState<'all' | 'transcoding' | 'languages' | 'toggles' | 'streams'>('all');
  const [maintenanceGroup, setMaintenanceGroup] = useState<'all' | 'health' | 'caches' | 'backups'>('all');
  const [newLibType, setNewLibType] = useState<'movie' | 'tv'>('movie');
  const [newLibPath, setNewLibPath] = useState('');
  const [identifyInputs, setIdentifyInputs] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<{
    totalFiles: number;
    totalItems: number;
    missingFiles: Array<{ fileId: string; itemId: string; filePath: string }>;
    missingMetadata: Array<{ itemId: string; title: string; type: string }>;
    missingOrStaleTrickplay: number;
    unmatchedItems: number;
  } | null>(null);
  const [trickplayBackfill, setTrickplayBackfill] = useState<{ running: boolean; total: number; completed: number; currentFile?: string } | null>(null);
  const [cacheStats, setCacheStats] = useState<{ artworkBytes: number; trickplayBytes: number; transcodeBytes: number; subtitleCacheBytes: number } | null>(null);
  const [introDetection, setIntroDetection] = useState<{ running: boolean; total: number; completed: number; detected: number; currentSeries?: string } | null>(null);
  const [introPreviews, setIntroPreviews] = useState<Array<{ fileId: string; itemId: string; title: string; seriesTitle?: string; seasonNumber?: number; episodeNumber?: number; confidence: number; startSeconds: number; endSeconds: number }>>([]);
  const [backups, setBackups] = useState<Array<{ filename: string; sizeBytes: number; createdAt: string }>>([]);
  const [backupSchedule, setBackupSchedule] = useState<{ enabled: boolean; intervalHours: number; retentionCount: number; lastRunAt?: string; lastStatus?: string } | null>(null);
  const [backupVerifyMsg, setBackupVerifyMsg] = useState('');
  const [skipFileId, setSkipFileId] = useState('');
  const [skipRecapStart, setSkipRecapStart] = useState('');
  const [skipRecapEnd, setSkipRecapEnd] = useState('');
  const [skipIntroStart, setSkipIntroStart] = useState('');
  const [skipIntroEnd, setSkipIntroEnd] = useState('');
  const [skipCreditsStart, setSkipCreditsStart] = useState('');
  const [skipCreditsEnd, setSkipCreditsEnd] = useState('');
  const [adminFiles, setAdminFiles] = useState<Array<{
    fileId: string;
    itemId: string;
    title: string;
    seriesTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    resolution?: string;
    versionLabel?: string;
    skipSegments: Array<{ type: 'recap' | 'intro' | 'credits'; startSeconds: number; endSeconds: number }>;
    hasManualOverride: boolean;
  }>>([]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/native/library');
      if (!res.ok) return;
      const d = await res.json();
      setSettings(d.settings || null);
      const available: string[] = Array.isArray(d.hardwareAcceleration) ? d.hardwareAcceleration : [];
      setHardwareAcceleration((Object.keys(hardwareLabels) as HardwareMode[]).filter(mode => available.includes(mode)));
      setItems(d.items || []);
      setAdminFiles(Array.isArray(d.adminFiles) ? d.adminFiles : []);
      setStreams(d.activeStreams || []);
      setStats(d.stats || null);
      setHealth(d.health || null);
      setTrickplayBackfill(d.trickplayBackfill || null);
      setCacheStats(d.cacheStats || null);
      setIntroDetection(d.introDetection || null);
      setIntroPreviews(Array.isArray(d.introPreviews) ? d.introPreviews : []);
      setBackups(Array.isArray(d.backups) ? d.backups : []);
      setBackupSchedule(d.backupSchedule || null);
      setScanning(Boolean(d.scanStatus?.running));
      if (d.scanStatus) {
        setScanProgress({
          scannedFiles: Number(d.scanStatus.scannedFiles || 0),
          addedItems: Number(d.scanStatus.addedItems || 0),
        });
      }
    } catch {
      // Ignore transient load error
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(() => {
      void load();
    }, 2000);
    return () => clearInterval(timer);
  }, [scanning, load]);

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
    const res = await postAction({ action: 'scan', libraryId }, 'Library scan started...');
    if (res?.scanStatus && !res.scanStatus.running) {
      setScanning(false);
      setStatusMsg(
        `Scan complete: ${res.scanStatus.scannedFiles} files checked, ${res.scanStatus.addedItems} new items.`
      );
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
      {statusMsg && (
        <div className="text-xs bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-lg px-3 py-2">
          {statusMsg}
        </div>
      )}

      {/* Header + Engine Switch + Scan */}
      {showLibraries && (
      <>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <HardDrive size={18} className="text-red-500" />
              <span>Library Manager</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Native directory scanner, TMDB indexer, FFmpeg HLS transcoder, Skip Intro/Credits, Multi-Version grouping, Trickplay, SyncPlay, and Watch Stats.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleScan()}
              disabled={scanning}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
            >
              <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
              <span>{scanning ? 'Scanning...' : 'Scan All Libraries'}</span>
            </button>
            <button
              type="button"
              onClick={() => void postAction({ action: 'refreshMetadata' }, 'Metadata refresh complete.')}
              className="flex items-center gap-1.5 border border-neutral-700 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold px-3 py-2 rounded-lg transition"
            >
              <Sparkles size={14} />
              <span>Refresh Metadata</span>
            </button>
          </div>
        </div>

        {(statusMsg || scanning) && (
          <div className="text-xs bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-lg px-3 py-2">
            {scanning && scanProgress
              ? `Scanning libraries... ${scanProgress.scannedFiles} files checked, ${scanProgress.addedItems} new items added.`
              : statusMsg}
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

      {/* Library Health & Repair */}
      {health && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-white">Library Health</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void postAction({ action: 'repairHealth', repair: 'pruneMissing' }, 'Pruned missing files.')}
                className="px-3 py-1.5 rounded border border-neutral-700 hover:bg-neutral-800 text-neutral-200"
              >
                Prune Missing ({health.missingFiles.length})
              </button>
              <button
                type="button"
                onClick={() => void postAction({ action: 'repairHealth', repair: 'refreshMetadata' }, 'Refreshed missing metadata.')}
                className="px-3 py-1.5 rounded border border-neutral-700 hover:bg-neutral-800 text-neutral-200"
              >
                Repair Metadata ({health.missingMetadata.length})
              </button>
              <button
                type="button"
                onClick={() => void postAction({ action: 'repairHealth', repair: 'backfillTrickplay' }, 'Queued Trickplay backfill.')}
                className="px-3 py-1.5 rounded border border-neutral-700 hover:bg-neutral-800 text-neutral-200"
              >
                Rebuild Trickplay ({health.missingOrStaleTrickplay})
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"><div className="text-neutral-400">Items</div><div className="text-lg font-bold text-white">{health.totalItems}</div></div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"><div className="text-neutral-400">Files</div><div className="text-lg font-bold text-white">{health.totalFiles}</div></div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"><div className="text-neutral-400">Missing Files</div><div className="text-lg font-bold text-amber-400">{health.missingFiles.length}</div></div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"><div className="text-neutral-400">Missing Meta</div><div className="text-lg font-bold text-amber-400">{health.missingMetadata.length}</div></div>
            <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"><div className="text-neutral-400">Stale Trickplay</div><div className="text-lg font-bold text-neutral-200">{health.missingOrStaleTrickplay}</div></div>
          </div>
        </div>
      )}
      </>
      )}

      {/* Comprehensive Transcoding, Playback & Feature Settings */}
      {showPlayback && (
      <>
      {section === 'playback' && (
        <div className="flex flex-wrap gap-1.5">
          {([
            ['all', 'All Playback Settings'],
            ['transcoding', 'Transcoding & Hardware'],
            ['languages', 'Languages & Subtitles'],
            ['toggles', 'Feature Toggles'],
            ['streams', 'Streams & Intro Previews'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPlaybackGroup(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                playbackGroup === key
                  ? 'bg-red-600 text-white border-red-500'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {(playbackGroup === 'all' || playbackGroup === 'transcoding' || playbackGroup === 'languages' || playbackGroup === 'toggles') && (
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

        {(playbackGroup === 'all' || playbackGroup === 'transcoding') && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <label className="space-y-1">
            <span className="text-neutral-400">Hardware Acceleration</span>
            <select
              value={settings.hwAccel === 'none' || (settings.hwAccel === 'auto' && hardwareAcceleration.length > 0) || hardwareAcceleration.includes(settings.hwAccel as HardwareMode)
                ? settings.hwAccel : 'none'}
              onChange={(e) =>
                setSettings({ ...settings, hwAccel: e.target.value as NativeSettings['hwAccel'] })
              }
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white"
            >
              <option value="none">None (Software libx264)</option>
              {hardwareAcceleration.length > 0 && <option value="auto">Auto (detected hardware)</option>}
              {hardwareAcceleration.map(mode => <option key={mode} value={mode}>{hardwareLabels[mode]}</option>)}
            </select>
            {hardwareAcceleration.length === 0 && (
              <span className="block text-neutral-400">No working hardware encoder detected on the backend.</span>
            )}
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
        </div>
        )}

        {(playbackGroup === 'all' || playbackGroup === 'languages' || playbackGroup === 'transcoding') && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {(playbackGroup === 'all' || playbackGroup === 'languages') && (
          <>
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
          </>
          )}

          {(playbackGroup === 'all' || playbackGroup === 'transcoding') && (
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
          )}
        </div>
        )}

        {/* Feature Toggles */}
        {(playbackGroup === 'all' || playbackGroup === 'toggles') && (
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
        )}
      </form>
      )}

      {/* Active Streams & Watch Stats */}
      {(playbackGroup === 'all' || playbackGroup === 'streams') && (
      <>
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

      {/* Per-Version Skip Marker Editor & Auto-Intro Previews */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4 text-xs">
        <h3 className="text-base font-bold text-white">Skip Recap / Intro / Credits Per-Version Overrides</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="space-y-1 sm:col-span-2 lg:col-span-1">
            <span className="text-neutral-400">File / Version ID</span>
            <select
              value={skipFileId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSkipFileId(nextId);
                const found = adminFiles.find((f) => f.fileId === nextId);
                const recap = found?.skipSegments.find((s) => s.type === 'recap');
                const intro = found?.skipSegments.find((s) => s.type === 'intro');
                const credits = found?.skipSegments.find((s) => s.type === 'credits');
                setSkipRecapStart(recap ? String(recap.startSeconds) : '');
                setSkipRecapEnd(recap ? String(recap.endSeconds) : '');
                setSkipIntroStart(intro ? String(intro.startSeconds) : '');
                setSkipIntroEnd(intro ? String(intro.endSeconds) : '');
                setSkipCreditsStart(credits ? String(credits.startSeconds) : '');
                setSkipCreditsEnd(credits ? String(credits.endSeconds) : '');
              }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white"
            >
              <option value="">Select file / version…</option>
              {adminFiles.map((f) => {
                const epTag = f.seasonNumber !== undefined && f.episodeNumber !== undefined
                  ? `S${String(f.seasonNumber).padStart(2, '0')}E${String(f.episodeNumber).padStart(2, '0')} `
                  : '';
                const verTag = f.versionLabel || f.resolution || 'Default';
                return (
                  <option key={f.fileId} value={f.fileId}>
                    {f.seriesTitle ? `${f.seriesTitle} ${epTag}— ` : ''}{f.title} [{verTag}]{f.hasManualOverride ? ' ★' : ''}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="space-y-1">
            <span className="text-neutral-400">Recap (sec)</span>
            <div className="flex gap-1.5">
              <input type="number" min={0} placeholder="Start" value={skipRecapStart} onChange={(e) => setSkipRecapStart(e.target.value)} className="w-1/2 bg-neutral-950 border border-neutral-800 rounded px-2 py-2 text-white" />
              <input type="number" min={0} placeholder="End" value={skipRecapEnd} onChange={(e) => setSkipRecapEnd(e.target.value)} className="w-1/2 bg-neutral-950 border border-neutral-800 rounded px-2 py-2 text-white" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-neutral-400">Intro (sec)</span>
            <div className="flex gap-1.5">
              <input type="number" min={0} placeholder="Start" value={skipIntroStart} onChange={(e) => setSkipIntroStart(e.target.value)} className="w-1/2 bg-neutral-950 border border-neutral-800 rounded px-2 py-2 text-white" />
              <input type="number" min={0} placeholder="End" value={skipIntroEnd} onChange={(e) => setSkipIntroEnd(e.target.value)} className="w-1/2 bg-neutral-950 border border-neutral-800 rounded px-2 py-2 text-white" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-neutral-400">Credits (sec)</span>
            <div className="flex gap-1.5">
              <input type="number" min={0} placeholder="Start" value={skipCreditsStart} onChange={(e) => setSkipCreditsStart(e.target.value)} className="w-1/2 bg-neutral-950 border border-neutral-800 rounded px-2 py-2 text-white" />
              <input type="number" min={0} placeholder="End" value={skipCreditsEnd} onChange={(e) => setSkipCreditsEnd(e.target.value)} className="w-1/2 bg-neutral-950 border border-neutral-800 rounded px-2 py-2 text-white" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!skipFileId}
            onClick={() => {
              const segments: Array<{ type: 'recap' | 'intro' | 'credits'; startSeconds: number; endSeconds: number }> = [];
              if (skipRecapStart !== '' && skipRecapEnd !== '') segments.push({ type: 'recap', startSeconds: Number(skipRecapStart), endSeconds: Number(skipRecapEnd) });
              if (skipIntroStart !== '' && skipIntroEnd !== '') segments.push({ type: 'intro', startSeconds: Number(skipIntroStart), endSeconds: Number(skipIntroEnd) });
              if (skipCreditsStart !== '' && skipCreditsEnd !== '') segments.push({ type: 'credits', startSeconds: Number(skipCreditsStart), endSeconds: Number(skipCreditsEnd) });
              void postAction({ action: 'setSkipSegments', fileId: skipFileId, segments }, `Saved ${segments.length} skip segment(s) for ${skipFileId}.`);
            }}
            className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold"
          >
            Save Skip Overrides
          </button>
          <button
            type="button"
            disabled={!skipFileId}
            onClick={() => {
              setSkipRecapStart(''); setSkipRecapEnd('');
              setSkipIntroStart(''); setSkipIntroEnd('');
              setSkipCreditsStart(''); setSkipCreditsEnd('');
              void postAction({ action: 'setSkipSegments', fileId: skipFileId, reset: true }, `Reset ${skipFileId} to chapter defaults.`);
            }}
            className="px-3.5 py-2 rounded-lg border border-neutral-700 hover:bg-neutral-800 disabled:opacity-50 text-neutral-200 font-semibold"
          >
            Reset to Chapter Defaults
          </button>
        </div>

        {introPreviews.length > 0 && (
          <div className="border-t border-neutral-800 pt-3 space-y-2">
            <div className="font-semibold text-neutral-200">Unpublished Auto-Detected Intros ({introPreviews.length})</div>
            {introPreviews.map((p) => (
              <div key={p.fileId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2">
                <div>
                  <span className="font-semibold text-white">{p.seriesTitle ? `${p.seriesTitle} S${p.seasonNumber}E${p.episodeNumber} — ` : ''}{p.title}</span>
                  <span className="ml-2 text-neutral-400">{p.startSeconds}s–{p.endSeconds}s • {Math.round(p.confidence * 100)}% confidence</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void postAction({ action: 'introPreviewApprove', fileId: p.fileId, startSeconds: p.startSeconds, endSeconds: p.endSeconds }, `Published intro for ${p.title}.`)}
                    className="px-2.5 py-1 rounded bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                  >
                    Approve &amp; Publish
                  </button>
                  <button
                    type="button"
                    onClick={() => void postAction({ action: 'introPreviewDismiss', fileId: p.fileId }, `Dismissed preview for ${p.title}.`)}
                    className="px-2.5 py-1 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
      </>
      )}

      {/* Maintenance: Trickplay, Intro Detection, Caches, SQLite Backups */}
      {showMaintenance && (
        <div className="space-y-6">
          {section === 'maintenance' && (
            <div className="flex flex-wrap gap-1.5">
              {([
                ['all', 'All Maintenance'],
                ['health', 'Health & Repair'],
                ['caches', 'Caches & Trickplay'],
                ['backups', 'Database Backups'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMaintenanceGroup(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    maintenanceGroup === key
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {section === 'maintenance' && health && (maintenanceGroup === 'all' || maintenanceGroup === 'health') && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white">Library Health</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void postAction({ action: 'repairHealth', repair: 'pruneMissing' }, 'Pruned missing files.')}
                    className="px-3 py-1.5 rounded border border-neutral-700 hover:bg-neutral-800 text-neutral-200"
                  >
                    Prune Missing ({health.missingFiles.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => void postAction({ action: 'repairHealth', repair: 'refreshMetadata' }, 'Refreshed missing metadata.')}
                    className="px-3 py-1.5 rounded border border-neutral-700 hover:bg-neutral-800 text-neutral-200"
                  >
                    Repair Metadata ({health.missingMetadata.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => void postAction({ action: 'repairHealth', repair: 'backfillTrickplay' }, 'Queued Trickplay backfill.')}
                    className="px-3 py-1.5 rounded border border-neutral-700 hover:bg-neutral-800 text-neutral-200"
                  >
                    Rebuild Trickplay ({health.missingOrStaleTrickplay})
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"><div className="text-neutral-400">Items</div><div className="text-lg font-bold text-white">{health.totalItems}</div></div>
                <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"><div className="text-neutral-400">Files</div><div className="text-lg font-bold text-white">{health.totalFiles}</div></div>
                <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"><div className="text-neutral-400">Missing Files</div><div className="text-lg font-bold text-amber-400">{health.missingFiles.length}</div></div>
                <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"><div className="text-neutral-400">Missing Meta</div><div className="text-lg font-bold text-amber-400">{health.missingMetadata.length}</div></div>
                <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3"><div className="text-neutral-400">Stale Trickplay</div><div className="text-lg font-bold text-neutral-200">{health.missingOrStaleTrickplay}</div></div>
              </div>
            </div>
          )}

          {(maintenanceGroup === 'all' || maintenanceGroup === 'caches') && (
          <div className="grid md:grid-cols-2 gap-6 text-xs">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Trickplay &amp; Intro Jobs</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={Boolean(trickplayBackfill?.running)}
                    onClick={() => void postAction({ action: 'backfillTrickplay' }, 'Started Trickplay backfill.')}
                    className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold"
                  >
                    {trickplayBackfill?.running ? `Backfilling (${trickplayBackfill.completed}/${trickplayBackfill.total})` : 'Backfill Trickplay'}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(introDetection?.running)}
                    onClick={() => void postAction({ action: 'introDetectionStart' }, 'Started background intro detection.')}
                    className="px-3 py-1.5 rounded border border-neutral-700 hover:bg-neutral-800 text-neutral-200 font-semibold"
                  >
                    {introDetection?.running ? `Detecting (${introDetection.completed}/${introDetection.total})` : 'Detect Intros'}
                  </button>
                </div>
              </div>
              {trickplayBackfill && (
                <p className="text-neutral-400">
                  Trickplay: {trickplayBackfill.running ? `Running ${trickplayBackfill.completed}/${trickplayBackfill.total}` : 'Idle'}
                </p>
              )}
              {introDetection && (
                <p className="text-neutral-400">
                  Intro Detection: {introDetection.running ? `Scanning ${introDetection.currentSeries || ''} (${introDetection.completed}/${introDetection.total})` : `Idle • ${introPreviews.length} pending review`}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Media Caches</h3>
                <button
                  type="button"
                  onClick={() => void postAction({ action: 'pruneCaches' }, 'Pruned stale transcode, subtitle, and orphan Trickplay caches.')}
                  className="px-3 py-1.5 rounded border border-neutral-700 hover:bg-neutral-800 text-neutral-200 font-semibold"
                >
                  Prune Stale Caches
                </button>
              </div>
              {cacheStats && (
                <div className="grid grid-cols-2 gap-2 text-neutral-300">
                  <div>Artwork: {(cacheStats.artworkBytes / 1048576).toFixed(1)} MB</div>
                  <div>Trickplay: {(cacheStats.trickplayBytes / 1048576).toFixed(1)} MB</div>
                  <div>Transcode: {(cacheStats.transcodeBytes / 1048576).toFixed(1)} MB</div>
                  <div>Subtitles: {(cacheStats.subtitleCacheBytes / 1048576).toFixed(1)} MB</div>
                </div>
              )}
            </div>
          </div>
          )}

          {(maintenanceGroup === 'all' || maintenanceGroup === 'backups') && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white">Scheduled SQLite Backups &amp; Verification</h3>
                {backupSchedule && (
                  <p className="text-neutral-400 mt-0.5">
                    Schedule: {backupSchedule.enabled ? `Every ${backupSchedule.intervalHours}h • Keep ${backupSchedule.retentionCount}` : 'Disabled'}
                    {backupSchedule.lastRunAt ? ` • Last: ${new Date(backupSchedule.lastRunAt).toLocaleString()} (${backupSchedule.lastStatus || 'ok'})` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void postAction({ action: 'backupCreate' }, 'Created and verified SQLite backup.')}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                Create &amp; Verify Backup
              </button>
            </div>
            {backupVerifyMsg && <p className="text-emerald-300">{backupVerifyMsg}</p>}
            {backups.length === 0 ? (
              <p className="text-neutral-500">No backups recorded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {backups.map((b) => (
                  <div key={b.filename} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2">
                    <div>
                      <span className="font-mono text-white">{b.filename}</span>
                      <span className="ml-2 text-neutral-400">{(b.sizeBytes / 1048576).toFixed(2)} MB • {new Date(b.createdAt).toLocaleString()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await apiFetch('/api/native/library', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'backupVerify', filename: b.filename }),
                        });
                        const d = await res.json();
                        setBackupVerifyMsg(d?.verification?.ok
                          ? `${b.filename}: integrity=${d.verification.integrity}, tables=${d.verification.tableCount}`
                          : `Verification failed: ${d?.error || d?.verification?.integrity || 'error'}`);
                      }}
                      className="px-2.5 py-1 rounded border border-neutral-700 hover:bg-neutral-800 text-neutral-200"
                    >
                      Verify Read-Only
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* Indexed Items / Identify TMDB */}
      {showLibraries && items.length > 0 && (
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
              onClick={() => void postAction({ action: 'identify', itemId: item.id, tmdbId: Number(identifyInputs[item.id] || 0) }, `Identified "${item.title}".`)}
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
