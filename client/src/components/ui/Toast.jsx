import styles from './Toast.module.css'

export function ToastContainer({ toasts, dispatch }) {
  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          <span className={styles.icon}>{ {success:'✓',error:'✕',warning:'⚠',info:'ℹ'}[t.type] }</span>
          <span className={styles.message}>{t.message}</span>
          <button className={styles.dismiss} onClick={()=>dispatch({type:'REMOVE',id:t.id})}>✕</button>
        </div>
      ))}
    </div>
  )
}
