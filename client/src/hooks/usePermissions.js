import { useAuth } from '../store/authContext';
import { PLAN_DEFAULTS, getModulesForTabs } from '../constants/permissions';

export const usePermissions = () => {
  const { user } = useAuth();

  const isPlatformDeveloperAdmin = (user?.tenant?.slug === 'demo' || user?.email === 'admin@demo.com') && 
    (user?.role === 'superadmin' || user?.role?.name?.toLowerCase() === 'superadmin' || user?.role === 'admin' || user?.role?.name?.toLowerCase() === 'admin');

  const tenantPlan = (user?.tenant?.plan || 'starter').toLowerCase();
  const planTabs = user?.sidebarConfig?.planTabs || PLAN_DEFAULTS[tenantPlan] || PLAN_DEFAULTS.starter;
  const allowedModules = new Set(getModulesForTabs(planTabs).map(m => m.id));

  const hasPermission = (module, action) => {
    if (!user || !user.role) return false;

    // Platform developer bypass in root demo workspace
    if (isPlatformDeveloperAdmin) return true;

    // Workspace-level plan module restriction
    if (module && !allowedModules.has(module)) return false;

    const rName = user.role.name?.toLowerCase();
    const isWorkspaceAdmin = user.role === 'superadmin' || rName === 'superadmin' || rName === 'super admin' || rName === 'admin' || rName === 'owner' || (user.role.permissions && (user.role.permissions.includes('*') || user.role.permissions.includes('*:*')));
    if (isWorkspaceAdmin) return true;

    const permissions = Array.isArray(user.role.permissions) ? user.role.permissions : [];
    return permissions.includes(`${module}:${action}`) || permissions.includes(`${module}:*`) || permissions.includes('*');
  };

  const isModuleEnabled = (module) => {
    if (!user || !user.role) return false;

    // Platform developer bypass in root demo workspace
    if (isPlatformDeveloperAdmin) return true;

    // Workspace-level plan module restriction
    if (module && !allowedModules.has(module)) return false;

    const rName = user.role.name?.toLowerCase();
    const isWorkspaceAdmin = user.role === 'superadmin' || rName === 'superadmin' || rName === 'super admin' || rName === 'admin' || rName === 'owner' || (user.role.permissions && (user.role.permissions.includes('*') || user.role.permissions.includes('*:*')));
    if (isWorkspaceAdmin) return true;

    const enabledModules = user.role.enabled_modules || [];
    return enabledModules.includes(module);
  };

  return { hasPermission, isModuleEnabled, allowedModules, planTabs };
};
