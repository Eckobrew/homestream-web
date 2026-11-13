'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { apiFetch } from '@/api/client';
import type { BookItem, BookProgress } from '@/types';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
  Download,
  Minus,
  Plus,
  List,
  AlertCircle,
} from 'lucide-react';

interface BookReaderProps {
  book: BookItem;
  initialProgress?: BookProgress | null;
  profileId?: string;
  onClose: () => void;
}

interface TocItem {
  id: string;
  label: string;
  href: string;
}

export function BookReader({
  book,
  initialProgress,
  profileId,
  onClose,
}: BookReaderProps) {
  const format = book.formats.includes('epub')
    ? 'epub'
    : book.formats.includes('pdf')
    ? 'pdf'
    : book.formats[0] || 'epub';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fontSize, setFontSize] = useState(105);
  const [percent, setPercent] = useState<number>(initialProgress?.percent || 0);
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [toc, setToc] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(false);

  // EPUB refs
  const epubContainerRef = useRef<HTMLDivElement | null>(null);
  const renditionRef = useRef<any>(null);
  const bookInstanceRef = useRef<any>(null);

  // PDF state & refs
  const pdfDocRef = useRef<any>(null);
  const [pdfPage, setPdfPage] = useState<number>(() => {
    const p = Number(initialProgress?.location);
    return Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1;
  });
  const [pdfTotal, setPdfTotal] = useState<number>(0);
  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const fileUrl = useCallback(
    (dl = false) => {
      const params = new URLSearchParams({
        bookId: book.id,
        format,
        ...(dl ? { download: '1' } : {}),
        ...(profileId ? { userId: profileId } : {}),
      });
      return `/api/v1/books/file?${params.toString()}`;
    },
    [book.id, format, profileId]
  );

  const persistProgress = useCallback(
    (loc: string, pct: number) => {
      const params = profileId ? `?userId=${encodeURIComponent(profileId)}` : '';
      void apiFetch(`/api/books/progress${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: book.id,
          location: loc,
          percent: Math.round(pct * 10) / 10,
        }),
      }).catch(() => undefined);
    },
    [book.id, profileId]
  );

  // EPUB 2-page spread loader
  useEffect(() => {
    if (format !== 'epub') return;
    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const res = await apiFetch(fileUrl(false));
        if (!res.ok) throw new Error(`Could not load book (${res.status})`);
        const buf = await res.arrayBuffer();
        if (cancelled || !epubContainerRef.current) return;

        const mod: any = await import('epubjs');
        const ePub = mod.default || mod;
        const epubBook = ePub(buf);
        bookInstanceRef.current = epubBook;

        epubContainerRef.current.innerHTML = '';
        const rendition = epubBook.renderTo(epubContainerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'always',
          minSpreadWidth: 640,
          flow: 'paginated',
        });
        renditionRef.current = rendition;

        rendition.themes.default({
          body: {
            background: '#161616 !important',
            color: '#ececec !important',
            'font-family': 'Georgia, ui-serif, serif !important',
            'line-height': '1.65 !important',
            padding: '0 24px !important',
          },
          'a, a:link, a:visited': { color: '#f87171 !important' },
        });
        rendition.themes.fontSize(`${fontSize}%`);

        const nav = await epubBook.loaded.navigation;
        if (!cancelled && nav?.toc) {
          setToc(
            nav.toc.map((item: any, idx: number) => ({
              id: String(item.id || idx),
              label: String(item.label || '').trim(),
              href: String(item.href || ''),
            }))
          );
        }

        const startLoc =
          initialProgress?.location && initialProgress.location.startsWith('epubcfi(')
            ? initialProgress.location
            : undefined;
        await rendition.display(startLoc);

        rendition.on('relocated', (loc: any) => {
          const cfi = loc?.start?.cfi || '';
          const displayed = loc?.start?.displayed;
          if (displayed?.page && displayed?.total) {
            setLocationLabel(`Spread ${displayed.page} of ${displayed.total}`);
          }
          let pct = percent;
          if (epubBook.locations?.length?.() > 0 && cfi) {
            pct = Math.max(0, Math.min(100, (epubBook.locations.percentageFromCfi(cfi) || 0) * 100));
            setPercent(pct);
          }
          if (cfi) persistProgress(cfi, pct);
        });

        void epubBook.ready
          .then(() => epubBook.locations.generate(1200))
          .then(() => {
            const cfi = rendition.currentLocation?.()?.start?.cfi;
            if (cfi && !cancelled) {
              const pct = Math.max(0, Math.min(100, (epubBook.locations.percentageFromCfi(cfi) || 0) * 100));
              setPercent(pct);
            }
          })
          .catch(() => undefined);

        if (!cancelled) setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Unable to open EPUB');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        renditionRef.current?.destroy?.();
        bookInstanceRef.current?.destroy?.();
      } catch {
        // ignore cleanup errors
      }
    };
  }, [format, fileUrl]);

  useEffect(() => {
    if (format === 'epub' && renditionRef.current) {
      try {
        renditionRef.current.themes.fontSize(`${fontSize}%`);
      } catch {
        // ignore
      }
    }
  }, [fontSize, format]);

  // PDF 2-page spread loader
  useEffect(() => {
    if (format !== 'pdf') return;
    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const res = await apiFetch(fileUrl(false));
        if (!res.ok) throw new Error(`Could not load PDF (${res.status})`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const pdfjs: any = await import('pdfjs-dist');
        if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '4.10.38'}/pdf.worker.min.mjs`;
        }
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setPdfTotal(doc.numPages || 1);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Unable to render PDF');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        pdfDocRef.current?.destroy?.();
      } catch {
        // ignore
      }
    };
  }, [format, fileUrl]);

  // Render two PDF pages side by side
  useEffect(() => {
    if (format !== 'pdf' || !pdfDocRef.current || loading) return;
    let cancelled = false;
    const doc = pdfDocRef.current;

    const renderPage = async (pageNum: number, canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (pageNum < 1 || pageNum > doc.numPages) {
        canvas.width = 0;
        canvas.height = 0;
        return;
      }
      const page = await doc.getPage(pageNum);
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const maxHeight = Math.max(480, window.innerHeight - 160);
      const maxWidth = Math.max(320, (window.innerWidth - 140) / 2);
      const scale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height) * (fontSize / 100);
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
    };

    void (async () => {
      await Promise.all([
        renderPage(pdfPage, leftCanvasRef.current),
        renderPage(pdfPage + 1, rightCanvasRef.current),
      ]);
      if (cancelled) return;
      const pct = pdfTotal > 0 ? Math.min(100, Math.round((Math.min(pdfTotal, pdfPage + 1) / pdfTotal) * 100)) : 0;
      setPercent(pct);
      setLocationLabel(
        pdfPage + 1 <= pdfTotal
          ? `Pages ${pdfPage}–${pdfPage + 1} of ${pdfTotal}`
          : `Page ${pdfPage} of ${pdfTotal}`
      );
      persistProgress(String(pdfPage), pct);
    })();

    return () => {
      cancelled = true;
    };
  }, [format, pdfPage, pdfTotal, fontSize, loading, persistProgress]);

  const goPrev = useCallback(() => {
    if (format === 'epub') {
      void renditionRef.current?.prev?.();
    } else if (format === 'pdf') {
      setPdfPage((p) => Math.max(1, p - 2));
    }
  }, [format]);

  const goNext = useCallback(() => {
    if (format === 'epub') {
      void renditionRef.current?.next?.();
    } else if (format === 'pdf') {
      setPdfPage((p) => (p + 2 <= pdfTotal ? p + 2 : p));
    }
  }, [format, pdfTotal]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0d0d0d] text-white flex flex-col select-none">
      {/* Top Reader Bar */}
      <header className="h-14 px-4 md:px-6 border-b border-neutral-800/90 bg-[#141414] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
            title="Close reader (Esc)"
          >
            <X size={20} />
          </button>
          <div className="w-7 h-7 rounded-md bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            <BookOpen size={15} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{book.title}</div>
            <div className="text-[11px] text-neutral-400 truncate">
              {book.author} · <span className="uppercase text-red-400 font-semibold">{format}</span> · Two-page spread
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {toc.length > 0 && (
            <button
              onClick={() => setShowToc((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
                showToc
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500'
              }`}
            >
              <List size={14} />
              <span>Contents</span>
            </button>
          )}
          <div className="hidden sm:flex items-center rounded-lg border border-neutral-800 bg-neutral-900/80">
            <button
              onClick={() => setFontSize((s) => Math.max(75, s - 10))}
              className="p-1.5 text-neutral-300 hover:text-white"
              title="Smaller text / zoom out"
            >
              <Minus size={14} />
            </button>
            <span className="px-2 text-xs text-neutral-400 font-mono">{fontSize}%</span>
            <button
              onClick={() => setFontSize((s) => Math.min(160, s + 10))}
              className="p-1.5 text-neutral-300 hover:text-white"
              title="Larger text / zoom in"
            >
              <Plus size={14} />
            </button>
          </div>
          <a
            href={fileUrl(true)}
            className="px-3 py-1.5 rounded-lg border border-neutral-700 hover:border-neutral-500 text-xs font-semibold text-neutral-200 flex items-center gap-1.5"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>
      </header>

      {/* Main Spread Viewport */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-[#121212]">
        {showToc && toc.length > 0 && (
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#181818] border-r border-neutral-800 z-30 overflow-y-auto p-3 space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-2 py-1.5">
              Table of Contents
            </div>
            {toc.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setShowToc(false);
                  void renditionRef.current?.display?.(item.href);
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-neutral-200 hover:bg-red-600/20 hover:text-white truncate"
              >
                {item.label}
              </button>
            ))}
          </aside>
        )}

        <button
          onClick={goPrev}
          aria-label="Previous spread"
          className="z-20 mx-2 p-3 rounded-full bg-neutral-900/80 hover:bg-red-600 text-neutral-200 hover:text-white border border-neutral-700/80 transition shadow-lg"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="relative flex-1 h-full max-w-6xl mx-auto py-4 px-2 flex items-center justify-center">
          {/* Center spine divider for 2-page book feel */}
          {!loading && !error && (
            <div
              aria-hidden="true"
              className="pointer-events-none hidden md:block absolute top-6 bottom-6 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-neutral-700/70 to-transparent z-10"
            />
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 text-neutral-400">
              <Loader2 size={36} className="animate-spin text-red-500" />
              <span className="text-xs uppercase tracking-widest">Opening book…</span>
            </div>
          )}

          {error && (
            <div className="max-w-md rounded-xl border border-red-500/40 bg-red-950/20 p-6 text-center space-y-3">
              <AlertCircle size={28} className="text-red-400 mx-auto" />
              <p className="text-sm text-red-200">{error}</p>
              <a
                href={fileUrl(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white"
              >
                <Download size={14} /> Download file instead
              </a>
            </div>
          )}

          {format === 'epub' && (
            <div
              ref={epubContainerRef}
              className="w-full h-full rounded-xl bg-[#161616] border border-neutral-800/80 shadow-2xl overflow-hidden"
            />
          )}

          {format === 'pdf' && !loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-items-center w-full h-full overflow-auto">
              <canvas ref={leftCanvasRef} className="rounded bg-white shadow-xl max-w-full" />
              <canvas ref={rightCanvasRef} className="rounded bg-white shadow-xl max-w-full hidden md:block" />
            </div>
          )}
        </div>

        <button
          onClick={goNext}
          aria-label="Next spread"
          className="z-20 mx-2 p-3 rounded-full bg-neutral-900/80 hover:bg-red-600 text-neutral-200 hover:text-white border border-neutral-700/80 transition shadow-lg"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Bottom Progress Bar */}
      <footer className="h-10 px-6 border-t border-neutral-800/90 bg-[#141414] flex items-center justify-between text-xs text-neutral-400 shrink-0">
        <span>{locationLabel || 'Use ← / → keys to turn pages'}</span>
        <div className="flex items-center gap-3">
          <div className="w-36 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full bg-red-600 transition-all" style={{ width: `${ Math.min(100, Math.max(0, percent)) }%` }} />
          </div>
          <span className="font-mono text-neutral-300">{Math.round(percent)}%</span>
        </div>
      </footer>
    </div>
  );
}
