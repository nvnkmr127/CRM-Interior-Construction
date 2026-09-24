import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/authContext'
import { PLAN_DEFAULTS, getModulesForTabs, getDefaultRouteForUser } from '../constants/permissions'
import { isSuperMasterDeveloper } from '../utils/isSuperMasterDeveloper'
import Spinner from './ui/Spinner'
import styles from './ProtectedRoute.module.css'

export default function ProtectedRoute({ children, requiredPermission, requiredModule, requiredTab }) {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size='lg' />
        <span>Loading...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to='/login' replace />
  }

  const isPlatformDeveloperAdmin = isSuperMasterDeveloper(user);

  // Platform developer superadmin in demo workspace or inspecting workspace has full bypass
  if (isPlatformDeveloperAdmin) {
    return children;
  }

  // Developer-only tools are strictly restricted to the master platform developer
  const DEVELOPER_TABS = ['superadmin', 'api-keys', 'api-integration', 'webhooks'];
  if (requiredTab && DEVELOPER_TABS.includes(requiredTab)) {
    return <Navigate to='/forbidden' replace />;
  }

  // 1. Workspace Plan Tabs & Modules Enforcement
  const tenantPlan = (user?.tenant?.plan || 'starter').toLowerCase();
  const planTabs = user?.sidebarConfig?.planTabs || PLAN_DEFAULTS[tenantPlan] || PLAN_DEFAULTS.starter;
  const allowedModules = new Set(getModulesForTabs(planTabs).map(m => m.id));

  const roleEnabledMods = user?.role?.enabled_modules || [];
  const rolePerms = Array.isArray(user?.role?.permissions) 
    ? user.role.permissions 
    : (Array.isArray(user?.permissions) ? user.permissions : []);

  const isTabExplicitlyRoleGranted = requiredTab && (
    roleEnabledMods.includes(requiredTab) || 
    rolePerms.includes(requiredTab) || 
    rolePerms.includes(`${requiredTab}:view`)
  );

  if (requiredTab && planTabs && Array.isArray(planTabs) && !planTabs.includes(requiredTab) && !isTabExplicitlyRoleGranted) {
    if (requiredTab === 'dashboard' || requiredTab === 'dashboards') {
      const defaultRoute = getDefaultRouteForUser(user, planTabs);
      return <Navigate to={defaultRoute} replace />
    }
    return <Navigate to='/forbidden' replace />
  }

  if (requiredModule && !allowedModules.has(requiredModule) && !isTabExplicitlyRoleGranted) {
    if (requiredModule === 'dashboards') {
      const defaultRoute = getDefaultRouteForUser(user, planTabs);
      return <Navigate to={defaultRoute} replace />
    }
    return <Navigate to='/forbidden' replace />
  }

  // 2. Workspace Admin Check (Access to all enabled items within this workspace plan)
  const roleName = (typeof user?.role === 'string' ? user.role : user?.role?.name || user?.role_name || '').toLowerCase().trim();
  const perms = Array.isArray(user?.role?.permissions) 
    ? user.role.permissions 
    : (Array.isArray(user?.permissions) ? user.permissions : []);

  const isWorkspaceAdmin = 
    roleName === 'superadmin' || 
    roleName === 'admin' || 
    roleName === 'owner' ||
    roleName === 'super admin' ||
    perms.includes('*') ||
    perms.includes('*:*') ||
    perms.includes('all');

  if (isWorkspaceAdmin) {
    return children;
  }

  const enabledModules = user?.role?.enabled_modules || [];

  // If a specific tab is required, enforce tab access
  if (requiredTab) {
    const isTabGranted = enabledModules.includes(requiredTab) || 
      (requiredTab === 'dashboard' && (enabledModules.includes('dashboards') || perms.includes('dashboards') || perms.some(p => p.startsWith('dashboards:')))) ||
      perms.includes(requiredTab) || 
      perms.includes(`${requiredTab}:view`) || 
      perms.some(p => p.startsWith(`${requiredTab}:`)) ||
      requiredTab === 'absences'; // Dedicated Leave Management portal accessible to team members by default
    
    if (isTabGranted) {
      return children;
    } else {
      // If the dashboard was requested but user is not permitted, redirect them to their default allotted tab!
      if (requiredTab === 'dashboard' || requiredTab === 'dashboards') {
        const defaultRoute = getDefaultRouteForUser(user, planTabs);
        return <Navigate to={defaultRoute} replace />
      }
      return <Navigate to='/forbidden' replace />
    }
  }

  // 3. Member-level Permission & Module Checks
  if (requiredPermission) {
    const [mod] = requiredPermission.split(':');
    const hasPerm = perms.includes(requiredPermission) || perms.includes(`${mod}:*`) || perms.includes('*');
    if (!hasPerm) {
      return <Navigate to='/forbidden' replace />
    }
  }

  if (requiredModule) {
    const hasModulePerm = perms.some(p => p.startsWith(`${requiredModule}:`) || p === '*' || p === `${requiredModule}`);
    const isModuleAllowed = enabledModules.length === 0 
      ? (hasModulePerm || ['tasks', 'profile'].includes(requiredModule)) 
      : (enabledModules.includes(requiredModule) || hasModulePerm || ['tasks', 'profile'].includes(requiredModule));

    if (!isModuleAllowed) {
      if (requiredModule === 'dashboards') {
        const defaultRoute = getDefaultRouteForUser(user, planTabs);
        return <Navigate to={defaultRoute} replace />
      }
      return <Navigate to='/forbidden' replace />
    }
  }

  return children
}
