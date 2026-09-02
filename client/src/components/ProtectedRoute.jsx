import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/authContext'
import { PLAN_DEFAULTS, getModulesForTabs } from '../constants/permissions'
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

  const isPlatformDeveloperAdmin = (user?.tenant?.slug === 'demo' || user?.email === 'admin@demo.com') && 
    (user?.role === 'superadmin' || user?.role?.name?.toLowerCase() === 'superadmin' || user?.role === 'admin' || user?.role?.name?.toLowerCase() === 'admin');

  // Platform developer superadmin in demo workspace has full bypass
  if (isPlatformDeveloperAdmin) {
    return children;
  }

  // 1. Workspace Plan Tabs & Modules Enforcement
  const tenantPlan = (user?.tenant?.plan || 'starter').toLowerCase();
  const planTabs = user?.sidebarConfig?.planTabs || PLAN_DEFAULTS[tenantPlan] || PLAN_DEFAULTS.starter;
  const allowedModules = new Set(getModulesForTabs(planTabs).map(m => m.id));

  if (requiredTab && planTabs && Array.isArray(planTabs) && !planTabs.includes(requiredTab)) {
    return <Navigate to='/forbidden' replace />
  }

  if (requiredModule && !allowedModules.has(requiredModule)) {
    return <Navigate to='/forbidden' replace />
  }

  // 2. Workspace Admin Check (Access to all enabled items within this workspace plan)
  const roleName = (typeof user?.role === 'string' ? user.role : user?.role?.name || user?.role_name || '').toLowerCase().replace(/[\s_-]+/g, '');
  const perms = Array.isArray(user?.role?.permissions) 
    ? user.role.permissions 
    : (Array.isArray(user?.permissions) ? user.permissions : []);

  const isWorkspaceAdmin = 
    roleName === 'superadmin' || 
    roleName === 'admin' || 
    roleName === 'owner' ||
    roleName.includes('admin') ||
    perms.includes('*') ||
    perms.includes('*:*') ||
    perms.includes('all');

  if (isWorkspaceAdmin) {
    return children;
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
    const enabledModules = user?.role?.enabled_modules || [];
    const hasModulePerm = perms.some(p => p.startsWith(`${requiredModule}:`) || p === '*' || p === `${requiredModule}`);
    const isModuleAllowed = enabledModules.length === 0 
      ? (hasModulePerm || ['dashboards', 'tasks'].includes(requiredModule)) 
      : (enabledModules.includes(requiredModule) || hasModulePerm || ['dashboards', 'tasks'].includes(requiredModule));

    if (!isModuleAllowed) {
      return <Navigate to='/forbidden' replace />
    }
  }

  return children
}
