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
  className = '',
  children,
  ...props
}) {
  const baseClass = styles.button;
  const variantClass = styles[variant] || styles.primary;
  const sizeClass = styles[size] || styles.md;
  
  const combinedClassName = `${baseClass} ${variantClass} ${sizeClass} ${className}`.trim();

  return (
    <button
      type={type}
      className={combinedClassName}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <div className={styles.spinner} />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className={styles.icon}>{leftIcon}</span>}
          {children}
          {rightIcon && <span className={styles.icon}>{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
