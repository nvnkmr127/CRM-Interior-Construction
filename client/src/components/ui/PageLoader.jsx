import styles from './PageLoader.module.css'

export default function PageLoader() {
  return (
    <div className={styles.loader}>
      <div className={styles.logoMark}>C</div>
      <p className={styles.text}>Loading...</p>
    </div>
  )
}
