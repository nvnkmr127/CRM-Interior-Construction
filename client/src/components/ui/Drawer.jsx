import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './Drawer.module.css';

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default function Drawer({
  isOpen,
  onClose,
  title,
  width = 480,
  children,
  footer
}) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      const handleEscape = (e) => {
        if (e.key === 'Escape') onClose();
      };
      
      const handleTabKey = (e) => {
        if (!drawerRef.current) return;
        const focusableElements = drawerRef.current.querySelectorAll(
          'a[href], button, textarea, input[type="text"], input[type="number"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.key === 'Tab') {
          if (e.shiftKey) { // shift + tab
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else { // tab
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      };

      document.addEventListener('keydown', handleEscape);
      document.addEventListener('keydown', handleTabKey);
      
      if (drawerRef.current) {
        drawerRef.current.focus();
      }

      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('keydown', handleTabKey);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div className={styles.overlay} onMouseDown={handleBackdropClick}>
      <div 
        className={styles.drawer} 
        style={{ width: `${width}px` }}
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="drawer-title"
        ref={drawerRef}
        tabIndex="-1"
      >
        <div className={styles.header}>
          <h2 id="drawer-title" className={styles.title}>{title}</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close drawer">
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
