import { useAuth } from '../../store/authContext'
import { useNavigate } from 'react-router-dom'
import styles from './Topbar.module.css'
import { useState } from 'react'
import NotificationsPanel from './NotificationsPanel'

export default function Topbar({ onMenuClick, onToggleSidebar, sidebarCollapsed, onSearchClick }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  return (
    <header className={styles.topbar}>
      {/* Left: hamburger (mobile) + collapse (desktop) */}
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuClick} aria-label='Menu'>☰</button>
        <button className={`${styles.collapseBtn} ${styles.desktopOnly}`} onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '→' : '←'}
        </button>
      </div>

      {/* Right: search + notifications + user */}
      <div className={styles.right}>
        <button className={styles.iconBtn} onClick={onSearchClick} aria-label='Search'>
          <span>⌕</span>
          <span className={styles.kbd}>⌘K</span>
        </button>
        <NotificationsPanel />
        <button className={styles.userBtn} onClick={() => setUserMenuOpen(o => !o)}>
          <div className={styles.avatar}>{user?.name?.charAt(0) || 'U'}</div>
          <span className={styles.name}>{user?.name?.split(' ')[0] || 'User'}</span>
          <span>▾</span>
        </button>
        {userMenuOpen && (
          <div className={styles.userMenu}>
            <button onClick={() => navigate('/settings/profile')}>My Profile</button>
            <hr />
            <button onClick={logout} className={styles.logout}>Sign Out</button>
          </div>
        )}
      </div>
    </header>
  )
}
