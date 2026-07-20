/* eslint-disable react-hooks/immutability, no-unused-vars, no-empty */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import styles from './NotificationsPanel.module.css'
import Avatar from '../ui/Avatar'
import { useAuth } from '../../store/authContext'

export default function NotificationsPanel() {
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const wrapperRef = useRef(null)
  const navigate = useNavigate()
  const { token } = useAuth()

  useEffect(() => {
    fetchUnreadCount()
    
    // Server-Sent Events for Real-Time notifications
    let eventSource;
    if (token) {
      // Connect to SSE, using an interceptor or passing token via query param is common for SSE
      // Assuming our backend accepts the token cookie, or we must pass it explicitly.
      // In this setup, we'll try native EventSource
      // Note: If using JWT in header, native EventSource doesn't support headers. 
      // A common workaround is passing token in URL for the stream.
      // We will assume standard cookie auth or token in URL if backend was modified for it.
      eventSource = new EventSource(`/api/notifications/stream?token=${token}`)
      
      eventSource.onmessage = (e) => {
        try {
          const newNotification = JSON.parse(e.data);
          // If it's a valid notification
          if (newNotification.id) {
            setNotifications(prev => [newNotification, ...prev].slice(0, 20));
            setUnreadCount(c => c + 1);
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(newNotification.type || 'New Notification', {
                body: newNotification.message,
                icon: '/vite.svg'
              });
            }
          }
        } catch (err) {}
      }
    }

    return () => {
      if (eventSource) eventSource.close();
    }
  }, [token])

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
      const res = await api.get('/notifications/unread-count')
      if (res.data?.success) {
        setUnreadCount(res.data.data?.count || 0)
      }
    } catch (e) { console.error(e) }
  }

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=20')
      if (res.data?.success) {
        const list = res.data.data || [];
        setNotifications(list);
        // Derive the real unread count directly from the fetched list
        // so the badge always stays in sync with server data
        setUnreadCount(list.filter(n => !n.is_read).length);
      }
    } catch (e) { console.error(e) }
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-read', { all: true })
      // Optimistically clear all in UI
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
      // Re-confirm with server to stay in sync
      await fetchUnreadCount()
    } catch (e) { console.error(e) }
  }

  const handleNotificationClick = async (n) => {
    if (!n.is_read) {
      try {
        await api.post('/notifications/mark-read', { ids: [n.id] })
        setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
        setUnreadCount(c => Math.max(0, c - 1))
        // Re-confirm count with server after individual mark
        await fetchUnreadCount()
      } catch (e) { console.error(e) }
    }
    if (n.lead_id) {
      setIsOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button className={styles.btn} onClick={() => setIsOpen(!isOpen)} aria-label='Notifications' data-tooltip='Notifications'>
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
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
              <div className={styles.empty}>
                <svg width="32" height="32" fill="none" stroke="#ccc" strokeWidth="2" viewBox="0 0 24 24" className="mx-auto mb-2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                You're all caught up!
              </div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  className={`${styles.item} ${!n.is_read ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className={`${styles.dot} ${!n.is_read ? styles.unread : styles.read}`} />
                  <Avatar name={n.actor_avatar ? null : n.title} src={n.actor_avatar} size="sm" />
                  <div style={{ flex: 1 }}>
                    <div className={styles.msg} style={{ fontWeight: !n.is_read ? '600' : '400' }}>{n.title}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{n.body}</div>
                    <div className={styles.time}>{n.created_at ? new Date(n.created_at).toLocaleString() : 'Just now'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-2 text-center bg-gray-50 border-t text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer" onClick={() => { navigate('/settings/preferences'); setIsOpen(false); }}>
            Notification Preferences ⚙️
          </div>
        </div>
      )}
    </div>
  )
}
