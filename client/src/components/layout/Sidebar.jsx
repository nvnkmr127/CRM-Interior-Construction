import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/authContext'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { group: 'WORKSPACE', items: [
    { to: '/dashboard',  icon: '⊞', label: 'Dashboard' },
    { to: '/leads',      icon: '◎', label: 'Leads' },
    { to: '/projects', icon: '◈', label: 'Projects' },
    { to: '/tasks',      icon: '◻', label: 'My Tasks' },
  ]},
  { group: 'OPERATIONS', items: [
    { label: 'Project Operations', icon: '⚙️', subItems: [
        { to: '/projects/resources', icon: '👥', label: 'Resource Capacity' },
        { to: '/projects/absences', icon: '🌴', label: 'Absence Management' },
        { to: '/projects/coordination', icon: '🔄', label: 'Production Coordination' },
        { to: '/projects/handover-dashboard', icon: '📋', label: 'Handover Dashboard' },
        { to: '/projects/retention-dashboard', icon: '🤝', label: 'Retention Dashboard' },
    ]},
  ]},
  { group: 'ANALYTICS', items: [
    { to: '/analytics/leads',    icon: '▲', label: 'Lead Analytics' },
    { label: 'Project Analytics', icon: '◉', subItems: [
        { to: '/analytics/projects', icon: '◉', label: 'Project Health' },
        { to: '/analytics/boq-variance', icon: '📊', label: 'BOQ Variance' },
        { to: '/analytics/profitability', icon: '💎', label: 'Project Profitability' },
    ]},
    { label: 'Resource Analytics', icon: '👤', subItems: [
        { to: '/analytics/resources', icon: '👤', label: 'Resource Utilisation' },
        { to: '/analytics/resource-workload', icon: '👥', label: 'Resource Workload' },
    ]},
    { label: 'Vendor Analytics', icon: '🤝', subItems: [
        { to: '/analytics/vendors', icon: '🤝', label: 'Vendor Performance' },
        { to: '/analytics/vendors-capacity', icon: '⚖️', label: 'Vendor Capacity' },
    ]},
    { to: '/analytics/collection-forecast', icon: '📈', label: 'Collection Forecast' },
    { to: '/analytics/csat', icon: '⭐', label: 'Client Satisfaction' },
  ]},
  { group: 'ADMIN', adminOnly: true, items: [
    { to: '/config',     icon: '⊙', label: 'Config Centre' },
    { to: '/settings/audit-trail', icon: '📋', label: 'Audit Trail' }
  ]},
  { group: 'FINANCE', financeOnly: true, items: [
    { to: '/financial-approvals', icon: '📝', label: 'Financial Approvals' }
  ]},
  { group: 'DEVELOPER', items: [
    { to: '/developer/webhooks', icon: '🪝', label: 'Webhooks' },
    { to: '/developer/api', icon: '🔌', label: 'API Integration' },
    { to: '/leads/forms', icon: '📝', label: 'Lead Forms' }
  ]}
]

function NavItem({ item, collapsed, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  if (item.subItems) {
    const isActive = item.subItems.some(sub => location.pathname === sub.to);
    
    return (
      <div className={styles.navItemWrapper}>
        <div 
          className={`${styles.navItem} ${isActive ? styles.active : ''}`}
          onClick={() => setExpanded(!expanded)}
        >
          <span className={styles.navIcon}>{item.icon}</span>
          {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
          {!collapsed && (
            <span className={styles.chevron} style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>
              ▼
            </span>
          )}
          {collapsed && <span className={styles.tooltip}>{item.label}</span>}
        </div>
        {expanded && !collapsed && (
          <div className={styles.subItemsList}>
            {item.subItems.map(sub => (
              <NavLink
                key={sub.to}
                to={sub.to}
                className={({isActive}) => `${styles.subItem} ${isActive ? styles.subActive : ''}`}
                onClick={onClose}
              >
                <span className={styles.navLabel}>{sub.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === '/config' ? false : undefined}
      className={({isActive}) => `${styles.navItem} ${isActive ? styles.active : ''}`}
      onClick={onClose}
    >
      <span className={styles.navIcon}>{item.icon}</span>
      {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
      {collapsed && <span className={styles.tooltip}>{item.label}</span>}
    </NavLink>
  );
}

export default function Sidebar({ collapsed, mobileOpen, onClose }) {
  const { user } = useAuth()
  const isAdmin = user?.role?.name === 'superadmin'
  const hasFinancePermission = isAdmin || (user?.role?.permissions && (
    user.role.permissions.includes('finance:invoices') ||
    user.role.permissions.includes('finance:payments') ||
    user.role.permissions.includes('finance:discounts') ||
    user.role.permissions.includes('finance:credits')
  ))

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
          if (group.financeOnly && !hasFinancePermission) return null
          return (
            <div key={group.group} className={styles.navGroup}>
              {!collapsed && <span className={styles.groupLabel}>{group.group}</span>}
              {group.items.map((item, i) => (
                  <NavItem key={item.to || item.label || i} item={item} collapsed={collapsed} onClose={onClose} />
              ))}
            </div>
          )
        })}
      </nav>

      {/* Bottom: user card */}
      <NavLink to="/settings/profile" className={styles.userCard} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className={styles.userAvatar}>{user?.name?.charAt(0)}</div>
        {!collapsed && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.name}</span>
            <span className={styles.userRole}>{user?.role?.name}</span>
          </div>
        )}
      </NavLink>
    </aside>
  )
}

