import React from 'react';
import styles from './Spinner.module.css';

export default function Spinner({ size = 'md', color = 'var(--color-accent)', className = '' }) {
  const sizeClass = styles[size] || styles.md;
  
  return (
    <div 
      className={`${styles.spinner} ${sizeClass} ${className}`} 
      style={{ color }}
      role="status"
      aria-label="Loading"
    />
  );
}
