import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/authContext'
import { PLAN_DEFAULTS } from '../../constants/permissions'
import api from '../../api/axios'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { group: 'WORKSPACE', items: [
    { id: 'dashboard', to: '/dashboard/sales', icon: '⊞', label: 'Dashboard', module: 'dashboards' },
    { id: 'leads', label: 'Leads', icon: '◎', module: 'leads', subItems: [
        { id: 'leads-dashboard', to: '/leads?view=dashboard', icon: '📊', label: 'Dashboard', permission: 'leads:view_dashboard' },
        { id: 'leads-list', to: '/leads?view=list', icon: '≣', label: 'List' },
        { id: 'leads-kanban', to: '/leads?view=kanban', icon: '◫', label: 'Kanban', permission: 'leads:view_kanban' },
        { id: 'leads-calendar', to: '/leads?view=calendar', icon: '📅', label: 'Calendar', permission: 'leads:view_calendar' },
        { id: 'leads-map', to: '/leads?view=map', icon: '🗺️', label: 'Map', permission: 'leads:view_map' },
    ]},
    { id: 'projects', to: '/projects', icon: '◈', label: 'Projects', module: 'projects' },
    { id: 'tasks', to: '/tasks', icon: '◻', label: 'My Tasks', module: 'tasks' },
  ]},
  { group: 'ANALYTICS', items: [
    { id: 'analytics', label: 'Analytics', icon: '📊', module: 'analytics', subItems: [
        { id: 'analytics-leads', to: '/analytics/leads', icon: '▲', label: 'Lead Analytics', module: 'analytics', permission: 'analytics:view_lead_analytics' },
        { id: 'analytics-projects', to: '/analytics/projects', icon: '◉', label: 'Project Analytics', module: 'analytics', permission: 'analytics:view_project_analytics' },
        { id: 'analytics-csat', to: '/analytics/csat', icon: '⭐', label: 'Client Satisfaction', module: 'analytics', permission: 'analytics:view_lead_analytics' },
        { id: 'analytics-delay', to: '/analytics/delay-analysis', icon: '⏱️', label: 'Delay Analysis', module: 'analytics', permission: 'analytics:view_project_analytics' },
        { id: 'analytics-boq', to: '/analytics/boq-variance', icon: '📊', label: 'Budget Variance', module: 'analytics', permission: 'analytics:view_project_analytics' },
        { id: 'analytics-resources', to: '/analytics/resources', icon: '👤', label: 'Team Capacity', module: 'analytics' },
        { id: 'analytics-resource-workload', to: '/analytics/resource-workload', icon: '👥', label: 'Team Workload', module: 'analytics' }
    ]}
  ]},
  { group: 'SALES SETUP', adminOnly: true, items: [
    { id: 'lead-stages', to: '/lead-stages', icon: '◎', label: 'Lead Stages', module: 'settings' },
    { id: 'custom-fields', to: '/custom-fields', icon: '⊡', label: 'Custom Fields', module: 'settings' },
    { id: 'lead-forms', to: '/leads/forms', icon: '📝', label: 'Lead Forms', module: 'leads' }
  ]},
  { group: 'PROJECT SETUP', adminOnly: true, items: [
    { id: 'templates', to: '/templates', icon: '◈', label: 'Project Templates', module: 'settings' },
    { id: 'trade-activities', to: '/trade-activities', icon: '🛠', label: 'Trade Activities', module: 'settings' },
    { id: 'qc-checklists', to: '/qc-checklists', icon: '☑', label: 'QC Checklists', module: 'settings' },
    { id: 'conversion-checklist', to: '/conversion-checklist', icon: '☑', label: 'Conversion Checklist', module: 'settings' },
    { id: 'automations', to: '/automations', icon: '⚙', label: 'Automations', module: 'settings' }
  ]},
  { group: 'PROJECT WORKFLOWS', items: [
    { id: 'coordination', to: '/projects/coordination', icon: '🔄', label: 'Project Coordination', module: 'projects' },
    { id: 'handover-dashboard', to: '/projects/handover-dashboard', icon: '📋', label: 'Handover Dashboard', module: 'projects' },
    { id: 'retention-dashboard', to: '/projects/retention-dashboard', icon: '🤝', label: 'Client Retention', module: 'projects' }
  ]},
  { group: 'TEAM MANAGEMENT', items: [
    { id: 'resource-capacity', to: '/projects/resources', icon: '👥', label: 'Team Capacity', module: 'projects' },
    { id: 'absences', to: '/projects/absences', icon: '🌴', label: 'Leave Management', module: 'projects' }
  ]},
  { group: 'VENDORS', items: [
    { id: 'vendor-performance', to: '/analytics/vendors', icon: '🤝', label: 'Vendor Performance', module: 'analytics' },
    { id: 'vendor-capacity', to: '/analytics/vendors-capacity', icon: '⚖️', label: 'Vendor Capacity', module: 'analytics' },
    { id: 'vendor-lead-times', to: '/vendor-lead-times', icon: '⏱', label: 'Vendor Lead Times', module: 'settings', adminOnly: true }
  ]},
  { group: 'FINANCE', items: [
    { id: 'finance-overview', to: '/finance', icon: '💰', label: 'Finance Overview', module: 'finance' },
    { id: 'financial-approvals', to: '/financial-approvals', icon: '📝', label: 'Financial Approvals', module: 'finance' },
    { id: 'analytics-profitability', to: '/analytics/profitability', icon: '💎', label: 'Project Profitability', module: 'analytics', permission: 'analytics:view_finance_analytics' },
    { id: 'analytics-collection-forecast', to: '/analytics/collection-forecast', icon: '📈', label: 'Payment Forecast', module: 'analytics', permission: 'analytics:view_finance_analytics' },
    { id: 'financial-thresholds', to: '/financial-settings', icon: '💰', label: 'Financial Thresholds', module: 'settings', adminOnly: true }
  ]},
  { group: 'TEAM & SECURITY', adminOnly: true, items: [
    { id: 'team-management', label: 'Team Management', icon: '👥', module: 'settings', subItems: [
        { id: 'team-members', to: '/team/members', icon: '◉', label: 'Team Members' },
        { id: 'roles-permissions', to: '/team/roles', icon: '🔑', label: 'Roles & Permissions' },
    ]},
    { id: 'organization', to: '/organization', icon: '🏢', label: 'Organization', module: 'settings' },
    { id: 'company-settings', to: '/settings/company', icon: '🏢', label: 'Company Settings', module: 'settings' },
    { id: 'login-history', to: '/login-history', icon: '🛡️', label: 'Login History', module: 'settings' },
    { id: 'audit-trail', to: '/settings/audit-trail', icon: '📜', label: 'Audit Trail', module: 'settings' }
  ]},
  { group: 'REPORTS', items: [
    { id: 'reports', to: '/reports', icon: '📋', label: 'Reports Hub', module: 'reports' }
  ]},
  { group: 'DEVELOPER TOOLS', adminOnly: true, items: [
    { id: 'superadmin', to: '/settings/superadmin', icon: '⚡', label: 'Super Admin Center', module: 'settings' },
    { id: 'api-keys', to: '/api-keys', icon: '⊙', label: 'API Keys', module: 'settings' },
    { id: 'api-integration', to: '/developer/api', icon: '🔌', label: 'API Integration', module: 'settings' },
    { id: 'webhooks', to: '/developer/webhooks', icon: '🪝', label: 'Webhooks', module: 'settings' },
    { id: 'email-templates', to: '/email-templates', icon: '📧', label: 'Email Templates', module: 'settings' },
    { id: 'logs', to: '/logs', icon: '≡', label: 'Logs', module: 'settings' },
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



const getInitials = (name) => {
  if (!name) return 'U'
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export default function Sidebar({ collapsed, mobileOpen, onClose }) {
  const { user } = useAuth()
  const [dynamicPlanTabs, setDynamicPlanTabs] = useState(user?.sidebarConfig?.planTabs || null)

  useEffect(() => {
    let isMounted = true
    const fetchSidebarConfig = async () => {
      try {
        const res = await api.get('/auth/sidebar-config')
        if (isMounted && res.data?.success && res.data?.data?.planTabs) {
          setDynamicPlanTabs(res.data.data.planTabs)
        }
      } catch (err) {
        // Fallback gracefully to user.sidebarConfig or defaults
      }
    }

    fetchSidebarConfig()

    const handleConfigUpdated = () => {
      fetchSidebarConfig()
    }

    window.addEventListener('app:sidebar-config-updated', handleConfigUpdated)
    window.addEventListener('app:auth-change', handleConfigUpdated)

    return () => {
      isMounted = false
      window.removeEventListener('app:sidebar-config-updated', handleConfigUpdated)
      window.removeEventListener('app:auth-change', handleConfigUpdated)
    }
  }, [user?.tenant?.id, user?.tenant?.plan])
  
  const isPlatformDeveloperAdmin = (user?.tenant?.slug === 'demo' || user?.email === 'admin@demo.com') && 
    (user?.role === 'superadmin' || user?.role?.name?.toLowerCase() === 'superadmin' || user?.role === 'admin' || user?.role?.name?.toLowerCase() === 'admin');

  const isAdmin = isPlatformDeveloperAdmin;

  const isWorkspaceAdmin = 
    isAdmin ||
    user?.role === 'superadmin' || 
    user?.role === 'admin' || 
    user?.role?.name?.toLowerCase() === 'superadmin' || 
    user?.role?.name?.toLowerCase() === 'super admin' || 
    user?.role?.name?.toLowerCase() === 'admin' ||
    user?.role?.name?.toLowerCase() === 'owner' ||
    (user?.role?.permissions && (user.role.permissions.includes('*') || user.role.permissions.includes('*:*')));

  const hasFinancePermission = isAdmin || (Array.isArray(user?.role?.permissions) && (
    user.role.permissions.includes('finance:invoices') ||
    user.role.permissions.includes('finance:payments') ||
    user.role.permissions.includes('finance:discounts') ||
    user.role.permissions.includes('finance:credits') ||
    user.role.permissions.includes('finance:view') ||
    user.role.permissions.some(p => p.startsWith('finance:')) ||
    (user?.role?.enabled_modules && user.role.enabled_modules.includes('finance'))
  )) || isWorkspaceAdmin;

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
      {/* Logo area */}
      <div className={styles.logo}>
        {user?.tenant?.logoUrl ? (
          <img src={user.tenant.logoUrl} alt="Logo" className={styles.logoImage} />
        ) : (
          <div className={styles.logoMark}>
            {user?.tenant?.name ? user.tenant.name.charAt(0).toUpperCase() : 'C'}
          </div>
        )}
        {!collapsed && <span className={styles.logoText}>{user?.tenant?.name || 'Interior CRM'}</span>}
      </div>

      {/* Nav groups */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map(group => {
          if (group.adminOnly && !isAdmin && !isWorkspaceAdmin) return null
          if (group.financeOnly && !hasFinancePermission) return null

          const filterItem = (item) => {
            // 1. Developer / Admin Bypass: Developers in the demo root workspace see all tabs immediately
            if (isAdmin) return true;

            // 2. Client Subscription Plan filtering: In client workspaces (like "interior hub"), strictly enforce the workspace's plan
            const tenantPlan = (user?.tenant?.plan || 'starter').toLowerCase();
            const planTabs = (dynamicPlanTabs && Array.isArray(dynamicPlanTabs) && dynamicPlanTabs.length > 0)
              ? dynamicPlanTabs
              : ((user?.sidebarConfig?.planTabs && Array.isArray(user.sidebarConfig.planTabs) && user.sidebarConfig.planTabs.length > 0)
                ? user.sidebarConfig.planTabs
                : (PLAN_DEFAULTS[tenantPlan] || PLAN_DEFAULTS.starter));

            if (planTabs && Array.isArray(planTabs)) {
              if (item.id && !planTabs.includes(item.id)) return false;
            }

            // 3. Workspace administrator has access to all enabled tabs in this workspace
            if (isWorkspaceAdmin) return true;

            // 4. For non-admin members, check adminOnly, permissions, and enabled modules
            if (item.adminOnly) return false;

            const perms = Array.isArray(user?.role?.permissions) ? user.role.permissions : [];
            const hasWildcard = perms.includes('*') || perms.includes('*:*');
            if (hasWildcard) return true;

            if (item.permission) {
              const [mod] = item.permission.split(':');
              const hasPerm = perms.includes(item.permission) || perms.includes(`${mod}:*`);
              if (!hasPerm) return false;
            }

            if (item.module) {
              const modules = user?.role?.enabled_modules;
              const hasModuleInPerms = perms.some(p => p.startsWith(`${item.module}:`));
              const hasModuleInList = modules && Array.isArray(modules) && modules.includes(item.module);
              if (!hasModuleInList && !hasModuleInPerms) return false;
            }

            return true;
          };

          const visibleItems = group.items.map(item => {
            if (item.subItems) {
              return { ...item, subItems: item.subItems.filter(filterItem) };
            }
            return item;
          }).filter(item => {
            if (item.subItems) {
              return item.subItems.length > 0;
            }
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

      <NavLink to="/settings/profile" className={styles.userCard} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className={styles.userAvatar}>{getInitials(user?.name)}</div>
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

