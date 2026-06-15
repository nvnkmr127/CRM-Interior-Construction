import React, { forwardRef } from 'react';
import FormField from './FormField';
import styles from './Input.module.css';

const Input = forwardRef(({
  id, label, placeholder, value, onChange, error, helperText,
  leftIcon, rightIcon, type = 'text', disabled, required, size = 'md', className = '', ...props
}, ref) => {

  const wrapperClass = [
    styles.inputWrapper,
    leftIcon ? styles.withLeftIcon : '',
    rightIcon ? styles.withRightIcon : '',
    error ? styles.error : ''
  ].filter(Boolean).join(' ');

  const inputClass = `${styles.input} ${styles[size] || styles.md} ${className}`.trim();

  return (
    <FormField label={label} required={required} error={error} helperText={helperText}>
      <div className={wrapperClass}>
        {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={inputClass}
          {...props}
        />
        {rightIcon && <span className={styles.rightIcon}>{rightIcon}</span>}
      </div>
    </FormField>
  );
});

Input.displayName = 'Input';
export default Input;
