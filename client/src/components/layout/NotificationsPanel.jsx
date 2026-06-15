import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './NotificationsPanel.module.css'
import Avatar from '../ui/Avatar'

export default function NotificationsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const wrapperRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/notifications/unread-count')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count || 0)
      }
    } catch (e) { console.error(e) }
  }

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=20')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data || [])
      }
    } catch (e) { console.error(e) }
  }

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id)
    if (!unreadIds.length) return
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds })
      })
      setNotifications(notifications.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (e) { console.error(e) }
  }

  const handleNotificationClick = async (n) => {
    if (!n.isRead) {
      try {
        await fetch('/api/notifications/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: [n.id] })
        })
        setNotifications(notifications.map(x => x.id === n.id ? { ...x, isRead: true } : x))
        setUnreadCount(c => Math.max(0, c - 1))
      } catch (e) { console.error(e) }
    }
    if (n.referenceUrl) {
      navigate(n.referenceUrl)
      setIsOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button className={styles.btn} onClick={() => setIsOpen(!isOpen)} aria-label='Notifications'>
        <span>🔔</span>
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <h3 className={styles.headerTitle}>Notifications</h3>
            {unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>🔔 You're all caught up!</div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  className={`${styles.item} ${!n.isRead ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className={`${styles.dot} ${!n.isRead ? styles.unread : styles.read}`} />
                  <Avatar name={n.actorName} size="sm" />
                  <div style={{ flex: 1 }}>
                    <div className={styles.msg}>{n.message}</div>
                    <div className={styles.time}>{n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Just now'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className={styles.footer}>
            <a href="/notifications" onClick={e => { e.preventDefault(); navigate('/notifications'); setIsOpen(false) }}>
              View all notifications →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
