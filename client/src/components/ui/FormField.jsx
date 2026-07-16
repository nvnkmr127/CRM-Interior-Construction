import styles from './FormField.module.css';

export default function FormField({ label, required, error, helperText, children }) {
  if (!label) return <>{children}</>;

  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.asterisk}>*</span>}
      </label>
      {children}
      {error ? (
        <span className={styles.errorText}>{error}</span>
      ) : helperText ? (
        <span className={styles.helperText}>{helperText}</span>
      ) : null}
    </div>
  );
}
