import React from 'react';
import styles from './Card.module.css';

export default function Card({
  children,
  padding = 'md',
  shadow = false,
  hover = false,
  onClick,
  header,
  footer,
  className = '',
  ...props
}) {
  const cardClassName = [
    styles.card,
    hover ? styles.hover : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClassName} onClick={onClick} {...props}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles[padding]}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
