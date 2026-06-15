import { Link, useNavigate } from 'react-router-dom'
import styles from './StatusPage.module.css'

export default function Forbidden() {
  const navigate = useNavigate()
  
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={`${styles.code} ${styles.code403}`}>403</div>
        <h1 className={styles.title}>◉ Access denied</h1>
        <p className={styles.desc}>You don't have permission to view this page. Contact your admin.</p>
        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={() => navigate(-1)}>Go Back</button>
          <Link to="/dashboard" className={styles.btnPrimary}>Go to Dashboard</Link>
        </div>
      </div>
    </div>
  )
}
