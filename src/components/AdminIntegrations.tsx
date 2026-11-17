'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/api/client';
import type { IntegrationSummary, IntegrationsResponse } from '@/types';
import { AdminDownloadManager } from '@/components/AdminDownloadManager';
import { NativeLibraryManager } from '@/components/NativeLibraryManager';
import {
  ShieldCheck,
  Loader2,
  Blocks,
  HardDrive,
  Activity,
  Users,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Film,
  Tv,
  Music2,
  BookOpen,
  Download,
} from 'lucide-react';

type AdminTab = 'modules' | 'media' | 'downloads' | 'system';

interface MediaOverviewStats {
  moviesCount: number;
  seriesCount: number;
  requestedCount: number;
  musicReady: number;
  musicActive: number;
  musicFailed: number;
  booksCount: number;
}

interface SystemProfile {
  id: string;
  name: string;
  accountId?: string;
  isKids?: boolean;
  isAdministrator?: boolean;
}

interface AccountSummary {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  hasPassword: boolean;
  legacyJellyfinAuth: boolean;
}

interface ActiveSession {
  deviceId: string;
  deviceName: string;
  platform: string;
  title?: string;
  state?: string;
}

function IntegrationCard({
  integration,
  downloadsPath,
  booksPath,
}: {
  integration: IntegrationSummary;
  downloadsPath: string;
  booksPath: string;
}) {
  const [configured, setConfigured] = useState(integration.configured);
  const [url, setUrl] = useState(integration.url);
  const [secret, setSecret] = useState('');
  const [username, setUsername] = useState(integration.username || '');
  const [path, setPath] = useState(downloadsPath);
  const [bPath, setBPath] = useState(booksPath);
  const [qualityProfileId, setQualityProfileId] = useState<number>(integration.qualityProfileId || 1);
  const [qualityPreference, setQualityPreference] = useState<'mp3-320' | 'flac' | 'any-lossless' | 'mp3-any'>(
    integration.qualityPreference || 'mp3-320'
  );
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [credentialSet, setCredentialSet] = useState(integration.credentialSet);

  async function submit(action: 'save' | 'test') {
    setBusy(action);
    setMessage('');
    try {
      const response = await apiFetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration: integration.id,
          action,
          url,
          secret,
          username,
          parentPin: pin,
          ...(integration.id === 'qbittorrent' ? { downloadsPath: path } : {}),
          ...((integration.id as string) === 'bookshelf' ? { booksPath: bPath } : {}),
          ...(integration.id === 'radarr' || integration.id === 'sonarr' ? { qualityProfileId } : {}),
          ...(integration.id === 'slskd' ? { qualityPreference } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw Error(data.error || 'Connection failed. Check the server URL and credential.');
      }
      setSuccess(true);
      setMessage(
        action === 'save'
          ? 'Integration saved.'
          : 'Connection successful' + (data.version ? ' · ' + data.version : '')
      );
      if (action === 'save') {
        setConfigured(Boolean(url && (integration.id === 'qbittorrent' || secret || credentialSet)));
        window.dispatchEvent(new Event('homestream-integrations-updated'));
        if (secret) setCredentialSet(true);
        setSecret('');
        setPin('');
      }
    } catch (e) {
      setSuccess(false);
      setMessage(e instanceof Error ? e.message : 'Unable to save integration');
    } finally {
      setBusy('');
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit('save');
      }}
      className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 md:p-6 space-y-4"
    >
      <div className="flex justify-between items-center gap-4">
        <h2 className="font-semibold text-xl">{integration.name}</h2>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            configured
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
          }`}
        >
          {configured ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {configured ? 'Configured' : 'Not connected'}
        </span>
      </div>
      <label className="block text-sm text-neutral-300">
        Server URL
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={
            (integration.id as string) === 'slskd'
              ? 'http://192.168.1.146:5030'
              : (integration.id as string) === 'bookshelf'
                ? 'http://192.168.1.146:8787'
                : 'http://192.168.1.100:8688'
          }
          className="mt-2 block w-full rounded-lg border border-neutral-700 bg-black/40 p-3 text-white"
        />
      </label>
      {integration.id === 'qbittorrent' && (
        <label className="block text-sm text-neutral-300">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            className="mt-2 block w-full rounded-lg border border-neutral-700 bg-black/40 p-3 text-white"
          />
        </label>
      )}
      <label className="block text-sm text-neutral-300">
        {integration.id === 'qbittorrent' ? 'Password' : 'API key'}
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="new-password"
          placeholder={credentialSet ? 'Saved — leave blank to keep' : 'Enter credential'}
          className="mt-2 block w-full rounded-lg border border-neutral-700 bg-black/40 p-3 text-white"
        />
      </label>
      <p className="text-xs text-neutral-500">
        Saved credentials are never returned to the browser. Leave the credential blank to preserve it. Clear the URL to disconnect.
      </p>
      {(integration.id as string) === 'bookshelf' && (
        <label className="block text-sm text-neutral-300">
          Books folder inside backend
          <input
            value={bPath}
            onChange={(e) => setBPath(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-neutral-700 bg-black/40 p-3 text-white"
          />
        </label>
      )}
      {integration.id === 'qbittorrent' && (
        <label className="block text-sm text-neutral-300">
          Downloads path inside backend
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-neutral-700 bg-black/40 p-3 text-white"
          />
        </label>
      )}
      {(integration.id === 'radarr' || integration.id === 'sonarr') && (
        <label className="block text-sm text-neutral-300">
          Search quality profile
          {integration.qualityProfiles && integration.qualityProfiles.length > 0 ? (
            <select
              value={qualityProfileId}
              onChange={(e) => setQualityProfileId(Number(e.target.value))}
              className="mt-2 block w-full rounded-lg border border-neutral-700 bg-black/40 p-3 text-white"
            >
              {integration.qualityProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={1}
              value={qualityProfileId}
              onChange={(e) => setQualityProfileId(Math.max(1, Number(e.target.value) || 1))}
              className="mt-2 block w-full rounded-lg border border-neutral-700 bg-black/40 p-3 text-white"
            />
          )}
        </label>
      )}
      {integration.id === 'slskd' && (
        <label className="block text-sm text-neutral-300">
          Search audio quality
          <select
            value={qualityPreference}
            onChange={(e) => setQualityPreference(e.target.value as 'mp3-320' | 'flac' | 'any-lossless' | 'mp3-any')}
            className="mt-2 block w-full rounded-lg border border-neutral-700 bg-black/40 p-3 text-white"
          >
            <option value="mp3-320">MP3 320kbps (Recommended)</option>
            <option value="flac">FLAC (Lossless)</option>
            <option value="any-lossless">Any Lossless (FLAC / ALAC / WAV)</option>
            <option value="mp3-any">Any MP3 (192kbps+)</option>
          </select>
        </label>
      )}
      <label className="block text-xs text-neutral-500">
        Parent PIN (if configured)
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoComplete="off"
          className="ml-3 rounded border border-neutral-700 bg-black/40 p-2 w-28 text-white"
        />
      </label>
      <div className="flex gap-3">
        <button
          disabled={Boolean(busy)}
          type="submit"
          className="rounded-lg px-4 py-2 bg-red-600 text-sm font-semibold disabled:opacity-50"
        >
          {busy === 'save' ? 'Saving…' : 'Save integration'}
        </button>
        <button
          disabled={Boolean(busy)}
          type="button"
          onClick={() => submit('test')}
          className="rounded-lg px-4 py-2 border border-neutral-700 text-sm disabled:opacity-50"
        >
          {busy === 'test' ? 'Testing…' : 'Test connection'}
        </button>
      </div>
      {message && (
        <p role={success ? 'status' : 'alert'} className={'text-sm ' + (success ? 'text-emerald-400' : 'text-red-300')}>
          {message}
        </p>
      )}
    </form>
  );
}

export function AdminIntegrations({
  initialTab = 'modules',
  activeTab,
  onTabChange,
}: {
  initialTab?: AdminTab;
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
} = {}) {
  const [tab, setTab] = useState<AdminTab>(activeTab || initialTab);

  useEffect(() => {
    if (activeTab && activeTab !== tab) {
      setTab(activeTab);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onTabChange?.(tab);
  }, [tab, onTabChange]);
  const [moduleFilter, setModuleFilter] = useState<'all' | 'configured' | 'disconnected'>('all');
  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [error, setError] = useState('');
  const [mediaStats, setMediaStats] = useState<MediaOverviewStats | null>(null);
  const [profiles, setProfiles] = useState<SystemProfile[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [newAcctUser, setNewAcctUser] = useState('');
  const [newAcctPass, setNewAcctPass] = useState('');
  const [newAcctAdmin, setNewAcctAdmin] = useState(false);
  const [acctMsg, setAcctMsg] = useState('');
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [refreshingSystem, setRefreshingSystem] = useState(false);

  const loadIntegrations = useCallback(async (signal?: AbortSignal) => {
    const r = await apiFetch('/api/integrations', { signal });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || 'Administrator access is required');
    setData(d);
  }, []);

  const loadMediaOverview = useCallback(async () => {
    const [moviesRes, seriesRes, nativeRes, reqRes, musicStatusRes, musicLibRes, booksRes] = await Promise.all([
      apiFetch('/api/library/movies').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch('/api/library/tv').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch('/api/native/library').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch('/api/requested').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch('/api/music/import-status').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch('/api/music?offset=0').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch('/api/books?limit=1').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    const nativeItems = Array.isArray(nativeRes?.items) ? (nativeRes.items as Array<{ type?: string }>) : [];
    const nativeMovies = nativeItems.filter((i) => i.type === 'Movie').length;
    const nativeSeries = nativeItems.filter((i) => i.type === 'Series').length;
    const jfMovies = Number(moviesRes?.totalCount ?? moviesRes?.items?.length ?? 0);
    const jfSeries = Number(seriesRes?.totalCount ?? seriesRes?.items?.length ?? 0);
    const useNative = nativeRes?.settings?.mediaEngine === 'native' || (jfMovies === 0 && nativeMovies > 0) || (jfSeries === 0 && nativeSeries > 0);
    const readyFromImport = Number(musicStatusRes?.ready ?? 0);
    const readyFromAlbums = Number(musicLibRes?.total ?? musicLibRes?.albums?.length ?? 0);
    setMediaStats({
      moviesCount: useNative ? nativeMovies : jfMovies,
      seriesCount: useNative ? nativeSeries : jfSeries,
      requestedCount: Array.isArray(reqRes?.items) ? reqRes.items.length : 0,
      musicReady: readyFromImport > 0 ? readyFromImport : readyFromAlbums,
      musicActive: Number((musicStatusRes?.queued ?? 0) + (musicStatusRes?.searching ?? 0) + (musicStatusRes?.downloading ?? 0) + (musicStatusRes?.importing ?? 0)),
      musicFailed: Number(musicStatusRes?.failed ?? 0),
      booksCount: Number(booksRes?.total ?? booksRes?.books?.length ?? 0),
    });
  }, []);

  const loadSystemOverview = useCallback(async () => {
    setRefreshingSystem(true);
    try {
      const [profRes, sessRes, acctRes] = await Promise.all([
        apiFetch('/api/profiles').then((r) => (r.ok ? r.json() : { profiles: [] })).catch(() => ({ profiles: [] })),
        apiFetch('/api/sessions').then((r) => (r.ok ? r.json() : { sessions: [] })).catch(() => ({ sessions: [] })),
        apiFetch('/api/accounts').then((r) => (r.ok ? r.json() : { accounts: [], profiles: [] })).catch(() => ({ accounts: [], profiles: [] })),
        loadIntegrations().catch(() => {}),
      ]);
      setProfiles(Array.isArray(acctRes?.profiles) && acctRes.profiles.length ? acctRes.profiles : Array.isArray(profRes?.profiles) ? profRes.profiles : []);
      setAccounts(Array.isArray(acctRes?.accounts) ? acctRes.accounts : []);
      setSessions(Array.isArray(sessRes?.sessions) ? sessRes.sessions : []);
    } finally {
      setRefreshingSystem(false);
    }
  }, [loadIntegrations]);

  async function submitAccountAction(payload: Record<string, unknown>) {
    setAcctMsg('');
    const r = await apiFetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) {
      setAcctMsg(d.error || 'Account action failed');
      return false;
    }
    if (Array.isArray(d.accounts)) setAccounts(d.accounts);
    await loadSystemOverview();
    return true;
  }

  useEffect(() => {
    const c = new AbortController();
    loadIntegrations(c.signal).catch((e) => {
      if (!c.signal.aborted) setError(e.message);
    });
    return () => c.abort();
  }, [loadIntegrations]);

  useEffect(() => {
    if (tab === 'media') {
      void loadMediaOverview();
      const timer = setInterval(() => {
        if (!document.hidden) void loadMediaOverview();
      }, 8000);
      return () => clearInterval(timer);
    }
    if (tab === 'system') void loadSystemOverview();
  }, [tab, loadMediaOverview, loadSystemOverview]);

  const integrations = data?.integrations || [];
  const configuredCount = integrations.filter((i) => i.configured).length;
  const filteredIntegrations = integrations.filter((i) => {
    if (moduleFilter === 'configured') return i.configured;
    if (moduleFilter === 'disconnected') return !i.configured;
    return true;
  });

  return (
    <main className="pt-28 md:pt-32 pb-40 px-4 md:px-12 max-w-screen-2xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-800 pb-6 mb-8">
        <div>
          <div className="flex gap-3 items-center text-red-400 mb-2">
            <ShieldCheck size={20} />
            <span className="uppercase tracking-widest text-xs font-bold">Administration</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">Server Control Center</h1>
          <p className="text-neutral-400 mt-2">
            Manage modules, media libraries, download queues, storage paths, and connected devices.
          </p>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 p-1.5 rounded-xl">
          <button
            onClick={() => setTab('modules')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'modules' ? 'bg-red-600 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Blocks size={16} />
            <span>Modules ({configuredCount}/{integrations.length})</span>
          </button>
          <button
            onClick={() => setTab('media')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'media' ? 'bg-red-600 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <HardDrive size={16} />
            <span>Media Management</span>
          </button>
          <button
            onClick={() => setTab('downloads')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'downloads' ? 'bg-red-600 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Download size={16} />
            <span>Downloads</span>
          </button>
          <button
            onClick={() => setTab('system')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'system' ? 'bg-red-600 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Activity size={16} />
            <span>System &amp; Profiles</span>
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-red-300 mb-6">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="text-neutral-400 flex gap-2 mb-6">
          <Loader2 size={18} className="animate-spin" />
          Loading server configuration…
        </p>
      )}

      {tab === 'modules' && data && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(['all', 'configured', 'disconnected'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setModuleFilter(filter)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition border ${
                    moduleFilter === filter
                      ? 'bg-white text-black border-white'
                      : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <p className="text-xs text-neutral-400">
              {configuredCount} of {integrations.length} modules connected
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {filteredIntegrations.map((i) => (
              <IntegrationCard
                key={i.id}
                integration={i}
                downloadsPath={data.downloadsPath}
                booksPath={data.booksPath || '/books'}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'media' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                <Film size={14} className="text-red-400" /> Movies
              </div>
              <p className="text-2xl font-bold">{mediaStats ? mediaStats.moviesCount : '—'}</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                <Tv size={14} className="text-blue-400" /> TV Series
              </div>
              <p className="text-2xl font-bold">{mediaStats ? mediaStats.seriesCount : '—'}</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                <Music2 size={14} className="text-emerald-400" /> Music Ready
              </div>
              <p className="text-2xl font-bold">{mediaStats ? mediaStats.musicReady : '—'}</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                <Download size={14} className="text-amber-400" /> Music Queue
              </div>
              <p className="text-2xl font-bold">
                {mediaStats ? `${mediaStats.musicActive} (${mediaStats.musicFailed} failed)` : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                <BookOpen size={14} className="text-purple-400" /> Books
              </div>
              <p className="text-2xl font-bold">{mediaStats ? mediaStats.booksCount : '—'}</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                <HardDrive size={14} className="text-neutral-300" /> Requested
              </div>
              <p className="text-2xl font-bold">{mediaStats ? mediaStats.requestedCount : '—'}</p>
            </div>
          </div>

          <NativeLibraryManager />
        </div>
      )}

      {tab === 'downloads' && (
        <AdminDownloadManager embedded onOpenAdminSettings={() => setTab('modules')} />
      )}

      {tab === 'system' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">System Status &amp; Profiles</h2>
            <button
              onClick={() => void loadSystemOverview()}
              disabled={refreshingSystem}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-neutral-700 text-xs font-semibold hover:bg-neutral-800 transition"
            >
              <RefreshCw size={14} className={refreshingSystem ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <HardDrive size={16} className="text-red-400" /> Storage Paths &amp; Integrations
              </h3>
              <div className="text-sm space-y-2 text-neutral-300">
                <p>
                  <span className="text-neutral-500">Downloads Path:</span>{' '}
                  <code className="text-xs bg-black/50 px-2 py-0.5 rounded">{data?.downloadsPath || 'Not set'}</code>
                </p>
                <p>
                  <span className="text-neutral-500">Books Path:</span>{' '}
                  <code className="text-xs bg-black/50 px-2 py-0.5 rounded">{data?.booksPath || '/books'}</code>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {data?.integrations.map(({ id, name, configured }) => (
                  <span
                    key={id}
                    className={`px-2.5 py-1 rounded-full text-xs border ${
                      configured
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-neutral-800 text-neutral-500 border-neutral-700'
                    }`}
                  >
                    {name}: {configured ? 'configured' : 'not configured'}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Users size={16} className="text-blue-400" /> Accounts ({accounts.length}) &amp; Profiles ({profiles.length})
              </h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await submitAccountAction({
                    action: 'create',
                    username: newAcctUser,
                    password: newAcctPass,
                    isAdmin: newAcctAdmin,
                  });
                  if (ok) {
                    setNewAcctUser('');
                    setNewAcctPass('');
                    setNewAcctAdmin(false);
                    setAcctMsg('Account created (user will create their first profile on login).');
                  }
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  required
                  value={newAcctUser}
                  onChange={(e) => setNewAcctUser(e.target.value)}
                  placeholder="New username"
                  className="flex-1 min-w-[120px] rounded-lg border border-neutral-700 bg-black/40 px-3 py-1.5 text-xs text-white"
                />
                <input
                  required
                  type="password"
                  minLength={4}
                  value={newAcctPass}
                  onChange={(e) => setNewAcctPass(e.target.value)}
                  placeholder="Password (min 4)"
                  className="flex-1 min-w-[120px] rounded-lg border border-neutral-700 bg-black/40 px-3 py-1.5 text-xs text-white"
                />
                <label className="flex items-center gap-1.5 text-xs text-neutral-300">
                  <input type="checkbox" checked={newAcctAdmin} onChange={(e) => setNewAcctAdmin(e.target.checked)} />
                  Admin
                </label>
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold">
                  + Add Account
                </button>
              </form>
              {acctMsg && <p className="text-xs text-neutral-300">{acctMsg}</p>}
              <div className="space-y-2">
                {accounts.map((a) => {
                  const acctProfiles = profiles.filter((p) => p.accountId === a.id);
                  return (
                    <div
                      key={a.id}
                      className="px-3 py-2.5 rounded-lg bg-black/30 border border-neutral-800/80 text-sm space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{a.displayName}</span>
                          <span className="text-xs text-neutral-500">@{a.username}</span>
                          {a.isAdmin && <span className="px-2 py-0.5 rounded text-[11px] bg-red-500/20 text-red-300">Admin</span>}
                          <span className="px-2 py-0.5 rounded text-[11px] bg-neutral-800 text-neutral-300">
                            {acctProfiles.length} {acctProfiles.length === 1 ? 'profile' : 'profiles'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              const pw = window.prompt(`New password for ${a.username} (min 4 chars):`);
                              if (pw && pw.length >= 4) void submitAccountAction({ action: 'set-password', accountId: a.id, password: pw });
                            }}
                            className="px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-800"
                          >
                            Set Password
                          </button>
                          <button
                            type="button"
                            onClick={() => void submitAccountAction({ action: 'set-admin', accountId: a.id, isAdmin: !a.isAdmin })}
                            className="px-2 py-1 rounded border border-neutral-700 hover:bg-neutral-800"
                          >
                            {a.isAdmin ? 'Demote' : 'Make Admin'}
                          </button>
                          {accounts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => void submitAccountAction({ action: 'delete', accountId: a.id })}
                              className="px-2 py-1 rounded border border-red-800/60 text-red-300 hover:bg-red-950/40"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      {acctProfiles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {acctProfiles.map((p) => (
                            <span key={p.id} className="px-2 py-0.5 rounded-full text-[11px] bg-neutral-800/80 text-neutral-300">
                              {p.name}{p.isKids ? ' (Kids)' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 space-y-3">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Activity size={16} className="text-emerald-400" /> Active Playback Sessions ({sessions.length})
            </h3>
            {sessions.length === 0 ? (
              <p className="text-sm text-neutral-500">No active playback sessions.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sessions.map((s) => (
                  <div key={s.deviceId} className="p-3 rounded-lg bg-black/30 border border-neutral-800 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate">{s.deviceName}</span>
                      <span className="text-xs text-neutral-400">{s.platform}</span>
                    </div>
                    <p className="text-xs text-neutral-400 truncate">
                      {s.title ? `${s.title} (${s.state || 'playing'})` : s.state || 'idle'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
