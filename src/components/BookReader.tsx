'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { apiFetch } from '@/api/client';
import type { BookItem, BookProgress } from '@/types';
import {
  X,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';

interface BookReaderProps {
  book: BookItem;
  initialProgress?: BookProgress | null;
  profileId?: string;
  onClose: () => void;
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
  const [percent, setPercent] = useState<number>(initialProgress?.percent || 0);
  const [locationLabel, setLocationLabel] = useState<string>('');
  const pageRef = useRef<HTMLDivElement | null>(null);
  const turnRef = useRef<Animation | null>(null);
  const [wide, setWide] = useState(false);
  const [pdfArea, setPdfArea] = useState({ width: 0, height: 0 });
  const pdfAreaRef = useRef<HTMLDivElement>(null);
  const pagesPerTurn = wide ? 2 : 1;
  const [hoverTop, setHoverTop] = useState(false);

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

  // Touch / swipe tracking
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => {
      media.removeEventListener('change', update);
      turnRef.current?.cancel();
      turnRef.current = null;
    };
  }, []);

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

  const turnPage = useCallback(async (forward: boolean) => {
    const page = pageRef.current;
    if (!page || turnRef.current || loading || error) return;

    const nextPdfPage = forward ? pdfPage + pagesPerTurn : Math.max(1, pdfPage - pagesPerTurn);
    if (format === 'pdf' && (nextPdfPage === pdfPage || nextPdfPage > pdfTotal)) return;

    const rendition = renditionRef.current;
    if (format === 'epub') {
      const location = rendition?.location;
      if (!location || (forward ? location.atEnd : location.atStart)) return;
    }
    const advance = async () => {
      if (format === 'pdf') setPdfPage(nextPdfPage);
      else if (format === 'epub') await (forward ? rendition.next() : rendition.prev());
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !page.animate) {
      try {
        await advance();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to turn the page');
      }
      return;
    }

    const outgoing = forward ? -88 : 88;
    const flat = 'perspective(2000px) rotateY(0deg)';
    const animate = (from: string, to: string, transformOrigin: string, duration: number, easing: string) =>
      page.animate([{ transform: from, transformOrigin }, { transform: to, transformOrigin }], {
        duration, easing, fill: 'both',
      });

    let animation = animate(flat, `perspective(2000px) rotateY(${outgoing}deg)`, forward ? 'left' : 'right', 200, 'ease-in');
    turnRef.current = animation;
    try {
      await animation.finished;
      await advance();
      if (turnRef.current !== animation) return;
      animation.cancel();
      animation = animate(`perspective(2000px) rotateY(${-outgoing}deg)`, flat, forward ? 'right' : 'left', 240, 'ease-out');
      turnRef.current = animation;
      await animation.finished;
    } catch (err) {
      if (turnRef.current === animation) {
        setError(err instanceof Error ? err.message : 'Unable to turn the page');
      }
    } finally {
      if (turnRef.current === animation) {
        animation.cancel();
        turnRef.current = null;
      }
    }
  }, [format, pdfPage, pdfTotal, pagesPerTurn, loading, error]);

  const goPrev = useCallback(() => { void turnPage(false); }, [turnPage]);
  const goNext = useCallback(() => { void turnPage(true); }, [turnPage]);

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
          spread: 'auto',
          minSpreadWidth: 690,
          flow: 'paginated',
        });
        renditionRef.current = rendition;

        rendition.themes.default({
          body: {
            background: 'transparent !important',
            color: '#231c14 !important',
            'font-family': '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif !important',
            'line-height': '1.78 !important',
            'font-size': '106% !important',
            'text-align': 'justify !important',
            'overflow-wrap': 'anywhere',
          },
          'p': {
            'text-indent': '1.4em !important',
            'margin-top': '0 !important',
            'margin-bottom': '0.45em !important',
          },
          'h1, h2, h3, h4': {
            color: '#1b140e !important',
            'font-family': 'Georgia, serif !important',
            'text-align': 'center !important',
            'letter-spacing': '0.04em !important',
          },
          'img, svg, video': {
            'max-width': '100% !important',
            'max-height': 'calc(100vh - 72px) !important',
            'object-fit': 'contain',
          },
          'a, a:link, a:visited': { color: '#7c2d12 !important', 'text-decoration': 'none !important' },
        });

        const startLoc =
          initialProgress?.location && initialProgress.location.startsWith('epubcfi(')
            ? initialProgress.location
            : undefined;
        await rendition.display(startLoc);

        rendition.on('relocated', (loc: any) => {
          const cfi = loc?.start?.cfi || '';
          const displayed = loc?.start?.displayed;
          if (displayed?.page && displayed?.total) {
            setLocationLabel(`${displayed.page} / ${displayed.total}`);
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
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url
        ).toString();
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

  useEffect(() => {
    const area = pdfAreaRef.current;
    if (!area || loading || error) return;
    const observer = new ResizeObserver(([entry]) => {
      setPdfArea({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, [format, loading, error]);

  // Fit the PDF page or spread inside the available paper area.
  useEffect(() => {
    if (format !== 'pdf' || !pdfDocRef.current || loading || pdfArea.width <= 24 || pdfArea.height <= 0) return;
    let cancelled = false;
    const doc = pdfDocRef.current;

    const renderPage = async (pageNum: number, canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      if (pageNum < 1 || pageNum > doc.numPages) {
        canvas.width = 0;
        canvas.height = 0;
        return;
      }
      const page = await doc.getPage(pageNum);
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const maxHeight = pdfArea.height;
      const maxWidth = (pdfArea.width - (wide ? 24 : 0)) / pagesPerTurn;
      const scale = Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height);
      const viewport = page.getViewport({ scale });
      const buffer = document.createElement('canvas');
      buffer.width = viewport.width;
      buffer.height = viewport.height;
      const context = buffer.getContext('2d');
      if (!context) return;
      await page.render({ canvas: buffer, canvasContext: context, viewport }).promise;
      if (cancelled) return;
      canvas.width = buffer.width;
      canvas.height = buffer.height;
      canvas.getContext('2d')?.drawImage(buffer, 0, 0);
    };

    void (async () => {
      await Promise.all([
        renderPage(pdfPage, leftCanvasRef.current),
        wide ? renderPage(pdfPage + 1, rightCanvasRef.current) : Promise.resolve(),
      ]);
      if (cancelled) return;
      const pct = pdfTotal > 0 ? Math.min(100, Math.round((Math.min(pdfTotal, pdfPage + pagesPerTurn - 1) / pdfTotal) * 100)) : 0;
      setPercent(pct);
      setLocationLabel(
        wide && pdfPage + 1 <= pdfTotal
          ? `${pdfPage}–${pdfPage + 1} / ${pdfTotal}`
          : `${pdfPage} / ${pdfTotal}`
      );
      persistProgress(String(pdfPage), pct);
    })().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to render PDF');
    });

    return () => {
      cancelled = true;
    };
  }, [format, pdfPage, pdfTotal, loading, persistProgress, pagesPerTurn, wide, pdfArea]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight' || e.key === ' ') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-[radial-gradient(ellipse_at_center,#231a14_0%,#0c0907_100%)] flex items-center justify-center select-none overflow-hidden p-2 sm:p-6 md:p-10"
      onMouseMove={(e) => {
        setHoverTop(e.clientY < 68);
      }}
      onTouchStart={(e) => {
        const touch = e.touches[0];
        touchStartRef.current = e.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
      }}
      onTouchCancel={() => { touchStartRef.current = null; }}
      onTouchEnd={(e) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        const end = e.changedTouches[0];
        if (!start || !end) return;
        const dx = end.clientX - start.x;
        const dy = end.clientY - start.y;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
          e.preventDefault();
          if (dx < 0) goNext();
          else goPrev();
        }
      }}
    >
      {/* Subtle auto-hiding close bookmark in top-right */}
      <button
        onClick={onClose}
        aria-label="Close book"
        title="Close book (Esc)"
        className={`fixed top-0 right-8 z-40 px-3 pt-4 pb-5 rounded-b-md bg-gradient-to-b from-red-800 to-red-950 text-amber-100/90 shadow-xl border-x border-b border-red-700/50 transition-all duration-300 ${
          hoverTop ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-40 hover:opacity-100 hover:translate-y-0'
        }`}
      >
        <X size={16} />
      </button>

      {/* Outer Hardcover Leather Binding */}
      <div
        className="relative w-full max-w-6xl h-full max-h-[880px] rounded-[18px] p-2.5 sm:p-4 bg-gradient-to-b from-[#3b2316] via-[#27160e] to-[#1b0f09] shadow-[0_35px_90px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.12)] border border-[#4e3020]/70 flex items-center justify-center"
      >
        {/* Stacked Paper Edges Effect */}
        <div className="relative w-full h-full rounded-[11px] bg-[#dfd3be] p-[5px] sm:p-[7px] shadow-[inset_0_0_0_1px_#b8a286,inset_0_0_0_3px_#e9ddc7,inset_0_0_0_4px_#c7b598]">
          {/* Open Book Cream Spread */}
          <div ref={pageRef} className="relative w-full h-full rounded-[8px] border border-[#d4c3a8] bg-[#f7f1e3] shadow-[inset_0_0_55px_rgba(120,90,55,0.22)] overflow-hidden flex flex-col justify-between">
            {/* Running Book Header inside Paper Margins */}
            <div className="pointer-events-none z-20 flex items-center justify-between gap-3 shrink-0 px-5 sm:px-12 pt-2.5 text-[11px] tracking-[0.18em] uppercase font-serif text-[#7b6a55]/80">
              <span className="min-w-0 flex-1 break-words line-clamp-2 italic">{book.author}</span>
              <span className="min-w-0 flex-1 break-words line-clamp-2 text-right">{book.title}</span>
            </div>

            {/* Center Book Spine Crease & Shadow */}
            {!loading && !error && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-5 md:left-1/2 md:-translate-x-1/2 md:w-14 z-20 bg-gradient-to-r from-[#493019]/30 to-transparent md:from-transparent md:via-[#493019]/40 md:to-transparent"

              />
            )}

            {/* Invisible Left & Right Page Click Zones for Natural Page Turning */}
            {!loading && !error && (
              <>
                <div
                  onClick={goPrev}
                  title="Previous page"
                  className="absolute inset-y-0 left-0 w-[12%] touch-none z-20 cursor-w-resize"
                />
                <div
                  onClick={goNext}
                  title="Next page"
                  className="absolute inset-y-0 right-0 w-[12%] touch-none z-20 cursor-e-resize"
                />
              </>
            )}

            {/* Main Book Content Area */}
            <div className="relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center px-4 sm:px-7">
              {loading && (
                <div className="flex flex-col items-center gap-3 text-[#6e5c46] font-serif">
                  <Loader2 size={30} className="animate-spin text-[#8c3b2b]" />
                  <span className="text-xs italic tracking-wider">Opening volume…</span>
                </div>
              )}

              {error && (
                <div className="max-w-md rounded-xl border border-[#b98b68] bg-[#efe5d2] p-6 text-center space-y-3 text-[#3a2a1d] font-serif z-30">
                  <AlertCircle size={26} className="text-[#8c2d19] mx-auto" />
                  <p className="text-sm">{error}</p>
                  <a
                    href={fileUrl(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#7c2d12] px-4 py-2 text-xs font-semibold text-amber-50"
                  >
                    <Download size={14} /> Download file
                  </a>
                </div>
              )}

              {format === 'epub' && (
                <div
                  ref={epubContainerRef}
                  className="w-full h-full overflow-hidden"
                />
              )}

              {format === 'pdf' && !loading && !error && (
                <div ref={pdfAreaRef} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center justify-items-center w-full h-full overflow-hidden py-2">
                  <canvas ref={leftCanvasRef} className="rounded-sm shadow-md max-w-full" />
                  <canvas ref={rightCanvasRef} className="rounded-sm shadow-md max-w-full hidden md:block" />
                </div>
              )}
            </div>

            {/* Classic Printed Folio Footer inside Paper Margins */}
            <div className="pointer-events-none z-20 flex items-center justify-between gap-2 shrink-0 px-5 sm:px-12 pb-2.5 text-[11px] font-serif text-[#7b6a55]/85">
              <span>{locationLabel}</span>
              <span className="italic">{Math.round(percent)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
