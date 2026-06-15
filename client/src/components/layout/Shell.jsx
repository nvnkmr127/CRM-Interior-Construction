import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import GlobalSearch from './GlobalSearch'
import Breadcrumbs from './Breadcrumbs'
import styles from './Shell.module.css'

export default function Shell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

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
