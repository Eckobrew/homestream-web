'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '@/api/client';
import type { MusicAlbum, MusicTrack, MusicResponse, MusicAlbumResponse, Playlist, PlaylistTrack, PlaylistDetailResponse } from '@/types';
import { useProfile } from '@/context/ProfileContext';
import {
  Music2,
  Play,
  Download,
  Loader2,
  X,
  Search,
  Check,
  Plus,
  Trash2,
  ArrowLeft,
  Clock,
  Sparkles,
  Shuffle,
  RefreshCw,
} from 'lucide-react';

interface MusicBrowserProps {
  onPlay: (tracks: MusicTrack[], index: number) => void;
  onAdmin?: () => void;
  activeProfileId?: string;
  onBackToHome?: () => void;
}

export function MusicBrowser({
  onPlay,
  onAdmin,
  activeProfileId,
  onBackToHome,
}: MusicBrowserProps) {
  const { activeProfile } = useProfile();
  const currentProfileId = activeProfileId || activeProfile?.id;
  const kids = Boolean(activeProfile?.isKids);

  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [albums, setAlbums] = useState<MusicAlbum[]>([]);
  const [selected, setSelected] = useState<MusicAlbumResponse | null>(null);
  const [category, setCategory] = useState<'albums' | 'playlists'>('albums');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDetailResponse | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrls, setImportUrls] = useState('');
  const [importing, setImporting] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [reload, setReload] = useState(0);

  // Greeting based on current time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  useEffect(() => {
    if (kids) {
      setAlbums([]);
      return;
    }
    const c = new AbortController();
    setLoading(true);
    setError('');

    const params = new URLSearchParams({
      offset: String(offset),
    });
    if (q.trim()) params.set('q', q.trim());
    if (currentProfileId) params.set('userId', currentProfileId);

    const timer = setTimeout(
      () => {
        apiFetch(`/api/music?${params.toString()}`, { signal: c.signal })
          .then(async (r) => {
            if (!r.ok) {
              const data = await r.json().catch(() => ({}));
              throw new Error(data.error || 'Music is unavailable');
            }
            return r.json() as Promise<MusicResponse>;
          })
          .then((d) => {
            setAlbums((previous) =>
              offset ? Array.from(new Map([...previous, ...d.albums].map((a) => [a.id, a])).values()) : d.albums
            );
            setTotal(d.total);
            setConfigured(d.configured);
          })
          .catch((e) => {
            if (!c.signal.aborted) setError(e.message);
          })
          .finally(() => {
            if (!c.signal.aborted) setLoading(false);
          });
      },
      q ? 350 : 0
    );

    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [q, reload, kids, offset, currentProfileId]);

  useEffect(() => {
    setSelected(null);
    setSelectedPlaylist(null);
    setNotice('');
  }, [currentProfileId]);

  const fetchPlaylists = useCallback(async () => {
    if (kids) return;
    try {
      const params = new URLSearchParams();
      if (currentProfileId) params.set('userId', currentProfileId);
      const r = await apiFetch(`/api/music/playlists?${params.toString()}`);
      if (!r.ok) return;
      const data = await r.json();
      setPlaylists(data.playlists || []);
    } catch {}
  }, [kids, currentProfileId]);

  useEffect(() => {
    if (category === 'playlists') {
      fetchPlaylists();
    }
  }, [category, fetchPlaylists, reload]);

  async function openPlaylist(playlistId: string) {
    setBusy(playlistId);
    setError('');
    try {
      const params = new URLSearchParams({ playlistId });
      if (currentProfileId) params.set('userId', currentProfileId);
      const r = await apiFetch(`/api/music/playlist?${params.toString()}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Playlist unavailable');
      setSelectedPlaylist(d);
    } catch (e: any) {
      setError(e.message || 'Playlist unavailable');
    } finally {
      setBusy('');
    }
  }

  async function handleDeletePlaylist(playlistId: string) {
    if (!confirm('Are you sure you want to delete this playlist? Downloaded music tracks will remain in your library.')) return;
    setBusy(playlistId);
    setError('');
    try {
      const params = new URLSearchParams({ playlistId });
      if (currentProfileId) params.set('userId', currentProfileId);
      const r = await apiFetch(`/api/music/playlist?${params.toString()}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete playlist');
      setNotice('Playlist deleted');
      setTimeout(() => setNotice(''), 3000);
      setSelectedPlaylist(null);
      fetchPlaylists();
    } catch (e: any) {
      setError(e.message || 'Failed to delete playlist');
    } finally {
      setBusy('');
    }
  }

  async function handleImportSpotify(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!importUrls.trim()) return;
    setImporting(true);
    setError('');
    try {
      const params = currentProfileId ? `?userId=${encodeURIComponent(currentProfileId)}` : '';
      const r = await apiFetch(`/api/music/playlists/import${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: importUrls.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Import failed');
      setNotice(d.message || 'Spotify playlists queued for download!');
      setTimeout(() => setNotice(''), 5000);
      setShowImportModal(false);
      setImportUrls('');
      setCategory('playlists');
      fetchPlaylists();
    } catch (e: any) {
      setError(e.message || 'Failed importing Spotify playlists');
    } finally {
      setImporting(false);
    }
  }

  function playPlaylistTracks(tracks: PlaylistTrack[], startIndex = 0) {
    const readyTracks = tracks.filter((t) => t.status === 'completed' && t.streamUrl);
    if (!readyTracks.length) {
      setNotice('No downloaded tracks ready to play yet (slskd is searching/downloading in background)');
      setTimeout(() => setNotice(''), 4000);
      return;
    }
    const targetTrack = tracks[startIndex];
    const readyIdx = targetTrack && targetTrack.status === 'completed'
      ? Math.max(0, readyTracks.findIndex((t) => t.id === targetTrack.id))
      : 0;

    const playable: MusicTrack[] = readyTracks.map((t) => ({
      id: t.trackId || t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      trackNumber: t.position + 1,
      discNumber: 1,
      durationSeconds: t.durationSeconds,
      streamUrl: t.streamUrl || '',
    }));

    onPlay(playable, readyIdx);
  }

  async function openAlbum(album: MusicAlbum) {
    setBusy(album.id);
    setError('');
    try {
      const params = new URLSearchParams({ albumId: album.id });
      if (currentProfileId) params.set('userId', currentProfileId);
      const r = await apiFetch(`/api/music/album?${params.toString()}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Album unavailable');
      setSelected(d);
    } catch (e: any) {
      setError(e.message || 'Album unavailable');
    } finally {
      setBusy('');
    }
  }

  async function handleAddOrRequest(album: MusicAlbum) {
    setBusy(album.id);
    setError('');
    try {
      const params = currentProfileId ? `?userId=${encodeURIComponent(currentProfileId)}` : '';
      const r = await apiFetch(`/api/music/request${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicbrainzId: album.id,
          albumId: album.id,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'Operation failed');
      setNotice(d.message || 'Album added to your library!');
      setTimeout(() => setNotice(''), 4000);

      // Update local state
      setAlbums((prev) =>
        prev.map((x) =>
          x.id === album.id ? { ...x, inLibrary: true, requested: false, isDownloaded: true } : x
        )
      );
      if (selected?.album.id === album.id) {
        setSelected({
          ...selected,
          album: { ...selected.album, inLibrary: true, requested: false, isDownloaded: true },
        });
      }
      setReload((x) => x + 1);
    } catch (e: any) {
      setError(e.message || 'Failed to add album');
    } finally {
      setBusy('');
    }
  }

  async function handleRemoveFromProfile(album: MusicAlbum) {
    setBusy(album.id);
    setError('');
    try {
      const params = new URLSearchParams({ albumId: album.id });
      if (currentProfileId) params.set('userId', currentProfileId);
      const r = await apiFetch(`/api/music/album?${params.toString()}`, {
        method: 'DELETE',
      });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'Failed to remove album');
      setNotice('Removed from your music library');
      setTimeout(() => setNotice(''), 3000);

      setAlbums((prev) => prev.filter((x) => x.id !== album.id));
      if (selected?.album.id === album.id) {
        setSelected({
          ...selected,
          album: { ...selected.album, inLibrary: false },
        });
      }
      setReload((x) => x + 1);
    } catch (e: any) {
      setError(e.message || 'Failed to remove album');
    } finally {
      setBusy('');
    }
  }

  if (kids) {
    return (
      <section className="px-4 md:px-12 py-12 text-neutral-400">
        Music Hub is unavailable in Kids mode.
      </section>
    );
  }

  // Top 6 albums for Spotify's iconic quick-access grid
  const quickAccessAlbums = albums.slice(0, 6);

  return (
    <div className="bg-[#121212] min-h-screen text-white pb-32">
      {/* Spotify Top Header */}
      <header className="px-4 md:px-12 pt-4 pb-6 bg-gradient-to-b from-emerald-950/40 via-[#121212]/80 to-[#121212]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            {onBackToHome && (
              <button
                onClick={onBackToHome}
                className="p-2 rounded-full bg-black/40 hover:bg-neutral-800 text-neutral-300 hover:text-white transition"
                title="Back to Home"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1DB954] animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#1DB954]">
                  Music Hub
                </span>
                {activeProfile?.name && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-medium">
                    {activeProfile.name}&apos;s Collection
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold mt-1">
                {q ? 'Search Music' : `${greeting}, ${activeProfile?.name || 'Listener'}`}
              </h1>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              aria-label="Search music"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
                setSelected(null);
              }}
              placeholder="What do you want to play?"
              className="w-full bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#2a2a2a] focus:ring-2 focus:ring-[#1DB954] focus:outline-none rounded-full py-2.5 pl-10 pr-10 text-sm text-white placeholder-neutral-400 transition"
            />
            {q && (
              <button
                onClick={() => {
                  setQ('');
                  setOffset(0);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Notice Banner */}
        {notice && (
          <div className="mt-4 p-3 rounded-lg bg-[#1DB954]/20 border border-[#1DB954]/40 text-[#1DB954] flex items-center gap-2 text-sm font-semibold">
            <Check size={18} />
            <span>{notice}</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 flex items-center justify-between text-sm">
            <span>{error}</span>
            <button onClick={() => setReload((x) => x + 1)} className="underline text-white ml-2">
              Retry
            </button>
          </div>
        )}

        {/* Not Configured Alert */}
        {!configured && (
          <div className="mt-4 p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
            <p className="text-sm text-neutral-300">
              Connect slskd in Admin Integrations to discover and stream music.
            </p>
            {onAdmin && (
              <button
                onClick={onAdmin}
                className="px-4 py-1.5 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs transition"
              >
                Connect Integrations
              </button>
            )}
          </div>
        )}

        {/* Quick Access Grid (Spotify 6-Box Hero Grid for larger collections) */}
        {!q && albums.length > 6 && quickAccessAlbums.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
            {quickAccessAlbums.map((album) => (
              <div
                key={album.id}
                onClick={() => openAlbum(album)}
                className="group relative flex items-center bg-[#2a2a2a]/60 hover:bg-[#343434] rounded-md overflow-hidden cursor-pointer transition shadow-md duration-200"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-neutral-800 relative">
                  {album.coverUrl ? (
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      className="w-full h-full object-cover shadow"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music2 size={24} className="text-neutral-500" />
                    </div>
                  )}
                </div>
                <div className="px-3 min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-white truncate">{album.title}</h4>
                  <p className="text-xs text-neutral-400 truncate">{album.artist}</p>
                </div>
                {/* Floating Spotify Green Play Button on Hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openAlbum(album);
                  }}
                  className="mr-3 w-10 h-10 rounded-full bg-[#1DB954] hover:scale-105 hover:bg-[#1ed760] text-black shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                  title="Play"
                >
                  <Play size={18} className="fill-black ml-0.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="px-4 md:px-12 mt-6 space-y-8">
        {/* Category Pills & Spotify Import Action */}
        <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCategory('albums');
                setSelectedPlaylist(null);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                category === 'albums'
                  ? 'bg-white text-black'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700'
              }`}
            >
              Albums
            </button>
            <button
              onClick={() => {
                setCategory('playlists');
                setSelected(null);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                category === 'playlists'
                  ? 'bg-white text-black'
                  : 'bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700'
              }`}
            >
              Playlists
            </button>
          </div>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-1.5 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold flex items-center gap-1.5 transition shadow"
          >
            <Plus size={14} />
            <span>Import Spotify Playlist</span>
          </button>
        </div>

        {/* Selected Album Detail View (Modal / Slide-down) */}
        {category === 'albums' && selected && (
          <section className="rounded-2xl bg-gradient-to-b from-[#282828] to-[#181818] p-6 border border-neutral-800 shadow-2xl relative">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
              title="Close"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end">
              <div className="w-40 h-40 sm:w-52 sm:h-52 flex-shrink-0 bg-neutral-900 rounded-lg overflow-hidden shadow-2xl">
                {selected.album.coverUrl ? (
                  <img
                    src={selected.album.coverUrl}
                    alt={selected.album.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 size={64} className="text-neutral-600" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <span className="text-[11px] uppercase tracking-widest font-bold text-neutral-400">
                  Album
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {selected.album.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-300 font-medium">
                  <span className="font-bold text-white">{selected.album.artist}</span>
                  {selected.album.year && <span>• {selected.album.year}</span>}
                  <span>• {selected.tracks.length} songs</span>
                </div>

                <div className="flex items-center gap-4 pt-3">
                  {selected.tracks.length > 0 && (
                    <button
                      onClick={() => onPlay(selected.tracks, 0)}
                      className="w-14 h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] hover:scale-105 text-black shadow-xl flex items-center justify-center transition"
                      title="Play Album"
                    >
                      <Play size={24} className="fill-black ml-1" />
                    </button>
                  )}

                  {selected.album.inLibrary ? (
                    <button
                      onClick={() => handleRemoveFromProfile(selected.album)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-600 hover:border-red-500 hover:text-red-400 text-neutral-300 text-xs font-bold transition"
                      title="Remove from your profile library"
                    >
                      <Check size={16} className="text-[#1DB954]" />
                      <span>In Library</span>
                    </button>
                  ) : selected.album.isDownloaded ? (
                    <button
                      onClick={() => handleAddOrRequest(selected.album)}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold transition shadow"
                    >
                      <Plus size={16} />
                      <span>Add to Library (Instant)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddOrRequest(selected.album)}
                      disabled={Boolean(busy) || selected.album.requested}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition disabled:opacity-50"
                    >
                      <Download size={16} />
                      <span>{selected.album.requested ? 'Requested' : 'Download Album'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tracklist Table */}
            {selected.tracks.length > 0 ? (
              <div className="mt-8">
                <div className="grid grid-cols-[36px_1fr_60px] px-3 py-2 border-b border-neutral-800 text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  <span>#</span>
                  <span>Title</span>
                  <span className="flex justify-end">
                    <Clock size={14} />
                  </span>
                </div>

                <div className="divide-y divide-neutral-800/40 mt-1">
                  {selected.tracks.map((track, i) => (
                    <button
                      key={track.id}
                      onClick={() => onPlay(selected.tracks, i)}
                      className="group grid grid-cols-[36px_1fr_60px] items-center px-3 py-2.5 rounded-md hover:bg-white/10 cursor-pointer transition w-full text-left"
                    >
                      <span className="text-sm text-neutral-400 group-hover:hidden">
                        {track.trackNumber || i + 1}
                      </span>
                      <span className="hidden group-hover:flex items-center text-white">
                        <Play size={14} className="fill-white" />
                      </span>

                      <div className="min-w-0 pr-4">
                        <p className="text-sm font-semibold text-white group-hover:text-[#1DB954] truncate">
                          {track.title}
                        </p>
                        <p className="text-xs text-neutral-400 truncate">{track.artist}</p>
                      </div>

                      <span className="text-xs text-neutral-400 text-right">
                        {track.durationSeconds
                          ? `${Math.floor(track.durationSeconds / 60)}:${String(
                              Math.floor(track.durationSeconds % 60)
                            ).padStart(2, '0')}`
                          : '--:--'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-8 py-6 text-center text-neutral-400">
                <p>This album has not been downloaded to the server yet.</p>
                <button
                  onClick={() => handleAddOrRequest(selected.album)}
                  className="mt-3 px-5 py-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs transition"
                >
                  Download with slskd
                </button>
              </div>
            )}
          </section>
        )}

        {/* Section: Albums Grid */}
        {category === 'albums' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold tracking-tight">
                {q ? `Search results for "${q}"` : `Your Albums (${total})`}
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24 text-neutral-500 gap-3">
                <Loader2 size={24} className="animate-spin text-[#1DB954]" />
                <span>Loading music...</span>
              </div>
            ) : albums.length === 0 ? (
              <div className="text-center py-20 text-neutral-400 space-y-2">
                <Music2 size={48} className="mx-auto text-neutral-600 mb-3" />
                <p className="text-base font-semibold">
                  {q ? 'No matching albums found.' : 'No music in your personal collection yet.'}
                </p>
                <p className="text-xs text-neutral-500">
                  {q
                    ? 'Try searching by artist or album name.'
                    : 'Search for any artist or album above to add it to your library.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {albums.map((album) => (
                  <article
                    key={album.id}
                    onClick={() => openAlbum(album)}
                    className="group relative p-3 rounded-xl bg-[#181818] hover:bg-[#282828] transition duration-200 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-neutral-900 shadow-lg">
                        {album.coverUrl ? (
                          <img
                            src={album.coverUrl}
                            alt={album.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music2 size={40} className="text-neutral-600" />
                          </div>
                        )}

                        {/* Floating Play Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openAlbum(album);
                          }}
                          className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[#1DB954] hover:scale-105 hover:bg-[#1ed760] text-black shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200"
                          title="Play"
                        >
                          <Play size={18} className="fill-black ml-0.5" />
                        </button>
                      </div>

                      <div className="mt-3">
                        <h4
                          className="font-bold text-sm text-white truncate group-hover:text-[#1DB954] transition"
                          title={album.title}
                        >
                          {album.title}
                        </h4>
                        <p className="text-xs text-neutral-400 truncate mt-0.5">{album.artist}</p>
                        <p className="text-[11px] text-neutral-500 mt-1">
                          {album.year || 'Album'}
                          {album.trackCount ? ` • ${album.trackCount} tracks` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Add / Status Footer Button */}
                    <div className="mt-3 pt-2 border-t border-neutral-800/60">
                      {album.inLibrary ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openAlbum(album);
                          }}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1DB954] hover:underline"
                        >
                          <Play size={12} className="fill-[#1DB954]" />
                          <span>Tracks & playback</span>
                        </button>
                      ) : album.isDownloaded ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddOrRequest(album);
                          }}
                          className="w-full py-1 rounded-md bg-[#1DB954] hover:bg-[#1ed760] text-black text-[11px] font-bold flex items-center justify-center gap-1 transition"
                        >
                          <Plus size={12} />
                          <span>Add (Instant)</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddOrRequest(album);
                          }}
                          disabled={Boolean(busy) || album.requested}
                          className="w-full py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 transition disabled:opacity-50"
                        >
                          <Download size={12} />
                          <span>{album.requested ? 'Requested' : 'Request album'}</span>
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!q && !loading && albums.length < total && (
              <div className="text-center pt-6">
                <button
                  onClick={() => setOffset(albums.length)}
                  className="px-6 py-2.5 rounded-full border border-neutral-700 hover:border-neutral-500 text-sm font-semibold transition"
                >
                  Load more albums ({albums.length} of {total})
                </button>
              </div>
            )}
          </section>
        )}

        {/* Selected Playlist Detail View */}
        {category === 'playlists' && selectedPlaylist && (
          <section className="rounded-2xl bg-gradient-to-b from-[#282828] to-[#181818] p-6 border border-neutral-800 shadow-2xl relative">
            <button
              onClick={() => setSelectedPlaylist(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
              title="Close"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end">
              <div className="w-40 h-40 sm:w-52 sm:h-52 flex-shrink-0 bg-neutral-900 rounded-lg overflow-hidden shadow-2xl">
                {selectedPlaylist.playlist.coverUrl ? (
                  <img
                    src={selectedPlaylist.playlist.coverUrl}
                    alt={selectedPlaylist.playlist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 size={64} className="text-neutral-600" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <span className="text-xs uppercase font-bold tracking-wider text-[#1DB954]">
                  Playlist • Soulseek MP3
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-white">
                  {selectedPlaylist.playlist.name}
                </h2>
                {selectedPlaylist.playlist.description && (
                  <p className="text-sm text-neutral-300 max-w-2xl line-clamp-2">
                    {selectedPlaylist.playlist.description}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1 text-xs text-neutral-400">
                  <span className="font-semibold text-white">
                    {selectedPlaylist.playlist.downloadedTracks} / {selectedPlaylist.playlist.totalTracks} downloaded
                  </span>
                  <span>•</span>
                  <span>Per-profile collection</span>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-neutral-800/80 flex-wrap">
              <button
                onClick={() => playPlaylistTracks(selectedPlaylist.tracks, 0)}
                className="px-6 py-2.5 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-sm flex items-center gap-2 transition shadow-lg hover:scale-105"
              >
                <Play size={18} className="fill-black" />
                <span>Play All</span>
              </button>

              <button
                onClick={() => {
                  const ready = selectedPlaylist.tracks.filter((t) => t.status === 'completed' && t.streamUrl);
                  if (!ready.length) {
                    setNotice('No downloaded tracks ready yet');
                    setTimeout(() => setNotice(''), 3000);
                    return;
                  }
                  const shuffled = [...ready].sort(() => Math.random() - 0.5);
                  playPlaylistTracks(shuffled, 0);
                }}
                className="p-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition"
                title="Shuffle Play"
              >
                <Shuffle size={18} />
              </button>

              <button
                onClick={() => openPlaylist(selectedPlaylist.playlist.id)}
                className="p-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition"
                title="Refresh Status"
              >
                <RefreshCw size={18} className={busy === selectedPlaylist.playlist.id ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={() => handleDeletePlaylist(selectedPlaylist.playlist.id)}
                className="p-2.5 rounded-full bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-400 transition ml-auto"
                title="Delete Playlist"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* Tracklist */}
            <div className="mt-6 space-y-1">
              <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-800">
                <span className="col-span-1">#</span>
                <span className="col-span-6 sm:col-span-7">Title</span>
                <span className="col-span-5 sm:col-span-4 text-right">Status / Duration</span>
              </div>

              {selectedPlaylist.tracks.map((track, idx) => {
                const isReady = track.status === 'completed' && track.streamUrl;
                const durMin = track.durationSeconds ? Math.floor(track.durationSeconds / 60) : 0;
                const durSec = track.durationSeconds ? track.durationSeconds % 60 : 0;
                const durStr = track.durationSeconds ? `${durMin}:${durSec.toString().padStart(2, '0')}` : '';

                return (
                  <div
                    key={track.id}
                    onClick={() => {
                      if (isReady) {
                        playPlaylistTracks(selectedPlaylist.tracks, idx);
                      } else {
                        const msg = track.status === 'downloading'
                          ? 'Track is currently downloading via Soulseek (slskd)...'
                          : track.status === 'searching'
                          ? 'Searching Soulseek network for track...'
                          : track.status === 'failed'
                          ? `Download failed: ${track.errorMessage || 'No Soulseek match'}`
                          : 'Download queued in Soulseek...';
                        setNotice(msg);
                        setTimeout(() => setNotice(''), 4000);
                      }
                    }}
                    className={`grid grid-cols-12 items-center px-4 py-2.5 rounded-md transition group ${
                      isReady
                        ? 'hover:bg-neutral-800/80 cursor-pointer'
                        : 'hover:bg-neutral-900/60 opacity-80 cursor-default'
                    }`}
                  >
                    <div className="col-span-1 text-sm text-neutral-400 group-hover:text-white flex items-center">
                      <span className="group-hover:hidden">{idx + 1}</span>
                      {isReady ? (
                        <Play size={14} className="hidden group-hover:inline text-[#1DB954] fill-[#1DB954]" />
                      ) : (
                        <Download size={14} className="hidden group-hover:inline text-neutral-400" />
                      )}
                    </div>

                    <div className="col-span-6 sm:col-span-7 pr-3 min-w-0">
                      <p className={`text-sm font-medium truncate ${isReady ? 'text-white' : 'text-neutral-300'}`}>
                        {track.title}
                      </p>
                      <p className="text-xs text-neutral-400 truncate">
                        {track.artist} {track.album ? `• ${track.album}` : ''}
                      </p>
                    </div>

                    <div className="col-span-5 sm:col-span-4 text-right flex items-center justify-end gap-2 text-xs">
                      {track.status === 'completed' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-[#1DB954] border border-emerald-800/40 font-semibold text-[11px]">
                          ✓ Ready {durStr ? `• ${durStr}` : ''}
                        </span>
                      ) : track.status === 'downloading' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/40 text-[11px]">
                          Downloading (slskd)
                        </span>
                      ) : track.status === 'searching' ? (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 text-[11px]">
                          Searching Soulseek
                        </span>
                      ) : track.status === 'failed' ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/40 text-[11px]">
                          Failed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-[11px]">
                          Queued
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Playlists Grid */}
        {category === 'playlists' && !selectedPlaylist && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Your Playlists</h3>
                <p className="text-xs text-neutral-400">
                  Imported from Spotify • Automatically downloaded via Soulseek (slskd)
                </p>
              </div>
            </div>

            {playlists.length === 0 ? (
              <div className="p-10 rounded-2xl bg-[#181818] border border-neutral-800 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#1DB954]/10 text-[#1DB954] flex items-center justify-center mx-auto">
                  <Music2 size={32} />
                </div>
                <h4 className="text-lg font-bold text-white">No playlists in your library yet</h4>
                <p className="text-sm text-neutral-400 max-w-md mx-auto">
                  Import public Spotify playlists or a full Spotify user profile. HomeStream downloads all songs via Soulseek as high-quality MP3s directly into your profile.
                </p>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-5 py-2.5 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs transition"
                >
                  Import Spotify Playlist
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {playlists
                  .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
                  .map((playlist) => (
                    <article
                      key={playlist.id}
                      onClick={() => openPlaylist(playlist.id)}
                      className="group relative p-3 rounded-xl bg-[#181818] hover:bg-[#282828] transition duration-200 cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-neutral-900 shadow-lg">
                          {playlist.coverUrl ? (
                            <img
                              src={playlist.coverUrl}
                              alt={playlist.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music2 size={40} className="text-neutral-600" />
                            </div>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPlaylist(playlist.id);
                            }}
                            className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[#1DB954] hover:scale-105 hover:bg-[#1ed760] text-black shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200"
                            title="Open playlist"
                          >
                            <Play size={18} className="fill-black ml-0.5" />
                          </button>
                        </div>

                        <div className="mt-3">
                          <h4
                            className="font-bold text-sm text-white truncate group-hover:text-[#1DB954] transition"
                            title={playlist.name}
                          >
                            {playlist.name}
                          </h4>
                          <p className="text-xs text-neutral-400 truncate mt-0.5">
                            {playlist.description || 'Spotify Playlist'}
                          </p>
                          <p className="text-[11px] text-[#1DB954] font-medium mt-1">
                            {playlist.downloadedTracks} / {playlist.totalTracks} downloaded
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Spotify Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e1e1e] border border-neutral-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#1DB954]" />
                <h3 className="text-lg font-bold text-white">Import Spotify Playlists</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-neutral-300">
              Paste Spotify playlist link(s) or a user profile link (one URL per line). HomeStream will scrape the tracklists and queue MP3 downloads via Soulseek (slskd) directly into your profile&apos;s library.
            </p>

            <form onSubmit={handleImportSpotify} className="space-y-4">
              <textarea
                value={importUrls}
                onChange={(e) => setImportUrls(e.target.value)}
                placeholder="https://open.spotify.com/playlist/...&#10;https://open.spotify.com/user/..."
                rows={5}
                className="w-full bg-[#121212] border border-neutral-700 rounded-xl p-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#1DB954] font-mono text-xs"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing || !importUrls.trim()}
                  className="px-5 py-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
                >
                  {importing && <Loader2 size={14} className="animate-spin" />}
                  <span>{importing ? 'Importing...' : 'Start Import'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
