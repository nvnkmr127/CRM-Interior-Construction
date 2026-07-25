import { useAuth } from '../store/authContext';

export const usePermissions = () => {
  const { user } = useAuth();

  const hasPermission = (module, action) => {
    if (!user || !user.role) return false;

    // Superadmin override
    if (user.role.name === 'superadmin' || (user.role.permissions && user.role.permissions.includes('*'))) {
      return true;
    }

    const permissions = user.role.permissions || [];
    return permissions.includes(`${module}:${action}`);
  };

  const isModuleEnabled = (module) => {
    if (!user || !user.role) return false;

    if (user.role.name === 'superadmin' || (user.role.permissions && user.role.permissions.includes('*'))) {
      return true;
    }

    const enabledModules = user.role.enabled_modules || [];
    return enabledModules.includes(module);
  };

  return { hasPermission, isModuleEnabled };
};
