import { useAuth } from '../../store/authContext'
import { useNavigate, useLocation } from 'react-router-dom'
import styles from './Topbar.module.css'
import { useState, useEffect } from 'react'
import NotificationsPanel from './NotificationsPanel'
import api from '../../api/axios'
import { useToast } from '../../store/toastContext'

const getInitials = (name) => {
  if (!name) return 'U'
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export default function Topbar({ onMenuClick, onToggleSidebar, sidebarCollapsed, onSearchClick }) {
  const { user, setUser, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  
  const isProjectDetail = location.pathname.startsWith('/projects/') && !['/projects/resources', '/projects/coordination', '/projects/handover-dashboard', '/projects/retention-dashboard', '/projects/absences'].includes(location.pathname);
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [tenants, setTenants] = useState([])
  const [switching, setSwitching] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  const isSuperAdmin = 
    user?.role === 'superadmin' || 
    user?.role?.name?.toLowerCase() === 'superadmin' || 
    user?.role?.name?.toLowerCase() === 'super admin' ||
    user?.is_platform_admin === true

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  useEffect(() => {
    if (isSuperAdmin && switcherOpen) {
      api.get('/superadmin/tenants')
        .then(res => {
          setTenants(res.data.data || [])
        })
        .catch(err => {
          console.warn('Failed to fetch tenants:', err?.response?.status)
          setTenants([])
        })
    }
  }, [isSuperAdmin, switcherOpen])

  // Close menus when clicking anywhere
  useEffect(() => {
    const handleOutsideClick = () => {
      setSwitcherOpen(false)
      setUserMenuOpen(false)
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  const handleSwitchTenant = async (e, tenantId, tenantName) => {
    e.stopPropagation()
    if (switching) return
    setSwitching(true)
    try {
      const res = await api.post('/superadmin/switch-tenant', { tenantId })
      if (res.data.success) {
        setUser(res.data.data.user)
        window.dispatchEvent(new Event('app:sidebar-config-updated'))
        window.dispatchEvent(new Event('app:tenant-updated'))
        window.dispatchEvent(new Event('app:auth-change'))
        toast.success(`Switched to workspace: ${tenantName}`)
        setSwitcherOpen(false)
        navigate('/')
      }
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error?.message || 'Failed to switch workspace')
    } finally {
      setSwitching(false)
    }
  }

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
        ) : location.pathname === '/team/roles' && (new URLSearchParams(location.search).has('action') || new URLSearchParams(location.search).has('edit')) ? (
          <button className={`${styles.collapseBtn} ${styles.desktopOnly}`} onClick={() => navigate('/team/roles')}
            aria-label='Back to Roles'
            data-tooltip='Back to Roles'
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
        {isSuperAdmin && (
          <div className={styles.switcherContainer} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.jumpBtn} 
              onClick={() => setSwitcherOpen(!switcherOpen)}
              data-tooltip="Direct Jump"
              aria-label="Direct Jump"
            >
              <span>🏢</span>
              <span className={styles.desktopOnly}>Direct Jump</span>
              <span>▼</span>
            </button>
            {switcherOpen && (
              <div className={styles.switcherMenu}>
                <div className={styles.switcherHeader}>Active Workspaces</div>
                {tenants.map(t => (
                  <button 
                    key={t.id} 
                    className={`${styles.switcherItem} ${user?.tenant?.id === t.id ? styles.switcherActiveItem : ''}`}
                    onClick={(e) => handleSwitchTenant(e, t.id, t.name)}
                    disabled={switching}
                  >
                    <div className={styles.switcherLabel}>
                      <div className={styles.switcherLogo}>
                        {t.name ? t.name.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <span>{t.name}</span>
                    </div>
                    {user?.tenant?.id === t.id && <div className={styles.activeDot} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
        <div className={styles.userMenuContainer} onClick={(e) => e.stopPropagation()}>
          <button className={styles.userBtn} onClick={() => setUserMenuOpen(o => !o)} data-tooltip='User Menu'>
            <div className={styles.avatar}>{getInitials(user?.name)}</div>
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
      </div>
    </header>
  )
}
