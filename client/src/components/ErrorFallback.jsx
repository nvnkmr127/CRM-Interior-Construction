/* eslint-disable no-undef */
import styles from './ErrorFallback.module.css'

export default function ErrorFallback({ error, onReset }) {
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>⚠</div>
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.desc}>
          We've encountered an unexpected error. Our team has been notified.
          <br /><br />
          <strong>{error?.message || 'Unknown error occurred'}</strong>
        </p>

        {isDev && error?.stack && (
          <pre className={styles.stack}>
            {error.stack}
          </pre>
        )}

        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={onReset}>Try Again</button>
          <a href="/dashboard" className={styles.btnPrimary}>Go to Dashboard</a>
        </div>
      </div>
    </div>
  )
}
