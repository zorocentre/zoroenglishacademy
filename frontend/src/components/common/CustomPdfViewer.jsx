import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, 
  Maximize2, AlertCircle, Loader2, FileText, X 
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker with multi-layer hardening
let workerBlobUrl = null;

function setupPdfWorker() {
  if (typeof window === 'undefined' || !pdfjsLib.GlobalWorkerOptions) return;

  // 1. Try native module worker via workerPort
  try {
    if (typeof Worker !== 'undefined') {
      const worker = new Worker(
        new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
        { type: 'module' }
      );
      pdfjsLib.GlobalWorkerOptions.workerPort = worker;
      return;
    }
  } catch (portErr) {
    console.warn('Native module workerPort creation failed, attempting blob worker fallback:', portErr);
  }

  // 2. Fetch worker script and create a blob URL with text/javascript MIME
  if (!workerBlobUrl && pdfjsWorker) {
    try {
      fetch(pdfjsWorker)
        .then((res) => res.text())
        .then((code) => {
          const blob = new Blob([code], { type: 'text/javascript' });
          workerBlobUrl = URL.createObjectURL(blob);
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl;
        })
        .catch((fetchErr) => {
          console.warn('Blob worker fallback failed, falling back to URL workerSrc:', fetchErr);
          pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
        });
      return;
    } catch (e) {
      console.warn('Blob worker setup failed:', e);
    }
  }

  // 3. Fallback to direct workerSrc URL
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch (e) {
    console.warn('PDF.js worker fallback initialization error:', e);
  }
}

setupPdfWorker();

export default function CustomPdfViewer({ 
  url, 
  title = 'Document', 
  fileType = 'PDF',
  watermarkText = '', 
  showTitle = true,
  onClose = null,
  className = '' 
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageInput, setPageInput] = useState('1');
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [renderTask, setRenderTask] = useState(null);

  // Sync page input when page changes
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Keyboard deterrents (Ctrl+S, Ctrl+P, Ctrl+U, F12) & Arrow/PageUp/PageDown navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (
        (isCtrlOrCmd && ['s', 'p', 'u'].includes(e.key.toLowerCase())) ||
        e.key === 'F12' ||
        (isCtrlOrCmd && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Page navigation via keyboard arrows (when not typing in an input)
      if (e.target && e.target.tagName === 'INPUT') return;

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentPage((p) => Math.min(totalPages || 1, p + 1));
      } else if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [totalPages, onClose]);

  // Load PDF document
  useEffect(() => {
    let active = true;
    let loadingTask = null;

    if (!url || url === '#' || url === 'undefined') {
      setError('Invalid or missing document URL');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const loadPdf = async () => {
      try {
        const isSameOriginOrRelative = (!url.startsWith('http://') && !url.startsWith('https://')) ||
          (typeof window !== 'undefined' && url.startsWith(window.location.origin)) ||
          url.startsWith('/api/');

        // 1. Try direct getDocument first
        try {
          loadingTask = pdfjsLib.getDocument({
            url,
            withCredentials: Boolean(isSameOriginOrRelative),
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/standard_fonts/',
          });

          const loadedDoc = await loadingTask.promise;
          if (!active) return;
          setPdfDoc(loadedDoc);
          setTotalPages(loadedDoc.numPages);
          setCurrentPage(1);
          setLoading(false);
          return;
        } catch (directErr) {
          console.warn('Direct PDF.js URL load failed, attempting arrayBuffer fetch fallback:', directErr);
        }

        if (!active) return;

        // 2. Fallback: fetch binary arrayBuffer directly and parse in-memory
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
        const headers = {};
        if (token && isSameOriginOrRelative) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(url, {
          method: 'GET',
          headers,
          credentials: isSameOriginOrRelative ? 'include' : 'same-origin',
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        if (!active) return;

        loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/standard_fonts/',
        });

        const loadedDoc = await loadingTask.promise;
        if (!active) return;
        setPdfDoc(loadedDoc);
        setTotalPages(loadedDoc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load PDF document. Root cause:', err?.message || err, err);
        setError('Could not load PDF document. Please verify your access permissions or try reloading.');
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      active = false;
      try {
        if (loadingTask) loadingTask.destroy();
      } catch {}
    };
  }, [url]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || currentPage < 1) return;

    let activeRender = true;

    if (renderTask) {
      try {
        renderTask.cancel();
      } catch {}
    }

    pdfDoc.getPage(currentPage).then((page) => {
      if (!activeRender || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext ? canvas.getContext('2d') : null;
      if (!ctx) return;

      const viewport = page.getViewport({ scale, rotation });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const task = page.render({
        canvasContext: ctx,
        viewport,
      });
      setRenderTask(task);

      task.promise.catch((err) => {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('PDF page rendering error:', err);
        }
      });
    });

    return () => {
      activeRender = false;
    };
  }, [pdfDoc, currentPage, scale, rotation]);

  const handlePrevPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  const handlePageInputBlur = () => {
    const p = parseInt(pageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handlePageInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handlePageInputBlur();
    }
  };

  const handleZoomIn = () => {
    setScale((s) => Math.min(2.5, +(s + 0.2).toFixed(1)));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)));
  };

  const handleFitToWidth = () => {
    if (!containerRef.current || !pdfDoc) return;
    pdfDoc.getPage(currentPage).then((page) => {
      const unscaledViewport = page.getViewport({ scale: 1, rotation });
      const containerWidth = containerRef.current.clientWidth - 48;
      const newScale = Math.max(0.5, Math.min(2.5, +(containerWidth / unscaledViewport.width).toFixed(2)));
      setScale(newScale);
    });
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex flex-col h-full w-full bg-slate-900 overflow-hidden select-none relative ${className}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* Google Drive-Style Sticky Top Toolbar */}
      <header className="bg-slate-900 border-b border-slate-800 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-slate-200 text-xs shrink-0 select-none z-20">
        
        {/* Left: Document Title & Badge */}
        {showTitle ? (
          <div className="flex items-center space-x-2.5 min-w-0 max-w-[200px] sm:max-w-xs md:max-w-sm">
            <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-slate-100 text-xs sm:text-sm truncate" title={title}>
              {title}
            </span>
            <span className="hidden sm:inline-block bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
              {fileType}
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
              {fileType}
            </span>
          </div>
        )}

        {/* Center: Page Navigation (Prev, Page X/N, Next) with touch-friendly >=44px buttons */}
        <div className="flex items-center space-x-1.5 order-3 sm:order-2 mx-auto sm:mx-0">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || loading}
            className="min-w-[40px] min-h-[40px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-slate-200"
            title="Previous Page (ArrowLeft / PageUp)"
            aria-label="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center space-x-1 px-1.5 font-bold text-slate-300 text-xs">
            <span>Page</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageInputBlur}
              onKeyDown={handlePageInputKeyDown}
              disabled={loading || totalPages <= 1}
              className="w-10 text-center bg-slate-950 border border-slate-700 rounded-lg py-1 text-slate-100 font-bold focus:outline-none focus:border-blue-500 text-xs"
              aria-label="Current page number"
            />
            <span>of {totalPages || 1}</span>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages || loading}
            className="min-w-[40px] min-h-[40px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer text-slate-200"
            title="Next Page (ArrowRight / PageDown)"
            aria-label="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Zoom Controls, Rotate, and Close */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 order-2 sm:order-3">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5 || loading}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Zoom Out (-)"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="font-mono text-xs w-11 text-center text-slate-300 font-bold select-none">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 2.5 || loading}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Zoom In (+)"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleFitToWidth}
            disabled={loading}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Fit to Width"
            aria-label="Fit to Width"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRotate}
            disabled={loading}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Rotate 90° Clockwise"
            aria-label="Rotate 90° Clockwise"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-red-600/80 text-slate-300 hover:text-white transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
              aria-label="Close Viewer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

      </header>

      {/* Main Canvas Scroll View Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center relative bg-slate-950/70">
        {loading && (
          <div className="flex flex-col items-center justify-center text-slate-400 space-y-3 py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs font-semibold">Rendering document securely...</p>
          </div>
        )}

        {error && !loading && (
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 text-rose-300 p-6 rounded-2xl text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        <div className={`relative shadow-2xl transition-transform ${loading || error ? 'hidden' : 'block'}`}>
          <canvas
            ref={canvasRef}
            onContextMenu={(e) => e.preventDefault()}
            className="max-w-none rounded-sm bg-white shadow-2xl"
            draggable={false}
          />

          {/* Dynamic Subtle Watermark Overlay */}
          {watermarkText && (
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center select-none"
              style={{
                background: `repeating-linear-gradient(
                  -45deg,
                  transparent,
                  transparent 120px,
                  rgba(100, 116, 139, 0.05) 120px,
                  rgba(100, 116, 139, 0.05) 240px
                )`
              }}
            >
              <div className="transform -rotate-45 text-slate-900/15 font-black text-2xl sm:text-3xl tracking-widest uppercase select-none pointer-events-none p-4 text-center">
                {watermarkText} • View Only
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
