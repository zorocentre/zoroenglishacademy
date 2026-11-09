import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

export const MODAL_BASE = 10000;
export const MODAL_STEP = 10;

/**
 * Global reference-counted body scroll lock.
 * Locks scroll when active modal count > 0, restores previous overflow when 0.
 */
let globalScrollLockCount = 0;
let previousBodyOverflow = '';

export function acquireScrollLock() {
  if (typeof document === 'undefined') return;
  if (globalScrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  globalScrollLockCount++;
}

export function releaseScrollLock() {
  if (typeof document === 'undefined') return;
  globalScrollLockCount = Math.max(0, globalScrollLockCount - 1);
  if (globalScrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

export function getScrollLockCount() {
  return globalScrollLockCount;
}

/**
 * Returns the currently active mount container for modals.
 * Supports fullscreen exams by targeting document.fullscreenElement when active.
 */
export function getModalMountNode() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement ||
         document.webkitFullscreenElement ||
         document.mozFullScreenElement ||
         document.msFullscreenElement ||
         document.body;
}

// Fallback stack for tests or environments where ModalStackProvider is not rendered
let fallbackStack = [];
const fallbackListeners = new Set();
let fallbackKeydownAttached = false;

function ensureFallbackKeydown() {
  if (typeof window === 'undefined' || fallbackKeydownAttached) return;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fallbackStack.length > 0) {
      const topModal = fallbackStack[fallbackStack.length - 1];
      if (topModal && typeof topModal.onClose === 'function') {
        e.preventDefault();
        e.stopPropagation();
        topModal.onClose(e);
      }
    }
  }, true);
  fallbackKeydownAttached = true;
}

function emitFallbackChange() {
  fallbackListeners.forEach(listener => listener([...fallbackStack]));
}

const ModalStackContext = createContext(null);

export function ModalStackProvider({ children }) {
  const [stack, setStack] = useState([]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const registerModal = useCallback((id, meta = {}) => {
    setStack(prev => {
      const filtered = prev.filter(m => m.id !== id);
      return [...filtered, { id, ...meta }];
    });
  }, []);

  const unregisterModal = useCallback((id) => {
    setStack(prev => prev.filter(m => m.id !== id));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        const currentStack = stackRef.current;
        if (currentStack.length > 0) {
          const topModal = currentStack[currentStack.length - 1];
          if (topModal && typeof topModal.onClose === 'function') {
            e.preventDefault();
            e.stopPropagation();
            topModal.onClose(e);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const value = useMemo(() => ({
    stack,
    registerModal,
    unregisterModal
  }), [stack, registerModal, unregisterModal]);

  return (
    <ModalStackContext.Provider value={value}>
      {children}
    </ModalStackContext.Provider>
  );
}

/**
 * Hook to register and manage a modal within the stack.
 * Returns { layerIndex, backdropZIndex, contentZIndex, isTopModal }
 */
export function useModalStackItem({ isOpen = true, onClose = null, id = null } = {}) {
  const context = useContext(ModalStackContext);
  const autoIdRef = useRef(null);
  if (!autoIdRef.current) {
    autoIdRef.current = id || `modal-${Math.random().toString(36).slice(2, 9)}`;
  }
  const modalId = id || autoIdRef.current;
  const openerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const registerModal = context ? context.registerModal : null;
  const unregisterModal = context ? context.unregisterModal : null;

  // Track fallback stack when outside ModalStackProvider
  const [localFallbackStack, setLocalFallbackStack] = useState(fallbackStack);
  useEffect(() => {
    if (context) return;
    ensureFallbackKeydown();
    const listener = (newStack) => setLocalFallbackStack(newStack);
    fallbackListeners.add(listener);
    return () => fallbackListeners.delete(listener);
  }, [context]);

  const activeStack = context ? context.stack : localFallbackStack;

  useEffect(() => {
    if (!isOpen) return;

    if (typeof document !== 'undefined') {
      openerRef.current = document.activeElement;
    }
    acquireScrollLock();

    const meta = {
      onClose: (e) => {
        if (onCloseRef.current) {
          onCloseRef.current(e);
        }
      },
      openerElement: openerRef.current
    };

    if (registerModal) {
      registerModal(modalId, meta);
    } else {
      fallbackStack = [...fallbackStack.filter(m => m.id !== modalId), { id: modalId, ...meta }];
      emitFallbackChange();
    }

    return () => {
      releaseScrollLock();
      if (unregisterModal) {
        unregisterModal(modalId);
      } else {
        fallbackStack = fallbackStack.filter(m => m.id !== modalId);
        emitFallbackChange();
      }

      // Restore focus to opener element
      if (
        openerRef.current &&
        typeof openerRef.current.focus === 'function' &&
        typeof document !== 'undefined' &&
        document.body.contains(openerRef.current)
      ) {
        try {
          openerRef.current.focus();
        } catch (_) {}
      }
    };
  }, [isOpen, modalId, registerModal, unregisterModal]);

  // Compute layer index
  let layerIndex = activeStack.findIndex(m => m.id === modalId);
  if (layerIndex === -1) {
    layerIndex = isOpen ? activeStack.length : 0;
  }

  const isTopModal = activeStack.length > 0 && layerIndex === activeStack.length - 1;
  const backdropZIndex = MODAL_BASE + layerIndex * MODAL_STEP;
  const contentZIndex = backdropZIndex + 1;

  return {
    modalId,
    layerIndex,
    backdropZIndex,
    contentZIndex,
    isTopModal
  };
}
