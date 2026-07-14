import { useState, useRef, useEffect } from 'react'
import { useTaskNotifications } from '../../store/TaskNotificationContext'
import styles from './TaskNotificationsPanel.module.css'

export default function TaskNotificationsPanel() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useTaskNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getTypeIcon = (type) => {
    switch(type) {
      case 'assigned': return '👤'
      case 'mentioned': return '💬'
      case 'commented': return '💬'
      case 'due_soon': return '⏳'
      case 'overdue': return '⚠️'
      case 'status_changed': return '🔄'
      default: return '🔔'
    }
  }

  const handleNotificationClick = (n) => {
    if (!n.isRead) markAsRead(n.id)
    // Could also select the task and open TaskDetail
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button 
        className={styles.bellBtn} 
        onClick={() => setIsOpen(!isOpen)}
        title="Task Notifications"
      >
        🔔
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <h3 className={styles.headerTitle}>Task Alerts</h3>
            {unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={markAllAsRead}>Mark all read</button>
            )}
          </div>
          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>
                No task notifications yet.
              </div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  className={`${styles.item} ${!n.isRead ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className={`${styles.dot} ${!n.isRead ? styles.unread : styles.read}`} />
                  <div className={styles.icon}>{getTypeIcon(n.type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.msg} style={{ fontWeight: !n.isRead ? '600' : '400' }}>{n.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{n.message}</div>
                    <div className={styles.time}>{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
