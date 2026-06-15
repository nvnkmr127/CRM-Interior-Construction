import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Prevent background scrolling
      document.body.style.overflow = 'hidden';
      
      const handleEscape = (e) => {
        if (e.key === 'Escape') onClose();
      };
      
      // Native basic focus trapping specifically keeping keyboard nav inside the modal boundary
      const handleTabKey = (e) => {
        if (!modalRef.current) return;
        
        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], button, textarea, input[type="text"], input[type="number"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.key === 'Tab') {
          if (e.shiftKey) { // Shift + Tab loops backward
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else { // Tab loops forward
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };

      document.addEventListener('keydown', handleEscape);
      document.addEventListener('keydown', handleTabKey);
      
      // Attempt to immediately focus the modal boundary upon opening
      if (modalRef.current) {
        modalRef.current.focus();
      }

      return () => {
        // Restore background scrolling
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('keydown', handleTabKey);
      };
    }
  }, [isOpen, onClose]);

  // Break component lifecycle if not actively open
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalSizeClass = styles[size] || styles.md;

  // React natively tunnels this HTML payload instantly out of the immediate DOM tree and appends it to `document.body` 
  // overriding complex z-index stacking issues dynamically.
  return createPortal(
    <div className={styles.overlay} onMouseDown={handleBackdropClick}>
      <div 
        className={`${styles.modal} ${modalSizeClass}`} 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="modal-title"
        ref={modalRef}
        tabIndex="-1"
      >
        <div className={styles.header}>
          <h2 id="modal-title" className={styles.title}>{title}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close modal">
            <CloseIcon />
          </button>
        </div>
        
        <div className={styles.body}>
          {children}
        </div>

        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
