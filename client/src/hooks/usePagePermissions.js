import { useAuth } from '../store/authContext';
import { PAGE_PERMISSIONS_SCHEMA } from '../constants/pagePermissions';

export const usePagePermissions = (moduleName) => {
  const { user } = useAuth();
  
  const canAccessPage = (pageId) => {
    if (!user || !user.role) return false;
    
    // Superadmin override
    if (user.role.name === 'superadmin' || (user.role.permissions && user.role.permissions.includes('*'))) {
      return true;
    }
    
    const pagePermissions = user.role.page_permissions || {};
    const modulePages = pagePermissions[moduleName] || [];
    
    // If no explicit permissions exist for this module's pages, we fall back to permissive mode (all visible)
    // as per typical CRM implementation where unconfigured sub-pages are visible.
    // If the module exists in the permissions map but is empty, it means all are restricted.
    // However, for strict enforcement, let's treat an empty array as "no access" ONLY IF it's explicitly set.
    // If `pagePermissions[moduleName]` is undefined, it means this role was created before page permissions were a thing,
    // so we allow access to prevent breaking existing roles.
    if (typeof pagePermissions[moduleName] === 'undefined') {
      return true;
    }
    
    return modulePages.includes(pageId);
  };
  
  const getAllowedPages = () => {
    if (!PAGE_PERMISSIONS_SCHEMA[moduleName]) return [];
    
    return PAGE_PERMISSIONS_SCHEMA[moduleName].filter(page => canAccessPage(page.id));
  };
  
  return { canAccessPage, getAllowedPages };
};
