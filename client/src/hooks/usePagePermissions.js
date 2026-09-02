import { useAuth } from '../store/authContext';
import { PAGE_PERMISSIONS_SCHEMA } from '../constants/pagePermissions';
import { PLAN_DEFAULTS, getModulesForTabs } from '../constants/permissions';

const PAGE_MODULE_MAPPING = {
  'Financial Overview': 'finance',
  'Payments': 'finance',
  'Commercial Approval': 'finance',
  'Vendor Payments': 'finance',
  'Budget Variance': 'boq',
  'Budget': 'boq',
  'Quotations & Budget': 'boq',
  'Change Orders': 'change_orders',
  'Vendors & Consultants': 'vendors',
  'Vendors': 'vendors',
  'Purchase Requests': 'purchase_orders',
  'Purchase Orders': 'purchase_orders',
  'Factory Production': 'factory',
  'Material Deliveries': 'inventory',
  'Substitutions': 'inventory',
  'Design Brief': 'projects',
  'Design Assets': 'projects',
  'Design Reviews': 'design_reviews'
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
    const requiredModule = PAGE_MODULE_MAPPING[pageId];
    if (requiredModule && !allowedModules.has(requiredModule)) {
      return false;
    }

    // 2. Workspace Admin Check
    const rName = user.role.name?.toLowerCase();
    const isWorkspaceAdmin = user.role === 'superadmin' || rName === 'superadmin' || rName === 'super admin' || rName === 'admin' || rName === 'owner' || (user.role.permissions && (user.role.permissions.includes('*') || user.role.permissions.includes('*:*')));
    if (isWorkspaceAdmin) {
      return true;
    }
    
    const pagePermissions = user.role.page_permissions || {};
    const modulePages = pagePermissions[moduleName] || [];
    
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
