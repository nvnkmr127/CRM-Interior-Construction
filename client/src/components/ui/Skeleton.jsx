import React from 'react';
import styles from './Skeleton.module.css';

export default function Skeleton({ width, height, variant = 'text', lines = 1, className = '' }) {
  const customStyle = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined
  };

  if (variant === 'text') {
    return (
      <div className={`${styles.textContainer} ${className}`} style={customStyle}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={`${styles.skeleton} ${styles.textLine}`} />
        ))}
      </div>
    );
  }

  const variantClass = variant === 'circle' ? styles.circle : styles.rect;

  return (
    <div 
      className={`${styles.skeleton} ${variantClass} ${className}`} 
      style={customStyle} 
    />
  );
}
