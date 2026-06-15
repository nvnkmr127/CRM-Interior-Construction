import React from 'react';
import styles from './Input.module.css';

export default function Input({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  helperText,
  leftIcon,
  rightIcon,
  type = 'text',
  disabled = false,
  required = false,
  size,
  ...props
}) {
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={`${styles.wrapper} ${error ? styles.hasError : ''}`}>
        {leftIcon && <div className={styles.icon}>{leftIcon}</div>}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={styles.input}
          {...props}
        />
        {rightIcon && <div className={`${styles.icon} ${styles.rightIcon}`}>{rightIcon}</div>}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {!error && helperText && <div className={styles.helper}>{helperText}</div>}
    </div>
  );
}
