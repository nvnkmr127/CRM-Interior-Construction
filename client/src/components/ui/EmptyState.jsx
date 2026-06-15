import React from 'react';
import Button from './Button';
import styles from './EmptyState.module.css';

export default function EmptyState({ icon, title, description, action, className = '' }) {
  return (
    <div className={`${styles.container} ${className}`}>
      {icon && <div className={styles.iconWrapper}>{icon}</div>}
      {title && <h3 className={styles.title}>{title}</h3>}
      {description && <p className={styles.description}>{description}</p>}
      
      {action && (
        <div className={styles.action}>
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
