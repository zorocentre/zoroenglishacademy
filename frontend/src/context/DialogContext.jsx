import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, HelpCircle, X } from 'lucide-react';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    type: 'error', // 'error' | 'success' | 'warning' | 'confirm'
    title: '',
    message: '',
    details: '',
    correlationId: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    danger: false,
    resolve: null
  });

  const dialogStateRef = useRef(dialogState);
  dialogStateRef.current = dialogState;

  const closeDialog = useCallback((result = false) => {
    setDialogState(prev => {
      if (prev.resolve) {
        prev.resolve(result);
      }
      return { ...prev, isOpen: false, resolve: null };
    });
  }, []);

  const openDialog = useCallback(({
    type = 'error',
    title = '',
    message = '',
    details = '',
    correlationId = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    danger = false
  }) => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        type,
        title: title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : type === 'warning' ? 'Notice' : 'Confirm Action'),
        message: typeof message === 'string' ? message : (message?.message || JSON.stringify(message) || 'Operation completed.'),
        details,
        correlationId,
        confirmText,
        cancelText,
        danger,
        resolve
      });
    });
  }, []);

  const showError = useCallback((message, title = 'Error', options = {}) => {
    let cleanTitle = title;
    if (!cleanTitle || cleanTitle === 'Error' || /Request Failed\s*\([A-Z0-9_]+\)/i.test(cleanTitle)) {
      cleanTitle = 'Action Failed';
    }
    let cleanDetails = options.details || '';
    if (/HTTP Status:\s*\d+/i.test(cleanDetails)) {
      cleanDetails = '';
    }

    if (dialogStateRef.current.isOpen && dialogStateRef.current.message === message) {
      return Promise.resolve(false);
    }

    return openDialog({
      type: 'error',
      title: cleanTitle,
      message,
      confirmText: options.confirmText || 'Close',
      details: cleanDetails,
      correlationId: options.correlationId || '',
      ...options
    });
  }, [openDialog]);

  const showSuccess = useCallback((message, title = 'Success', options = {}) => {
    return openDialog({
      type: 'success',
      title,
      message,
      confirmText: options.confirmText || 'Great',
      ...options
    });
  }, [openDialog]);

  const showWarning = useCallback((message, title = 'Notice', options = {}) => {
    return openDialog({
      type: 'warning',
      title,
      message,
      confirmText: options.confirmText || 'Understood',
      ...options
    });
  }, [openDialog]);

  const confirm = useCallback((message, title = 'Please Confirm', options = {}) => {
    if (typeof message === 'object' && message !== null) {
      const opts = message;
      return openDialog({
        type: 'confirm',
        title: opts.title || 'Please Confirm',
        message: opts.message || '',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        danger: opts.danger !== undefined ? opts.danger : false,
        ...opts
      });
    }
    return openDialog({
      type: 'confirm',
      title,
      message,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      danger: options.danger !== undefined ? options.danger : false,
      ...options
    });
  }, [openDialog]);

  // Global listener for api:error dispatched by client.js on non-GET API failures
  useEffect(() => {
    let lastErrorMsg = '';
    let lastErrorTime = 0;

    const handleApiError = (e) => {
      const detail = e?.detail || {};
      const msg = detail.message || 'A network or server error occurred.';
      const now = Date.now();
      // Deduplicate identical error messages within 2 seconds or if dialog with same message is already open
      if ((now - lastErrorTime < 2000 && lastErrorMsg === msg) || (dialogStateRef.current.isOpen && dialogStateRef.current.message === msg)) {
        return;
      }
      lastErrorMsg = msg;
      lastErrorTime = now;

      showError(msg, 'Action Failed', {
        correlationId: detail.correlationId || '',
        details: '' // Do not expose "HTTP Status: 409" or raw error codes
      });
    };

    window.addEventListener('api:error', handleApiError);
    return () => {
      window.removeEventListener('api:error', handleApiError);
    };
  }, [showError]);

  // Lock body scroll while dialog is open (Task 3)
  useEffect(() => {
    if (dialogState.isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [dialogState.isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && dialogStateRef.current.isOpen) {
        closeDialog(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDialog]);

  const renderIcon = () => {
    switch (dialogState.type) {
      case 'success':
        return (
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
          </div>
        );
      case 'confirm':
        return (
          <div className={`w-12 h-12 rounded-2xl ${dialogState.danger ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-[#0F52BA] border border-blue-100'} flex items-center justify-center shrink-0`}>
            {dialogState.danger ? <AlertCircle className="w-6 h-6 stroke-[2.5]" /> : <HelpCircle className="w-6 h-6 stroke-[2.5]" />}
          </div>
        );
      case 'error':
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 stroke-[2.5]" />
          </div>
        );
    }
  };

  const dialogElement = dialogState.isOpen && (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 modal-backdrop-transition"
      onClick={() => closeDialog(false)}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative space-y-4 modal-content-transition"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={() => closeDialog(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Icon and Title */}
        <div className="flex items-start space-x-3.5 pt-1">
          {renderIcon()}
          <div className="space-y-1 pr-6">
            <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">
              {dialogState.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-line">
              {dialogState.message}
            </p>
          </div>
        </div>

        {/* Optional Correlation / Reference ID */}
        {dialogState.correlationId && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-[11px] text-slate-500 font-mono">
            <span className="font-bold text-slate-700">Support Ref:</span> {dialogState.correlationId}
          </div>
        )}

        {/* Optional Details */}
        {dialogState.details && (
          <div className="text-[11px] text-slate-400 font-medium">
            {dialogState.details}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end space-x-3">
          {dialogState.type === 'confirm' ? (
            <>
              <button
                type="button"
                onClick={() => closeDialog(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                {dialogState.cancelText}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => closeDialog(true)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md transition-colors cursor-pointer ${
                  dialogState.danger
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                    : 'bg-[#0F52BA] hover:bg-blue-700 shadow-blue-200'
                }`}
              >
                {dialogState.confirmText}
              </button>
            </>
          ) : (
            <button
              type="button"
              autoFocus
              onClick={() => closeDialog(true)}
              className={`px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-md transition-colors cursor-pointer ${
                dialogState.type === 'error'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                  : dialogState.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
              }`}
            >
              {dialogState.confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <DialogContext.Provider value={{ showError, showSuccess, showWarning, confirm }}>
      {children}
      {typeof document !== 'undefined' && dialogElement ? ReactDOM.createPortal(dialogElement, document.body) : dialogElement}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
