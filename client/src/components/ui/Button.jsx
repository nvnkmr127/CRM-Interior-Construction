import React from 'react';
import styles from './Button.module.css';

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  onClick,
  type = 'button',
  children,
  ...props
}) {
  const className = [
    styles.btn,
    styles[variant],
    styles[size]
  ].filter(Boolean).join(' ');

  return (
    <button
      className={className}
      onClick={onClick}
      type={type}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className={styles.spinner} />}
      {!loading && leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
