import { Link } from 'react-router-dom'
import styles from './StatusPage.module.css'

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={`${styles.code} ${styles.code404}`}>404</div>
        <h1 className={styles.title}>◎ Page not found</h1>
        <p className={styles.desc}>The page you're looking for doesn't exist or has been moved.</p>
        <div className={styles.actions}>
          <Link to="/dashboard" className={styles.btnPrimary}>Go to Dashboard</Link>
        </div>
      </div>
    </div>
  )
}
