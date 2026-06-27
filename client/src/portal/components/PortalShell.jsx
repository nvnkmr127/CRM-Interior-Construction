import { NavLink } from 'react-router-dom'
import styles from './PortalShell.module.css'
import { usePortalAuth } from '../store/portalAuthContext'

const NAV_ITEMS = [
  { path: '/portal/overview', label: 'Overview', icon: '🏠' },
  { path: '/portal/timeline', label: 'Timeline', icon: '📅' },
  { path: '/portal/approvals', label: 'Approvals', icon: '📋' },
  { path: '/portal/design-concepts', label: 'Design Concepts', icon: '🎨' },
  { path: '/portal/design-reviews', label: 'Design Reviews', icon: '📐' },
  { path: '/portal/material-palettes', label: 'Material Palettes', icon: '🧱' },
  { path: '/portal/material-approvals', label: 'Material Approvals', icon: '🔄' },
  { path: '/portal/change-orders', label: 'Change Orders', icon: '📄' },
  { path: '/portal/documents', label: 'Documents', icon: '📁' },
  { path: '/portal/meeting-notes', label: 'Meeting Notes', icon: '📝' },
  { path: '/portal/snags', label: 'Snags', icon: '🔧' },
  { path: '/portal/punch-list', label: 'Punch List', icon: '📋' },
  { path: '/portal/handover', label: 'Handover & Certificate', icon: '🏆' },
  { path: '/portal/payments', label: 'Payments', icon: '💳' },
  { path: '/portal/warranties', label: 'Warranties', icon: '🛡️' },
  { path: '/portal/amcs', label: 'Maintenance (AMC)', icon: '🛠️' },
  { path: '/portal/claims', label: 'Warranty Claims', icon: '🔧' }
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
