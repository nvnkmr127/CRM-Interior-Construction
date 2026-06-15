import React from 'react';
import styles from './Avatar.module.css';

const COLORS = ['#C4956A', '#2D6A4F', '#1A3A5C', '#8B2020', '#4A2040'];

export default function Avatar({ name = '', imageUrl, size = 'md', className = '' }) {
  const sizeClass = styles[size] || styles.md;
  
  if (imageUrl) {
    return (
      <div className={`${styles.avatar} ${sizeClass} ${className}`}>
        <img src={imageUrl} alt={name || 'Avatar'} className={styles.img} />
      </div>
    );
  }

  // Fallback to initials mapping logic
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  // Seed the color purely based on the ascii character of the name for determinism
  const charCode = name.length > 0 ? name.charCodeAt(0) : 0;
  const bgColor = COLORS[charCode % COLORS.length];

  return (
    <div 
      className={`${styles.avatar} ${sizeClass} ${className}`} 
      style={{ backgroundColor: bgColor }}
      title={name}
    >
      {initials}
    </div>
  );
}
