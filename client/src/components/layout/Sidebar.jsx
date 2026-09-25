import { useState, useEffect, useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/authContext'
import { PLAN_DEFAULTS, MODULE_TAB_MAPPING, isTabPermitted } from '../../constants/permissions'
import { NAV_ITEMS } from '../../constants/navigation'
import api from '../../api/axios'
import { isSuperMasterDeveloper } from '../../utils/isSuperMasterDeveloper'
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
  const [dynamicPlanTabs, setDynamicPlanTabs] = useState(() => {
    try {
      const cached = sessionStorage.getItem('crm:sidebar-config');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return user?.sidebarConfig?.planTabs || null;
  })
  const [logoFailed, setLogoFailed] = useState(false)

  const tenantLogo = user?.tenant?.logoUrl || user?.tenant?.logo_url || user?.tenant?.logo

  useEffect(() => {
    setLogoFailed(false)
  }, [tenantLogo])

  useEffect(() => {
    let isMounted = true
    const fetchSidebarConfig = async () => {
      try {
        const res = await api.get('/auth/sidebar-config')
        if (isMounted && res.data?.success && res.data?.data?.planTabs) {
          setDynamicPlanTabs(res.data.data.planTabs);
          try {
            sessionStorage.setItem('crm:sidebar-config', JSON.stringify(res.data.data.planTabs));
          } catch (e) {}
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
    window.addEventListener('app:tenant-updated', handleConfigUpdated)
    window.addEventListener('app:auth-change', handleConfigUpdated)

    return () => {
      isMounted = false
      window.removeEventListener('app:sidebar-config-updated', handleConfigUpdated)
      window.removeEventListener('app:tenant-updated', handleConfigUpdated)
      window.removeEventListener('app:auth-change', handleConfigUpdated)
    }
  }, [user?.tenant?.id, user?.tenant?.plan])
  
  const isPlatformDeveloperAdmin = isSuperMasterDeveloper(user);

  const isAdmin = isPlatformDeveloperAdmin;

  const isWorkspaceAdmin = 
    isAdmin ||
    user?.role === 'superadmin' || 
    user?.role === 'admin' || 
    user?.role?.name?.toLowerCase() === 'superadmin' || 
    user?.role?.name?.toLowerCase() === 'super admin' || 
    (typeof user?.role === 'string' && user?.role?.toLowerCase() === 'admin') ||
    user?.role?.name?.toLowerCase() === 'owner' ||
    (Array.isArray(user?.role?.permissions) && (user.role.permissions.includes('*') || user.role.permissions.includes('*:*')));

  const hasFinancePermission = isAdmin || (Array.isArray(user?.role?.permissions) && (
    user.role.permissions.includes('finance:invoices') ||
    user.role.permissions.includes('finance:payments') ||
    user.role.permissions.includes('finance:discounts') ||
    user.role.permissions.includes('finance:credits') ||
    user.role.permissions.includes('finance:view') ||
    user.role.permissions.some(p => p.startsWith('finance:')) ||
    (user?.role?.enabled_modules && user.role.enabled_modules.includes('finance'))
  )) || isWorkspaceAdmin;

  const renderedNavGroups = useMemo(() => {
    return NAV_ITEMS.map(group => {
      // Developer-only groups (Developer Tools) are strictly for the platform developer
      if ((group.developerOnly || group.group === 'DEVELOPER TOOLS') && !isAdmin) {
        return null;
      }

      if (group.adminOnly && !isAdmin && !isWorkspaceAdmin) {
        const hasAnyGroupItemGranted = group.items.some(item => {
          if (item.id === 'absences') return true;
          const modules = user?.role?.enabled_modules || [];
          const perms = Array.isArray(user?.role?.permissions) ? user.role.permissions : [];
          return modules.includes(item.id) || perms.includes(item.id) || perms.includes(`${item.id}:view`);
        });
        if (!hasAnyGroupItemGranted) return null;
      }
      if (group.financeOnly && !hasFinancePermission) return null;

      const filterItem = (item) => {
        // 1. Developer / Admin Bypass: Superadmin / Developer sees all tabs immediately
        if (isAdmin) return true;

        // Developer-only tabs are strictly restricted to the platform developer
        if (item.developerOnly) return false;

        return isTabPermitted(item, user, dynamicPlanTabs);
      };

      const visibleItems = group.items.map(item => {
        if (item.subItems) {
          if (!filterItem(item)) return null;
          const parentModule = item.module;
          const filteredSubItems = item.subItems.map(sub => ({
            ...sub,
            module: sub.module || parentModule
          })).filter(filterItem);
          return { ...item, subItems: filteredSubItems };
        }
        return item;
      }).filter(item => {
        if (!item) return false;
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
      );
    });
  }, [isAdmin, isWorkspaceAdmin, hasFinancePermission, user, dynamicPlanTabs, collapsed, onClose]);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
      {/* Logo area */}
      <div className={styles.logo}>
        {tenantLogo && !logoFailed ? (
          <img 
            src={tenantLogo} 
            alt={user?.tenant?.name || 'Logo'} 
            className={styles.logoImage} 
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div 
            className={styles.logoMark}
            style={user?.tenant?.accentColour || user?.tenant?.accent_colour ? { background: user?.tenant?.accentColour || user?.tenant?.accent_colour } : {}}
          >
            {user?.tenant?.name ? user.tenant.name.charAt(0).toUpperCase() : 'C'}
          </div>
        )}
        {!collapsed && <span className={styles.logoText}>{user?.tenant?.name || 'Interior CRM'}</span>}
      </div>

      {/* Nav groups */}
      <nav className={styles.nav}>
        {renderedNavGroups}
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

