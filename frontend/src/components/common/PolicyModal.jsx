import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, ShieldCheck, FileText } from 'lucide-react';

/**
 * Accessible Policy & Terms Modal Dialog
 * Supports title, scrollable body text, Escape key close, overlay click close,
 * close 'X' button, and 'OK' / 'Cancel' action buttons.
 */
export default function PolicyModal({ isOpen, onClose, title, content, type = 'privacy' }) {
  const modalRef = useRef(null);
  const okButtonRef = useRef(null);

  // Lock body scroll while modal is open (Task 3)
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Auto-focus OK button on open
    setTimeout(() => {
      if (okButtonRef.current) {
        okButtonRef.current.focus();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-dialog-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90dvh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden relative"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              {type === 'terms' ? <FileText className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 id="policy-dialog-title" className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {title}
              </h2>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Official Academy Document
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 rounded-full transition border border-slate-200 cursor-pointer shadow-2xs"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto text-xs sm:text-sm leading-relaxed text-slate-600 space-y-4 font-normal">
          <p className="whitespace-pre-line text-justify">
            {content}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 transition cursor-pointer shadow-2xs"
          >
            Cancel
          </button>
          <button
            ref={okButtonRef}
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-xs"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
}
