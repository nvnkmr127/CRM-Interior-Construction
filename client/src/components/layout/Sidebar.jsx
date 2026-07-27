import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/authContext'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { group: 'WORKSPACE', items: [
    { label: 'Dashboards', icon: '⊞', module: 'dashboards', subItems: [
        { to: '/dashboard/sales', icon: '📈', label: 'Sales Dashboard', permission: 'dashboards:view_sales_dashboard' },
        { to: '/dashboard/project', icon: '🏗️', label: 'Project Dashboard', permission: 'dashboards:view_project_dashboard' },
        { to: '/dashboard/finance', icon: '💰', label: 'Finance Dashboard', permission: 'dashboards:view_finance_dashboard' },
        { to: '/dashboard/factory', icon: '🏭', label: 'Factory Dashboard', permission: 'dashboards:view_factory_dashboard' },
        { to: '/dashboard/warehouse', icon: '📦', label: 'Warehouse Dashboard', permission: 'dashboards:view_warehouse_dashboard' },
        { to: '/dashboard/management', icon: '👑', label: 'Management Dashboard', permission: 'dashboards:view_management_dashboard' },
    ]},
    { label: 'Leads', icon: '◎', module: 'leads', subItems: [
        { to: '/leads?view=dashboard', icon: '📊', label: 'Dashboard' },
        { to: '/leads?view=list', icon: '≣', label: 'List' },
        { to: '/leads?view=kanban', icon: '◫', label: 'Kanban' },
        { to: '/leads?view=calendar', icon: '📅', label: 'Calendar' },
        { to: '/leads?view=map', icon: '🗺️', label: 'Map' },
    ]},
    { to: '/projects', icon: '◈', label: 'Projects', module: 'projects' },
    { to: '/tasks',      icon: '◻', label: 'My Tasks', module: 'tasks' },
  ]},
  { group: 'OPERATIONS', items: [
    { label: 'Project Operations', icon: '⚙️', module: 'projects', subItems: [
        { to: '/projects/resources', icon: '👥', label: 'Resource Capacity' },
        { to: '/projects/absences', icon: '🌴', label: 'Absence Management' },
        { to: '/projects/coordination', icon: '🔄', label: 'Production Coordination' },
        { to: '/projects/handover-dashboard', icon: '📋', label: 'Handover Dashboard' },
        { to: '/projects/retention-dashboard', icon: '🤝', label: 'Retention Dashboard' },
    ]},
  ]},
  { group: 'ANALYTICS', items: [
    { to: '/analytics/leads',    icon: '▲', label: 'Lead Analytics', module: 'analytics', permission: 'analytics:view_lead_analytics' },
    { label: 'Project Analytics', icon: '◉', module: 'analytics', permission: 'analytics:view_project_analytics', subItems: [
        { to: '/analytics/projects', icon: '◉', label: 'Project Health' },
        { to: '/analytics/boq-variance', icon: '📊', label: 'BOQ Variance' },
        { to: '/analytics/profitability', icon: '💎', label: 'Project Profitability' },
    ]},
    { label: 'Resource Analytics', icon: '👤', module: 'analytics', subItems: [
        { to: '/analytics/resources', icon: '👤', label: 'Resource Utilisation' },
        { to: '/analytics/resource-workload', icon: '👥', label: 'Resource Workload' },
    ]},
    { label: 'Vendor Analytics', icon: '🤝', module: 'analytics', subItems: [
        { to: '/analytics/vendors', icon: '🤝', label: 'Vendor Performance' },
        { to: '/analytics/vendors-capacity', icon: '⚖️', label: 'Vendor Capacity' },
    ]},
    { to: '/analytics/collection-forecast', icon: '📈', label: 'Finance Analytics', module: 'analytics', permission: 'analytics:view_finance_analytics' },
    { to: '/analytics/inventory', icon: '📦', label: 'Inventory Analytics', module: 'analytics', permission: 'analytics:view_inventory_analytics' },
    { to: '/analytics/csat', icon: '⭐', label: 'Client Satisfaction', module: 'analytics' },
  ]},
  { group: 'TEAM & ACCESS', adminOnly: true, items: [
    { label: 'Team Management', icon: '👥', module: 'settings', subItems: [
        { to: '/team/members', icon: '◉', label: 'Team Members' },
        { to: '/team/roles', icon: '🔑', label: 'Roles & Permissions' },
    ]},
    { to: '/settings/audit-trail', icon: '📜', label: 'Audit Trail', module: 'settings' }
  ]},
  { group: 'ADMIN', adminOnly: true, items: [
    { to: '/config',     icon: '⊙', label: 'Config Centre', module: 'settings' }
  ]},
  { group: 'FINANCE', financeOnly: true, items: [
    { to: '/financial-approvals', icon: '📝', label: 'Financial Approvals', module: 'finance' }
  ]},
  { group: 'DEVELOPER', items: [
    { to: '/developer/webhooks', icon: '🪝', label: 'Webhooks', module: 'settings' },
    { to: '/developer/api', icon: '🔌', label: 'API Integration', module: 'settings' },
    { to: '/leads/forms', icon: '📝', label: 'Lead Forms', module: 'leads' }
  ]}
]

function NavItem({ item, collapsed, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  if (item.subItems) {
    const isActive = item.subItems.some(sub => {
      const basePath = sub.to.split('?')[0];
      return location.pathname === basePath;
    });
    
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
                className={() => {
                  const isQueryMatch = sub.to.includes('?') 
                    ? location.pathname + location.search === sub.to || (location.pathname === sub.to.split('?')[0] && !location.search && sub.to.includes('view=dashboard'))
                    : location.pathname === sub.to;
                  return `${styles.subItem} ${isQueryMatch ? styles.subActive : ''}`;
                }}
                onClick={onClose}
              >
                {sub.icon && <span className={styles.navIcon}>{sub.icon}</span>}
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

          const filterItem = (item) => {
            if (isAdmin) return true;
            if (item.permission) {
              const [mod] = item.permission.split(':');
              return user?.role?.permissions?.includes(item.permission) || user?.role?.permissions?.includes(`${mod}:*`);
            }
            if (item.module) {
              return user?.role?.enabled_modules?.includes(item.module);
            }
            return true;
          };

          const visibleItems = group.items.map(item => {
            if (item.subItems) {
              return { ...item, subItems: item.subItems.filter(filterItem) };
            }
            return item;
          }).filter(item => {
            if (item.subItems && item.subItems.length === 0) return false;
            return filterItem(item);
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className={styles.navGroup}>
              {!collapsed && <span className={styles.groupLabel}>{group.group}</span>}
              {visibleItems.map((item, i) => (
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

