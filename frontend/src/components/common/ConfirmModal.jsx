import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ 
  isOpen, 
  title = "Confirm Action", 
  message = "Are you sure you want to proceed? This action cannot be undone.", 
  confirmText = "Delete", 
  cancelText = "Cancel", 
  onConfirm, 
  onCancel,
  onClose,
  error = null,
  confirmDisabled = false,
  disabled = false,
  children = null
}) {
  const isConfirmDisabled = confirmDisabled || disabled;

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

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (onCancel) onCancel();
    if (onClose) onClose();
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={handleDismiss}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-md p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-150 relative max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start space-x-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">{title}</h3>
            <p className="text-xs font-semibold text-slate-500 mt-1.5 leading-relaxed">{message}</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {children}

        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isConfirmDisabled}
            onClick={onConfirm}
            className={`px-5 py-2.5 text-xs font-black text-white rounded-xl transition-all ${
              isConfirmDisabled
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                : 'bg-rose-600 hover:bg-rose-700 shadow-md transition-transform active:scale-95 cursor-pointer'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
}
