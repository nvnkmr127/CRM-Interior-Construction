import React from 'react';
import styles from './Badge.module.css';

export default function Badge({ children, variant = 'neutral', size = 'md', className = '', ...props }) {
  const badgeClass = `${styles.badge} ${styles[variant]} ${styles[size]} ${className}`.trim();

  return (
    <span className={badgeClass} {...props}>
      {children}
    </span>
  );
}
