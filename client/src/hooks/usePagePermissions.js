import { useAuth } from '../store/authContext';
import { PAGE_PERMISSIONS_SCHEMA, getDynamicPagePermissionsSchema } from '../constants/pagePermissions';
import { PLAN_DEFAULTS, getModulesForTabs } from '../constants/permissions';

const PAGE_MODULE_MAPPING = {
  'Financial Overview': ['finance'],
  'Payments': ['payments', 'finance'],
  'Commercial Approval': ['finance'],
  'Vendor Payments': ['payments', 'finance'],
  'Budget Variance': ['boq', 'finance'],
  'Budget': ['boq', 'finance'],
  'Quotations & Budget': ['boq', 'quotations'],
  'Change Orders': ['change_orders'],
  'Vendors & Consultants': ['vendors'],
  'Vendors': ['vendors'],
  'Purchase Requests': ['purchase_orders'],
  'Purchase Orders': ['purchase_orders'],
  'Factory Production': ['factory'],
  'Material Deliveries': ['inventory', 'warehouse'],
  'Substitutions': ['inventory'],
  'Design Brief': ['projects'],
  'Design Assets': ['projects'],
  'Design Reviews': ['design_reviews']
};

export const usePagePermissions = (moduleName) => {
  const { user } = useAuth();
  
  const isPlatformDeveloperAdmin = (user?.tenant?.slug === 'demo' || user?.email === 'admin@demo.com') && 
    (user?.role === 'superadmin' || user?.role?.name?.toLowerCase() === 'superadmin' || user?.role === 'admin' || user?.role?.name?.toLowerCase() === 'admin');

  const tenantPlan = (user?.tenant?.plan || 'starter').toLowerCase();
  const planTabs = user?.sidebarConfig?.planTabs || PLAN_DEFAULTS[tenantPlan] || PLAN_DEFAULTS.starter;
  const allowedModules = new Set(getModulesForTabs(planTabs).map(m => m.id));

  const canAccessPage = (pageId) => {
    if (!user || !user.role) return false;

    // Platform developer bypass in root demo workspace
    if (isPlatformDeveloperAdmin) return true;

    // 1. Workspace Plan Module Check
    const reqModRaw = PAGE_MODULE_MAPPING[pageId];
    if (reqModRaw) {
      const reqMods = Array.isArray(reqModRaw) ? reqModRaw : [reqModRaw];
      const hasPlanAccess = reqMods.some(m => allowedModules.has(m));
      if (!hasPlanAccess) {
        return false;
      }
    }

    // 2. Workspace Admin Check
    const rName = user.role.name?.toLowerCase();
    const isWorkspaceAdmin = user.role === 'superadmin' || rName === 'superadmin' || rName === 'super admin' || rName === 'admin' || rName === 'owner' || (user.role.permissions && (user.role.permissions.includes('*') || user.role.permissions.includes('*:*')));
    if (isWorkspaceAdmin) {
      return true;
    }
    
    // 3. Role Level Enabled Modules Check
    if (reqModRaw && user.role.enabled_modules && Array.isArray(user.role.enabled_modules) && user.role.enabled_modules.length > 0) {
      const reqMods = Array.isArray(reqModRaw) ? reqModRaw : [reqModRaw];
      const hasRoleModuleAccess = reqMods.some(m => user.role.enabled_modules.includes(m));
      if (!hasRoleModuleAccess) {
        return false;
      }
    }

    const pagePermissions = user.role.page_permissions || {};
    const modulePages = pagePermissions[moduleName] || [];
    
    if (typeof pagePermissions[moduleName] === 'undefined' || !Array.isArray(modulePages) || modulePages.length === 0) {
      return true;
    }
    
    if (modulePages.includes(pageId)) {
      return true;
    }

    // Fallback: If pageId belongs to a module that is explicitly enabled in role.enabled_modules or role.page_permissions
    if (reqModRaw) {
      const reqMods = Array.isArray(reqModRaw) ? reqModRaw : [reqModRaw];
      const isRoleModuleEnabled = reqMods.some(m => user.role.enabled_modules?.includes(m));
      if (isRoleModuleEnabled) {
        const hasSpecificPageDenial = reqMods.some(m => {
          const mPages = pagePermissions[m];
          return Array.isArray(mPages) && mPages.length > 0 && !mPages.includes(pageId) && !mPages.includes(pageId.toLowerCase());
        });
        if (!hasSpecificPageDenial) {
          return true;
        }
      }
    }

    return false;
  };
  
  const getAllowedPages = () => {
    const dynamicSchema = getDynamicPagePermissionsSchema();
    const moduleSchema = dynamicSchema[moduleName] || PAGE_PERMISSIONS_SCHEMA[moduleName];
    if (!moduleSchema) return [];
    
    return moduleSchema.filter(page => canAccessPage(page.id));
  };
  
  return { canAccessPage, getAllowedPages };
};
