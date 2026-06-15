import React from 'react';
import styles from './Tag.module.css';

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default function Tag({ label, onRemove, color, className = '' }) {
  const customStyle = color ? { backgroundColor: color, borderColor: 'rgba(0,0,0,0.1)' } : {};

  return (
    <span className={`${styles.tag} ${className}`} style={customStyle}>
      {label}
      {onRemove && (
        <button type="button" className={styles.removeBtn} onClick={onRemove} aria-label={`Remove ${label}`}>
          <XIcon />
        </button>
      )}
    </span>
  );
}
