import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import GlobalSearch from './GlobalSearch'
import Breadcrumbs from './Breadcrumbs'
import { useAuth } from '../../store/authContext'
import styles from './Shell.module.css'

export default function Shell() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    if (user?.tenant?.accentColour) {
      document.documentElement.style.setProperty('--color-accent', user.tenant.accentColour);
      document.documentElement.style.setProperty('--color-border-focus', user.tenant.accentColour);
      document.documentElement.style.setProperty('--color-nav-active-bar', user.tenant.accentColour);
      
      const hex = user.tenant.accentColour.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        document.documentElement.style.setProperty('--color-nav-active-bg', `rgba(${r}, ${g}, ${b}, 0.15)`);
      }
    }
  }, [user?.tenant?.accentColour])

  useEffect(() => {
    const handler = (e) => { 
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { 
        e.preventDefault()
        setSearchOpen(true) 
      } 
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}>
      {/* Mobile overlay backdrop */}
      {mobileOpen && <div className={styles.backdrop} onClick={() => setMobileOpen(false)} />}
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className={styles.main}>
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          onToggleSidebar={() => setCollapsed(c => !c)}
          sidebarCollapsed={collapsed}
          onSearchClick={() => setSearchOpen(true)}
        />
        <main className={styles.content}>
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
