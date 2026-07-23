import { useAuth } from '../../store/authContext'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './Topbar.module.css'
import { useState, useEffect } from 'react'
import NotificationsPanel from './NotificationsPanel'

export default function Topbar({ onMenuClick, onToggleSidebar, sidebarCollapsed, onSearchClick }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isProjectDetail = location.pathname.startsWith('/projects/') && !['/projects/resources', '/projects/coordination', '/projects/handover-dashboard', '/projects/retention-dashboard', '/projects/absences'].includes(location.pathname);
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  return (
    <header className={styles.topbar}>
      {/* Left: hamburger (mobile) + collapse (desktop) */}
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuClick} aria-label='Menu' data-tooltip='Menu'>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        {isProjectDetail ? (
          <button className={`${styles.collapseBtn} ${styles.desktopOnly}`} onClick={() => navigate('/projects')}
            aria-label='Back to Projects'
            data-tooltip='Back to Projects'
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
        ) : (
          <button className={`${styles.collapseBtn} ${styles.desktopOnly}`} onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            data-tooltip={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            ) : (
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            )}
          </button>
        )}
      </div>

      {/* Center: search bar */}
      <div className={styles.center}>
        <div className={styles.searchWrapper}>
          <input 
            type="text" 
            placeholder="Search projects, leads..." 
            className={styles.searchInput}
            onClick={onSearchClick}
            onFocus={onSearchClick}
            readOnly
            data-tooltip='Universal Search'
          />
          <svg className={styles.searchIcon} width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
      </div>

      {/* Right: notifications + user */}
      <div className={styles.right}>
        <button 
          className={styles.iconBtn} 
          onClick={() => setIsDark(d => !d)} 
          aria-label='Toggle Theme'
          data-tooltip='Toggle Theme'
        >
          {isDark ? (
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
        <NotificationsPanel />
        <button className={styles.userBtn} onClick={() => setUserMenuOpen(o => !o)} data-tooltip='User Menu'>
          <div className={styles.avatar}>{user?.name?.charAt(0) || 'U'}</div>
          <span className={styles.name}>{user?.name?.split(' ')[0] || 'User'}</span>
          <span>▾</span>
        </button>
        {userMenuOpen && (
          <div className={styles.userMenu}>
            <button onClick={() => { navigate('/settings/profile'); setUserMenuOpen(false); }}>My Profile</button>
            <button onClick={() => { navigate('/settings/security'); setUserMenuOpen(false); }}>My Security</button>
            <hr />
            <button onClick={logout} className={styles.logout}>Sign Out</button>
          </div>
        )}
      </div>
    </header>
  )
}
