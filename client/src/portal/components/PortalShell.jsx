import { NavLink } from 'react-router-dom'
import styles from './PortalShell.module.css'
import { usePortalAuth } from '../store/portalAuthContext'

const NAV_ITEMS = [
  { path: '/portal/overview', label: 'Overview', icon: '🏠' },
  { path: '/portal/approvals', label: 'Approvals', icon: '📋' },
  { path: '/portal/documents', label: 'Documents', icon: '📁' },
  { path: '/portal/snags', label: 'Snags', icon: '🔧' }
]

export default function PortalShell({ children }) {
  const { portalUser, logout } = usePortalAuth()

  return (
    <div className={styles.shell}>
      <header className={styles.topnav}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>A</div>
          <span className={styles.brandName}>Antigravity</span>
          {portalUser && <span className={styles.projectName}>| {portalUser.name}'s Project</span>}
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(item => (
            <NavLink 
              key={item.path} 
              to={item.path}
              className={({isActive}) => `${styles.navBtn} ${isActive ? styles.active : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
          <button className={styles.logoutBtn} onClick={logout}>Sign out</button>
        </nav>
      </header>

      <main className={styles.main}>
        {children}
      </main>

      <nav className={styles.bottomNav}>
        {NAV_ITEMS.map(item => (
          <NavLink 
            key={item.path} 
            to={item.path}
            className={({isActive}) => `${styles.tabBtn} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.tabIcon}>{item.icon}</span>
            <span className={styles.tabLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
