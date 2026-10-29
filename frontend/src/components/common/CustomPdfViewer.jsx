import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch (e) {
    console.warn('PDF.js worker initialization warning:', e);
  }
}

export default function CustomPdfViewer({ url, title = 'Document', watermarkText = '', className = '' }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [renderTask, setRenderTask] = useState(null);

  // Keyboard shortcut deterrents (Ctrl+S, Ctrl+P, Ctrl+U, F12)
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
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Load PDF document
  useEffect(() => {
    let active = true;
    if (!url || url === '#') {
      setError('Invalid or missing document URL');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const loadingTask = pdfjsLib.getDocument({
      url,
      withCredentials: true,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
    });

    loadingTask.promise
      .then((loadedDoc) => {
        if (!active) return;
        setPdfDoc(loadedDoc);
        setTotalPages(loadedDoc.numPages);
        setCurrentPage(1);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.warn('Failed to load PDF via PDF.js:', err);
        setError('Could not load PDF document. Please verify your access permissions.');
        setLoading(false);
      });

    return () => {
      active = false;
      try {
        loadingTask.destroy();
      } catch {
        // ignore cleanup error
      }
    };
  }, [url]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || currentPage < 1) return;

    let activeRender = true;

    // Cancel prior render if still running
    if (renderTask) {
      try {
        renderTask.cancel();
      } catch {
        // ignore cancellation
      }
    }

    pdfDoc.getPage(currentPage).then((page) => {
      if (!activeRender || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext ? canvas.getContext('2d') : null;
      if (!ctx) return; // In jsdom or unsupported canvas environments

      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const task = page.render({
        canvasContext: ctx,
        viewport,
      });
      setRenderTask(task);

      task.promise
        .catch((err) => {
          if (err?.name !== 'RenderingCancelledException') {
            console.warn('PDF page rendering error:', err);
          }
        });
    });

    return () => {
      activeRender = false;
    };
  }, [pdfDoc, currentPage, scale]);

  const handlePrevPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  const handleZoomIn = () => {
    setScale((s) => Math.min(2.5, +(s + 0.2).toFixed(1)));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(0.6, +(s - 0.2).toFixed(1)));
  };

  const handleResetZoom = () => {
    setScale(1.2);
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex flex-col h-full w-full bg-slate-900 rounded-2xl overflow-hidden select-none relative ${className}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* Viewer Navigation / Zoom Toolbar */}
      <div className="bg-slate-800/90 border-b border-slate-700/80 px-4 py-2.5 flex items-center justify-between text-slate-200 text-xs shrink-0 select-none">
        {/* Page navigation */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || loading}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold px-2 text-slate-300">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages || loading}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.6 || loading}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-[11px] w-12 text-center text-slate-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 2.5 || loading}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-1"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Canvas View Area */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative bg-slate-950/60">
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

        <div className={`relative shadow-2xl ${loading || error ? 'hidden' : 'block'}`}>
          <canvas
            ref={canvasRef}
            onContextMenu={(e) => e.preventDefault()}
            className="max-w-none rounded-sm bg-white"
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
                  transparent 100px,
                  rgba(100, 116, 139, 0.04) 100px,
                  rgba(100, 116, 139, 0.04) 200px
                )`
              }}
            >
              <div className="transform -rotate-45 text-slate-900/15 font-black text-2xl tracking-widest uppercase select-none pointer-events-none">
                {watermarkText} • View Only
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
