import { forwardRef } from 'react';
import FormField from './FormField';
import styles from './Textarea.module.css';

const Textarea = forwardRef(({
  id, label, placeholder, value, onChange, error, helperText,
  disabled, required, size = 'md', rows = 3, className = '', ...props
}, ref) => {

  const inputClass = [
    styles.textarea,
    styles[size] || styles.md,
    error ? styles.error : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <FormField label={label} required={required} error={error} helperText={helperText}>
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        className={inputClass}
        {...props}
      />
    </FormField>
  );
});

Textarea.displayName = 'Textarea';
export default Textarea;
