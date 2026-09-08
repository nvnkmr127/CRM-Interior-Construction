import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/authContext'
import { PLAN_DEFAULTS, MODULE_TAB_MAPPING } from '../../constants/permissions'
import { NAV_ITEMS } from '../../constants/navigation'
import api from '../../api/axios'
import styles from './Sidebar.module.css'

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
      className={({ isActive }) => {
        let isMatch = isActive;
        if (item.to && item.to.includes('?')) {
          isMatch = location.pathname + location.search === item.to;
        } else if (item.to && item.to === '/projects') {
          isMatch = location.pathname === '/projects' && (!location.search || location.search === '?view=grid' || location.search === '?view=list');
        }
        return `${styles.navItem} ${isMatch ? styles.active : ''}`;
      }}
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
              const modules = user?.role?.enabled_modules || [];
              const hasPerm = perms.includes(item.permission) || perms.includes(`${mod}:*`) || perms.includes(`${mod}:view`) || modules.includes(mod) || (item.id && modules.includes(item.id));
              if (!hasPerm) return false;
            }

            if (item.module) {
              const modules = user?.role?.enabled_modules || [];
              const itemMods = Array.isArray(item.module) ? item.module : [item.module];

              const hasModuleInPerms = itemMods.some(m => perms.some(p => p.startsWith(`${m}:`)));
              const hasModuleInList = itemMods.some(m => modules.includes(m)) || (item.id && modules.includes(item.id));

              const hasMappedModule = modules.some(m => {
                const tabs = MODULE_TAB_MAPPING[m] || [];
                return tabs.includes(item.id);
              });

              if (!hasModuleInList && !hasModuleInPerms && !hasMappedModule) return false;
            }

            // 5. Granular Page / Tab Permissions check: If role has specific page_permissions set for the module
            const pagePerms = user?.role?.page_permissions || {};
            const itemMods = Array.isArray(item.module) ? item.module : (item.module ? [item.module] : []);
            for (const mod of itemMods) {
              if (pagePerms[mod] && Array.isArray(pagePerms[mod]) && pagePerms[mod].length > 0) {
                if (!pagePerms[mod].includes(item.id)) return false;
              }
            }

            return true;
          };

          const visibleItems = group.items.map(item => {
            if (item.subItems) {
              const parentModule = item.module;
              const filteredSubItems = item.subItems.map(sub => ({
                ...sub,
                module: sub.module || parentModule
              })).filter(filterItem);
              return { ...item, subItems: filteredSubItems };
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

