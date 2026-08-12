import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/authContext'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { group: 'WORKSPACE', items: [
    { to: '/dashboard/sales', icon: '⊞', label: 'Dashboard', module: 'dashboards', permission: 'dashboards:view_sales_dashboard' },
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
  { group: 'ANALYTICS', items: [
    { label: 'Analytics', icon: '📊', module: 'analytics', subItems: [
        { to: '/analytics/leads', icon: '▲', label: 'Lead Analytics', module: 'analytics', permission: 'analytics:view_lead_analytics' },
        { to: '/analytics/projects', icon: '◉', label: 'Project Analytics', module: 'analytics', permission: 'analytics:view_project_analytics' },
        { to: '/analytics/csat', icon: '⭐', label: 'Client Satisfaction', module: 'analytics', permission: 'analytics:view_lead_analytics' },
        { to: '/analytics/delay-analysis', icon: '⏱️', label: 'Delay Analysis', module: 'analytics', permission: 'analytics:view_project_analytics' },
        { to: '/analytics/boq-variance', icon: '📊', label: 'BOQ Variance', module: 'analytics', permission: 'analytics:view_project_analytics' },
        { to: '/analytics/resources', icon: '👤', label: 'Resource Utilisation', module: 'analytics' },
        { to: '/analytics/resource-workload', icon: '👥', label: 'Resource Workload', module: 'analytics' }
    ]}
  ]},
  { group: 'SALES SETUP', adminOnly: true, items: [
    { to: '/lead-stages', icon: '◎', label: 'Lead Stages', module: 'settings' },
    { to: '/custom-fields', icon: '⊡', label: 'Custom Fields', module: 'settings' },
    { to: '/leads/forms', icon: '📝', label: 'Lead Forms', module: 'leads' }
  ]},
  { group: 'PROJECT SETUP', adminOnly: true, items: [
    { to: '/templates', icon: '◈', label: 'Project Templates', module: 'settings' },
    { to: '/trade-activities', icon: '🛠', label: 'Trade Templates', module: 'settings' },
    { to: '/qc-checklists', icon: '☑', label: 'Trade QC Checklists', module: 'settings' },
    { to: '/conversion-checklist', icon: '☑', label: 'Conversion Checklist', module: 'settings' },
    { to: '/automations', icon: '⚙', label: 'Automations', module: 'settings' }
  ]},
  { group: 'PROJECT OPERATIONS', items: [
    { to: '/projects/coordination', icon: '🔄', label: 'Production Coordination', module: 'projects' },
    { to: '/projects/handover-dashboard', icon: '📋', label: 'Handover Dashboard', module: 'projects' },
    { to: '/projects/retention-dashboard', icon: '🤝', label: 'Retention Dashboard', module: 'projects' }
  ]},
  { group: 'RESOURCE OPERATIONS', items: [
    { to: '/projects/resources', icon: '👥', label: 'Resource Capacity', module: 'projects' },
    { to: '/projects/absences', icon: '🌴', label: 'Absence Management', module: 'projects' }
  ]},
  { group: 'VENDORS', items: [
    { to: '/analytics/vendors', icon: '🤝', label: 'Vendor Performance', module: 'analytics' },
    { to: '/analytics/vendors-capacity', icon: '⚖️', label: 'Vendor Capacity', module: 'analytics' },
    { to: '/vendor-lead-times', icon: '⏱', label: 'Vendor Lead Times', module: 'settings', adminOnly: true }
  ]},
  { group: 'FINANCE', items: [
    { to: '/finance', icon: '💰', label: 'Finance Overview', module: 'finance' },
    { to: '/financial-approvals', icon: '📝', label: 'Financial Approvals', module: 'finance' },
    { to: '/analytics/profitability', icon: '💎', label: 'Project Profitability', module: 'analytics', permission: 'analytics:view_finance_analytics' },
    { to: '/analytics/collection-forecast', icon: '📈', label: 'Collection Forecast', module: 'analytics', permission: 'analytics:view_finance_analytics' },
    { to: '/financial-settings', icon: '💰', label: 'Financial Thresholds', module: 'settings', adminOnly: true }
  ]},
  { group: 'TEAM & SECURITY', adminOnly: true, items: [
    { label: 'Team Management', icon: '👥', module: 'settings', subItems: [
        { to: '/team/members', icon: '◉', label: 'Team Members' },
        { to: '/team/roles', icon: '🔑', label: 'Roles & Permissions' },
    ]},
    { to: '/organization', icon: '🏢', label: 'Organization', module: 'settings' },
    { to: '/login-history', icon: '🛡️', label: 'Login History', module: 'settings' },
    { to: '/settings/audit-trail', icon: '📜', label: 'Audit Trail', module: 'settings' }
  ]},
  { group: 'DEVELOPER TOOLS', adminOnly: true, items: [
    { to: '/api-keys', icon: '⊙', label: 'API Keys', module: 'settings' },
    { to: '/developer/api', icon: '🔌', label: 'API Integration', module: 'settings' },
    { to: '/developer/webhooks', icon: '🪝', label: 'Webhooks', module: 'settings' },
    { to: '/email-templates', icon: '📧', label: 'Email Templates', module: 'settings' },
    { to: '/logs', icon: '≡', label: 'Logs', module: 'settings' },
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
                state={{ reset: Date.now(), fromSidebar: true }}
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
      state={{ reset: Date.now(), fromSidebar: true }}
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
            if (item.adminOnly && !isAdmin) return false;
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

