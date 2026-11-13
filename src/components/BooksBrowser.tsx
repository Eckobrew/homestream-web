'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/api/client';
import type {
  BookItem,
  BookRequestItem,
  BookQueueItem,
  BookProgress,
} from '@/types';
import { useProfile } from '@/context/ProfileContext';
import { BookReader } from './BookReader';
import {
  BookOpen,
  Search,
  Download,
  Plus,
  Check,
  Trash2,
  Loader2,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Bookmark,
  Clock,
  Sliders,
} from 'lucide-react';

interface BooksBrowserProps {
  onAdmin?: () => void;
  activeProfileId?: string;
  onBackToHome?: () => void;
}

export function BooksBrowser({
  onAdmin,
  activeProfileId,
  onBackToHome,
}: BooksBrowserProps) {
  const { activeProfile } = useProfile();
  const currentProfileId = activeProfileId || activeProfile?.id;
  const kids = Boolean(activeProfile?.isKids);

  const [tab, setTab] = useState<'shelf' | 'discover' | 'downloads'>('shelf');
  const [filterQ, setFilterQ] = useState('');
  const [discoverQ, setDiscoverQ] = useState('');
  const [books, setBooks] = useState<BookItem[]>([]);
  const [discoverBooks, setDiscoverBooks] = useState<BookItem[]>([]);
  const [requests, setRequests] = useState<BookRequestItem[]>([]);
  const [queue, setQueue] = useState<BookQueueItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [selected, setSelected] = useState<BookItem | null>(null);
  const [reading, setReading] = useState<{ book: BookItem; progress: BookProgress | null } | null>(null);

  const loadLibrary = useCallback(async () => {
    if (kids) {
      setBooks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterQ.trim()) params.set('q', filterQ.trim());
      if (currentProfileId) params.set('userId', currentProfileId);
      const res = await apiFetch(`/api/books?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load books');
      setConfigured(Boolean(data.configured));
      setBooks(data.books || []);
      setRequests(data.requests || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load bookshelf');
    } finally {
      setLoading(false);
    }
  }, [currentProfileId, filterQ, kids]);

  const loadQueue = useCallback(async () => {
    if (kids) return;
    try {
      const params = currentProfileId ? `?userId=${encodeURIComponent(currentProfileId)}` : '';
      const res = await apiFetch(`/api/books/queue${params}`);
      if (res.ok) {
        const data = await res.json();
        setQueue(data.queue || []);
      }
    } catch {
      // ignore transient poll failures
    }
  }, [currentProfileId, kids]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    void loadQueue();
    const t = setInterval(() => void loadQueue(), 12000);
    return () => clearInterval(t);
  }, [loadQueue]);

  const runDiscoverSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const term = discoverQ.trim();
    if (!term) return;
    setSearching(true);
    setError('');
    try {
      const params = new URLSearchParams({ q: term });
      if (currentProfileId) params.set('userId', currentProfileId);
      const res = await apiFetch(`/api/books/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setDiscoverBooks(data.books || []);
    } catch (err: any) {
      setError(err?.message || 'Book search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleRequest = async (book: BookItem) => {
    setBusyId(book.foreignBookId);
    setNotice('');
    setError('');
    try {
      const params = currentProfileId ? `?userId=${encodeURIComponent(currentProfileId)}` : '';
      const res = await apiFetch(`/api/books/request${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foreignBookId: book.foreignBookId,
          title: book.title,
          author: book.author || 'Unknown Author',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setNotice(data.message || `Requested "${book.title}"`);
      setDiscoverBooks((prev) =>
        prev.map((b) =>
          b.foreignBookId === book.foreignBookId
            ? { ...b, requestStatus: data.status || 'requested' }
            : b
        )
      );
      void loadLibrary();
      void loadQueue();
    } catch (err: any) {
      setError(err?.message || 'Could not request book');
    } finally {
      setBusyId('');
    }
  };

  const toggleShelf = async (book: BookItem) => {
    if (!book.id) return;
    setBusyId(book.id);
    try {
      const params = new URLSearchParams({ bookId: book.id });
      if (currentProfileId) params.set('userId', currentProfileId);
      const res = await apiFetch(`/api/books/profile-book?${params.toString()}`, {
        method: book.onShelf ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: book.onShelf ? undefined : JSON.stringify({ bookId: book.id }),
      });
      if (res.ok) {
        if (book.onShelf) {
          setBooks((prev) => prev.filter((b) => b.id !== book.id));
        }
        setDiscoverBooks((prev) =>
          prev.map((b) => (b.id === book.id ? { ...b, onShelf: !book.onShelf } : b))
        );
        if (selected?.id === book.id) {
          setSelected({ ...selected, onShelf: !book.onShelf });
        }
        void loadLibrary();
      }
    } finally {
      setBusyId('');
    }
  };

  const openReader = async (book: BookItem) => {
    let progress: BookProgress | null = null;
    try {
      const params = new URLSearchParams({ bookId: book.id });
      if (currentProfileId) params.set('userId', currentProfileId);
      const res = await apiFetch(`/api/books/progress?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        progress = data.progress || null;
      }
    } catch {
      // start from beginning
    }
    setReading({ book, progress });
  };

  if (kids) {
    return (
      <div className="px-6 py-24 text-center text-neutral-400">
        Books Hub is unavailable on Kids profiles.
      </div>
    );
  }

  if (reading) {
    return (
      <BookReader
        book={reading.book}
        initialProgress={reading.progress}
        profileId={currentProfileId}
        onClose={() => setReading(null)}
      />
    );
  }

  const shelfBooks = books.filter((b) => b.onShelf);

  return (
    <div className="min-h-screen bg-[#141414] text-white pb-28 px-4 sm:px-8 md:px-12">
      {/* Red HOMESTREAM Hub Header */}
      <div className="rounded-2xl bg-gradient-to-br from-red-950/70 via-[#1a1212] to-[#141414] border border-red-900/40 p-6 md:p-8 mb-8 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onBackToHome && (
              <button
                onClick={onBackToHome}
                className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition"
                title="Back to Home"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-700 flex items-center justify-center shadow-lg shadow-red-950/60">
              <BookOpen size={24} className="text-white" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-red-400 font-bold">
                HomeStream Bookshelf
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Books Hub
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Read EPUB &amp; PDF in a two-page spread, curate your shelf, and request books via Bookshelf &amp; qBittorrent
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void loadLibrary();
                void loadQueue();
              }}
              className="px-3.5 py-2 rounded-xl border border-neutral-800 bg-neutral-900/70 hover:bg-neutral-800 text-xs font-semibold text-neutral-200 flex items-center gap-2 transition"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            {onAdmin && (
              <button
                onClick={onAdmin}
                className="px-3.5 py-2 rounded-xl border border-red-800/60 bg-red-950/40 hover:bg-red-900/50 text-xs font-semibold text-red-200 flex items-center gap-2 transition"
              >
                <Sliders size={14} />
                <span>Bookshelf Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-red-950/60">
          <div className="flex items-center gap-2">
            {[
              { id: 'shelf' as const, label: 'Bookshelf & Library', count: books.length },
              { id: 'discover' as const, label: 'Search & Request (Bookshelf)', count: discoverBooks.length },
              { id: 'downloads' as const, label: 'Downloads & Requests', count: queue.length + requests.length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  tab === t.id
                    ? 'bg-red-600 text-white shadow-lg shadow-red-950/50'
                    : 'bg-neutral-900/70 text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      tab === t.id ? 'bg-red-800 text-white' : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === 'shelf' && (
            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                placeholder="Filter library by title, author, series…"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/50 border border-neutral-800 focus:border-red-500 focus:outline-none text-xs text-white"
              />
            </div>
          )}
        </div>
      </div>

      {!configured && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-6 mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={22} className="text-amber-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-amber-200">
                Bookshelf integration is not configured yet
              </div>
              <div className="text-xs text-amber-300/80">
                Connect your Bookshelf server (http://192.168.1.146:8787) in Admin → Integrations to search, request, and read books.
              </div>
            </div>
          </div>
          {onAdmin && (
            <button
              onClick={onAdmin}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white"
            >
              Configure Bookshelf
            </button>
          )}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 mb-6 text-xs text-emerald-200 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-emerald-300 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 mb-6 text-xs text-red-200 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-300 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: SHELF & LIBRARY */}
      {tab === 'shelf' && (
        <div className="space-y-10">
          {loading ? (
            <div className="py-24 flex flex-col items-center gap-3 text-neutral-400">
              <Loader2 size={32} className="animate-spin text-red-600" />
              <span className="text-xs uppercase tracking-widest">Loading Bookshelf…</span>
            </div>
          ) : books.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-12 text-center space-y-4">
              <BookOpen size={40} className="text-red-500 mx-auto opacity-80" />
              <div className="space-y-1">
                <h2 className="text-lg font-bold">Your bookshelf is empty</h2>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Search for any book or author in the Search &amp; Request tab to grab EPUB/PDF releases via Bookshelf and qBittorrent.
                </p>
              </div>
              <button
                onClick={() => setTab('discover')}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-950/50"
              >
                <Sparkles size={15} />
                <span>Find Books to Request</span>
              </button>
            </div>
          ) : (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Bookmark size={16} className="text-red-500" />
                <h2 className="text-lg font-bold">
                  {activeProfile?.name ? `${activeProfile.name}'s Bookshelf` : 'My Bookshelf'}
                </h2>
                <span className="text-xs text-neutral-500">({books.length})</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {books.map((book) => (
                  <BookCard
                    key={book.id || book.foreignBookId}
                    book={book}
                    busy={busyId === book.id}
                    onRead={() => void openReader(book)}
                    onSelect={() => setSelected(book)}
                    onToggleShelf={() => void toggleShelf(book)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: DISCOVER / READARR-STYLE SEARCH */}
      {tab === 'discover' && (
        <div className="space-y-6">
          <form onSubmit={runDiscoverSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={discoverQ}
                onChange={(e) => setDiscoverQ(e.target.value)}
                placeholder="Search books, authors, ISBN, or series (e.g. Project Hail Mary, Dune, Stephen King)…"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-red-500 focus:outline-none text-sm text-white"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !discoverQ.trim()}
              className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-bold uppercase tracking-wider text-white flex items-center justify-center gap-2 shadow-lg shadow-red-950/50"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span>{searching ? 'Searching…' : 'Search Catalogue'}</span>
            </button>
          </form>

          {searching ? (
            <div className="py-20 flex flex-col items-center gap-3 text-neutral-400">
              <Loader2 size={32} className="animate-spin text-red-600" />
              <span className="text-xs uppercase tracking-widest">Searching Bookshelf metadata…</span>
            </div>
          ) : discoverBooks.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800/60 bg-neutral-900/20 p-12 text-center text-xs text-neutral-400">
              Enter a book title, author, or ISBN above to search the Bookshelf metadata catalogue and grab releases with qBittorrent.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {discoverBooks.map((book) => (
                <BookCard
                  key={book.foreignBookId}
                  book={book}
                  busy={busyId === book.foreignBookId}
                  onRead={book.inLibrary ? () => void openReader(book) : undefined}
                  onRequest={!book.inLibrary ? () => void handleRequest(book) : undefined}
                  onSelect={() => setSelected(book)}
                  onToggleShelf={book.inLibrary ? () => void toggleShelf(book) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DOWNLOADS & REQUESTS */}
      {tab === 'downloads' && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Download size={16} className="text-red-500" />
              <span>Active qBittorrent / Bookshelf Queue</span>
            </h2>
            {queue.length === 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 text-xs text-neutral-400">
                No active book downloads in queue.
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{item.title}</div>
                      <div className="text-xs text-neutral-400">
                        {item.status} {item.timeLeft ? `· ETA ${item.timeLeft}` : ''}
                        {item.error ? ` · ${item.error}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-32 h-2 rounded-full bg-neutral-800 overflow-hidden">
                        <div className="h-full bg-red-600" style={{ width: `${item.progress}%` }} />
                      </div>
                      <span className="text-xs font-mono text-neutral-300 w-10 text-right">
                        {item.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Clock size={16} className="text-red-500" />
              <span>Requested Books</span>
            </h2>
            {requests.length === 0 ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 text-xs text-neutral-400">
                No pending book requests.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {requests.map((r) => (
                  <div
                    key={r.foreignBookId}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{r.title}</div>
                      <div className="text-xs text-neutral-400 truncate">{r.author}</div>
                      {r.error && <div className="text-[11px] text-red-400 mt-1">{r.error}</div>}
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase bg-red-950/60 border border-red-800/50 text-red-300 shrink-0">
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Book Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-w-2xl w-full rounded-2xl border border-neutral-800 bg-[#181818] p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-5">
              {selected.coverUrl ? (
                <img
                  src={selected.coverUrl}
                  alt={selected.title}
                  className="w-28 h-40 object-cover rounded-xl border border-neutral-800 shrink-0 bg-neutral-900"
                />
              ) : (
                <div className="w-28 h-40 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                  <BookOpen size={28} className="text-red-500" />
                </div>
              )}
              <div className="space-y-2 min-w-0 flex-1">
                {selected.series && (
                  <div className="text-xs font-bold uppercase tracking-wider text-red-400">
                    {selected.series}
                  </div>
                )}
                <h3 className="text-xl font-extrabold">{selected.title}</h3>
                <div className="text-sm text-neutral-300">
                  {selected.author}
                  {selected.year ? ` · ${selected.year}` : ''}
                  {selected.pageCount ? ` · ${selected.pageCount} pages` : ''}
                </div>
                {selected.formats.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selected.formats.map((f) => (
                      <span
                        key={f}
                        className="px-2 py-0.5 rounded bg-red-950/60 border border-red-800/50 text-[10px] font-bold uppercase text-red-300"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selected.overview && (
              <p className="text-xs text-neutral-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line">
                {selected.overview.replace(/<[^>]+>/g, '')}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              {selected.inLibrary && selected.readable && (
                <button
                  onClick={() => {
                    const b = selected;
                    setSelected(null);
                    void openReader(b);
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white flex items-center gap-2"
                >
                  <BookOpen size={14} />
                  <span>Read Book (2-Page Spread)</span>
                </button>
              )}
              {selected.inLibrary && (
                <button
                  onClick={() => void toggleShelf(selected)}
                  className="px-4 py-2 rounded-xl border border-neutral-700 hover:border-neutral-500 text-xs font-semibold text-neutral-200 flex items-center gap-1.5"
                >
                  {selected.onShelf ? <Trash2 size={14} /> : <Plus size={14} />}
                  <span>{selected.onShelf ? 'Remove from Shelf' : 'Add to My Shelf'}</span>
                </button>
              )}
              {!selected.inLibrary && (
                <button
                  disabled={Boolean(selected.requestStatus && selected.requestStatus !== 'failed')}
                  onClick={() => void handleRequest(selected)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-2"
                >
                  <Download size={14} />
                  <span>
                    {selected.requestStatus ? `Status: ${selected.requestStatus}` : 'Request Book'}
                  </span>
                </button>
              )}
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BookCard({
  book,
  busy,
  onRead,
  onRequest,
  onSelect,
  onToggleShelf,
}: {
  book: BookItem;
  busy?: boolean;
  onRead?: () => void;
  onRequest?: () => void;
  onSelect: () => void;
  onToggleShelf?: () => void;
}) {
  return (
    <div className="group rounded-xl border border-neutral-800/80 bg-neutral-900/40 hover:border-red-500/50 transition overflow-hidden flex flex-col">
      <div
        onClick={onSelect}
        className="relative aspect-[2/3] w-full bg-neutral-900 overflow-hidden cursor-pointer"
      >
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-red-950/50 to-neutral-950">
            <BookOpen size={28} className="text-red-500 mb-2" />
            <span className="text-xs font-bold text-neutral-200 line-clamp-3">{book.title}</span>
          </div>
        )}
        {book.formats.length > 0 && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-bold uppercase text-red-400 border border-red-500/30">
            {book.formats[0]}
          </span>
        )}
        {book.onShelf && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-red-600 text-[10px] font-bold text-white">
            Shelf
          </span>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between gap-2">
        <div onClick={onSelect} className="cursor-pointer">
          <div className="text-xs font-bold text-white line-clamp-1">{book.title}</div>
          <div className="text-[11px] text-neutral-400 line-clamp-1">
            {book.author || 'Unknown Author'}
            {book.year ? ` · ${book.year}` : ''}
          </div>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          {book.inLibrary && onRead && (
            <button
              onClick={onRead}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-[11px] font-bold text-white flex items-center justify-center gap-1"
            >
              <BookOpen size={12} />
              <span>Read</span>
            </button>
          )}
          {book.inLibrary && onToggleShelf && (
            <button
              onClick={onToggleShelf}
              disabled={busy}
              title={book.onShelf ? 'Remove from shelf' : 'Add to shelf'}
              className="p-1.5 rounded-lg border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white"
            >
              {book.onShelf ? <Check size={13} className="text-red-400" /> : <Plus size={13} />}
            </button>
          )}
          {!book.inLibrary && onRequest && (
            <button
              onClick={onRequest}
              disabled={busy || Boolean(book.requestStatus && book.requestStatus !== 'failed')}
              className="w-full py-1.5 px-2.5 rounded-lg bg-neutral-800 hover:bg-red-600 disabled:opacity-50 text-[11px] font-bold text-neutral-200 hover:text-white flex items-center justify-center gap-1 transition"
            >
              {busy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : book.requestStatus ? (
                <Check size={12} />
              ) : (
                <Download size={12} />
              )}
              <span className="capitalize">{book.requestStatus || 'Request'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
