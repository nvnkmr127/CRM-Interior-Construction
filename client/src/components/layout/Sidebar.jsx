import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/authContext'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { group: 'MAIN', items: [
    { to: '/dashboard',  icon: '⊞', label: 'Dashboard' },
    { to: '/leads',      icon: '◎', label: 'Leads' },
    { to: '/projects',   icon: '◈', label: 'Projects' },
    { to: '/tasks',      icon: '◻', label: 'My Tasks' },
  ]},
  { group: 'ANALYTICS', items: [
    { to: '/analytics/leads',    icon: '▲', label: 'Lead Analytics' },
    { to: '/analytics/projects', icon: '◉', label: 'Project Health' },
  ]},
  { group: 'ADMIN', adminOnly: true, items: [
    { to: '/config',     icon: '⊙', label: 'Config Centre' },
  ]},
]

export default function Sidebar({ collapsed, mobileOpen, onClose }) {
  const { user } = useAuth()
  const isAdmin = user?.role?.name === 'superadmin'

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
      {/* Logo area */}
      <div className={styles.logo}>
        <div className={styles.logoMark}>C</div>
        {!collapsed && <span className={styles.logoText}>Interior CRM</span>}
      </div>

      {/* Nav groups */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map(group => {
          if (group.adminOnly && !isAdmin) return null
          return (
            <div key={group.group} className={styles.navGroup}>
              {!collapsed && <span className={styles.groupLabel}>{group.group}</span>}
              {group.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/config' ? false : undefined}
                    className={({isActive}) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    onClick={onClose}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                    {collapsed && <span className={styles.tooltip}>{item.label}</span>}
                  </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Bottom: user card */}
      <div className={styles.userCard}>
        <div className={styles.userAvatar}>{user?.name?.charAt(0)}</div>
        {!collapsed && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name}</span>
            <span className={styles.userRole}>{user?.role?.name}</span>
          </div>
        )}
      </div>
    </aside>
  )
}
