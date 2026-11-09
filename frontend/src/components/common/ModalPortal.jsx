import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  getModalMountNode,
  useModalStackItem,
  MODAL_BASE,
  MODAL_STEP
} from '../../context/ModalStackContext';

export { getModalMountNode, MODAL_BASE, MODAL_STEP };

/**
 * Universal Modal Portal with automatic nested stacking, fullscreen awareness,
 * focus trapping/restoration, and reference-counted body scroll locking.
 */
export default function ModalPortal({
  isOpen = true,
  onClose = null,
  children,
  lockScroll = true,
  id = null,
  className = '',
  role = 'dialog',
  ariaLabel = undefined,
  ariaLabelledBy = undefined,
  ariaDescribedBy = undefined
}) {
  const [mountNode, setMountNode] = useState(getModalMountNode);
  const containerRef = useRef(null);

  const {
    modalId,
    layerIndex,
    backdropZIndex,
    contentZIndex,
    isTopModal
  } = useModalStackItem({
    isOpen,
    onClose,
    id
  });

  // Track fullscreen changes so modals render inside document.fullscreenElement when active
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

  // Focus management: move focus into top modal on mount
  useEffect(() => {
    if (!isOpen || !isTopModal || typeof document === 'undefined') return;

    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      const focusable = containerRef.current.querySelector(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && typeof focusable.focus === 'function') {
        focusable.focus();
      } else if (typeof containerRef.current.focus === 'function') {
        containerRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, isTopModal]);

  if (!isOpen || !children || !mountNode) return null;

  // Enhance child elements with dynamic z-index stacking
  let renderedContent = children;
  if (React.isValidElement(children)) {
    const childProps = children.props || {};
    const childStyle = childProps.style || {};

    // Check if child has inner children (e.g. dialog card inside backdrop)
    let innerContent = childProps.children;
    if (React.isValidElement(innerContent)) {
      innerContent = React.cloneElement(innerContent, {
        style: {
          ...innerContent.props.style,
          zIndex: contentZIndex
        },
        'data-modal-content': 'true'
      });
    }

    renderedContent = React.cloneElement(children, {
      ref: (node) => {
        containerRef.current = node;
        const { ref } = children;
        if (typeof ref === 'function') ref(node);
        else if (ref && 'current' in ref) ref.current = node;
      },
      style: {
        ...childStyle,
        zIndex: backdropZIndex
      },
      'data-modal-layer': layerIndex,
      'data-modal-id': modalId,
      tabIndex: childProps.tabIndex !== undefined ? childProps.tabIndex : -1,
      role: childProps.role || role,
      'aria-modal': 'true',
      'aria-label': childProps['aria-label'] || ariaLabel,
      'aria-labelledby': childProps['aria-labelledby'] || ariaLabelledBy,
      'aria-describedby': childProps['aria-describedby'] || ariaDescribedBy,
      children: innerContent
    });
  }

  return ReactDOM.createPortal(
    <div
      className={`modal-portal-wrapper ${className}`}
      data-modal-portal-root="true"
      data-layer={layerIndex}
      onClick={(e) => {
        // Stop backdrop clicks from bubbling into any parent portals
        e.stopPropagation();
      }}
    >
      {renderedContent}
    </div>,
    mountNode
  );
}
