import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

/**
 * Returns the currently active mount container for modals.
 * When the browser is in fullscreen mode (such as during proctored exams),
 * elements appended directly to document.body are occluded underneath the
 * fullscreen element. ModalPortal dynamically targets document.fullscreenElement
 * whenever fullscreen is active, falling back to document.body.
 */
export function getModalMountNode() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement ||
         document.webkitFullscreenElement ||
         document.mozFullScreenElement ||
         document.msFullscreenElement ||
         document.body;
}

export default function ModalPortal({
  isOpen = true,
  children,
  lockScroll = true,
  className = ''
}) {
  const [mountNode, setMountNode] = useState(getModalMountNode);

  useEffect(() => {
    const updateMountNode = () => {
      setMountNode(getModalMountNode());
    };

    updateMountNode();

    document.addEventListener('fullscreenchange', updateMountNode);
    document.addEventListener('webkitfullscreenchange', updateMountNode);
    document.addEventListener('mozfullscreenchange', updateMountNode);
    document.addEventListener('MSFullscreenChange', updateMountNode);

    return () => {
      document.removeEventListener('fullscreenchange', updateMountNode);
      document.removeEventListener('webkitfullscreenchange', updateMountNode);
      document.removeEventListener('mozfullscreenchange', updateMountNode);
      document.removeEventListener('MSFullscreenChange', updateMountNode);
    };
  }, []);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen || !lockScroll || typeof document === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, lockScroll]);

  if (!isOpen || !children || !mountNode) return null;

  return ReactDOM.createPortal(
    <div className={`modal-portal-wrapper ${className}`}>
      {children}
    </div>,
    mountNode
  );
}
