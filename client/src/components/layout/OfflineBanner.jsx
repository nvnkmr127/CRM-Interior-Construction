import { useState, useEffect } from 'react'
import styles from './OfflineBanner.module.css'

export default function OfflineBanner() {
  const [status, setStatus] = useState(navigator.onLine ? 'online' : 'offline')
  const [visible, setVisible] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => { setStatus('offline'); setVisible(true) }
    const goOnline  = () => {
      setStatus('online'); setVisible(true)
      setTimeout(() => setVisible(false), 3000)
    }
    
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => { 
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  return (
    <div className={`${styles.banner} ${styles[status]} ${!visible ? styles.hidden : ''}`}>
      {status === 'offline' ? '⚠ No internet connection — changes may not be saved' : '✓ Back online'}
    </div>
  )
}
