import styles from './Badge.module.css';

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
}) {
  const className = [
    styles.badge,
    styles[variant],
    styles[size]
  ].filter(Boolean).join(' ');

  return (
    <span className={className}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
