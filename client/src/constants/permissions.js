import { NAV_ITEMS } from './navigation.js'
import { isSuperMasterDeveloper } from '../utils/isSuperMasterDeveloper.js'

export const PERMISSION_MODULES = [
  { id: 'leads', label: 'Leads' },
  { id: 'projects', label: 'Projects' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'clients', label: 'Clients' },
  { id: 'payments', label: 'Payments' },
  { id: 'quotations', label: 'Quotations' },
  { id: 'boq', label: 'BOQ' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'purchase_orders', label: 'Purchase Orders' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'factory', label: 'Factory' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'discounts', label: 'Discounts' },
  { id: 'material_requests', label: 'Material Requests' },
  { id: 'change_orders', label: 'Extra Work (Change Orders)' },
  { id: 'design_reviews', label: 'Design Revisions' },
  { id: 'finance', label: 'Finance & Accounts' },
  { id: 'dashboards', label: 'Dashboards' },
  { id: 'users', label: 'Users Management' },
];

const MODULE_DEFAULT_GROUPS = {
  dashboards: 'WORKSPACE',
  leads: 'WORKSPACE',
  projects: 'WORKSPACE',
  tasks: 'WORKSPACE',
  clients: 'WORKSPACE',
  quotations: 'WORKSPACE',
  boq: 'PROJECT WORKFLOWS',
  vendors: 'VENDORS',
  purchase_orders: 'VENDORS',
  inventory: 'VENDORS',
  warehouse: 'VENDORS',
  factory: 'VENDORS',
  analytics: 'ANALYTICS',
  reports: 'REPORTS',
  settings: 'TEAM & SECURITY',
  invoices: 'FINANCE',
  payments: 'FINANCE',
  discounts: 'FINANCE',
  finance: 'FINANCE',
  material_requests: 'PROJECT WORKFLOWS',
  change_orders: 'PROJECT WORKFLOWS',
  design_reviews: 'PROJECT WORKFLOWS',
  users: 'TEAM MANAGEMENT'
};

export const getDynamicPermissionModules = () => {
  const modulesMap = new Map();

  // Process NAV_ITEMS dynamically - extract every active tab & sub-tab present in the main sidebar
  if (NAV_ITEMS && Array.isArray(NAV_ITEMS)) {
    NAV_ITEMS.forEach(group => {
      // Exclude developer-only groups from general role permission manager
      if (group.developerOnly || group.group === 'DEVELOPER TOOLS') return;

      const groupName = group.group || 'WORKSPACE';
      if (group.items && Array.isArray(group.items)) {
        group.items.forEach(item => {
          if (item.developerOnly) return;

          if (item.subItems && Array.isArray(item.subItems) && item.subItems.length > 0) {
            item.subItems.forEach(sub => {
              if (sub.id && !sub.developerOnly) {
                const parentPrefix = item.label && !sub.label.toLowerCase().includes(item.label.toLowerCase()) ? `${item.label} ` : '';
                modulesMap.set(sub.id, {
                  id: sub.id,
                  label: `${parentPrefix}${sub.label || sub.id}`,
                  group: groupName,
                  module: sub.module || item.module
                });
              }
            });
          } else if (item.id) {
            modulesMap.set(item.id, {
              id: item.id,
              label: item.label || item.id,
              group: groupName,
              module: item.module
            });
          }
        });
      }
    });
  }

  return Array.from(modulesMap.values());
};

export const PERMISSION_ACTIONS = [
  { id: 'view', label: 'View' },
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'delete', label: 'Delete' },
  { id: 'archive', label: 'Archive' },
  { id: 'restore', label: 'Restore' },
  { id: 'assign', label: 'Assign' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'approve', label: 'Approve' },
  { id: 'export_excel', label: 'Export Excel' },
  { id: 'export_csv', label: 'Export CSV' },
  { id: 'export_pdf', label: 'Export PDF' },
  { id: 'import', label: 'Import' },
  { id: 'print', label: 'Print' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'compare_versions', label: 'Compare Versions' },
  { id: 'bulk_update', label: 'Bulk Update' },
  { id: 'bulk_delete', label: 'Bulk Delete' },
  { id: 'merge', label: 'Merge Records' },
  { id: 'send_email', label: 'Send Email' },
  { id: 'send_sms', label: 'Send SMS' },
  { id: 'upload_documents', label: 'Upload Documents' },
  { id: 'view_contracts', label: 'View Contracts' },
  { id: 'manage_payments', label: 'Manage Payments' },
  { id: 'refund', label: 'Refund' },
  { id: 'view_cost', label: 'View Cost' },
  { id: 'view_profit', label: 'View Profit' },
  { id: 'view_margin', label: 'View Margin' },
  { id: 'view_discount', label: 'View Discount' },
  { id: 'approve_discount', label: 'Approve Discount' },
  { id: 'manage_gst', label: 'Manage GST' },
  { id: 'manage_taxes', label: 'Manage Taxes' },
  { id: 'export_finance', label: 'Export Finance Reports' },
  
  // Warehouse Actions
  { id: 'inventory_view', label: 'Inventory View' },
  { id: 'stock_adjustment', label: 'Stock Adjustment' },
  { id: 'issue_material', label: 'Issue Material' },
  { id: 'receive_material', label: 'Receive Material' },
  { id: 'transfer_stock', label: 'Transfer Stock' },
  { id: 'audit', label: 'Audit' },
  { id: 'view_reports', label: 'View Reports' },

  // Factory Actions
  { id: 'production_planning', label: 'Production Planning' },
  { id: 'production_status', label: 'Production Status' },
  { id: 'assign_workers', label: 'Assign Workers' },
  { id: 'quality_check', label: 'Quality Check' },
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'material_allocation', label: 'Material Allocation' },

  // Dashboards Actions
  { id: 'view_sales_dashboard', label: 'View Sales Dashboard' },
  { id: 'view_project_dashboard', label: 'View Project Dashboard' },
  { id: 'view_finance_dashboard', label: 'View Finance Dashboard' },
  { id: 'view_factory_dashboard', label: 'View Factory Dashboard' },
  { id: 'view_warehouse_dashboard', label: 'View Warehouse Dashboard' },
  { id: 'view_management_dashboard', label: 'View Management Dashboard' },

  // Analytics Actions
  { id: 'view_lead_analytics', label: 'View Lead Analytics' },
  { id: 'view_project_analytics', label: 'View Project Analytics' },
  { id: 'view_finance_analytics', label: 'View Finance Analytics' },
  { id: 'view_inventory_analytics', label: 'View Inventory Analytics' },

  // Report Actions
  { id: 'schedule', label: 'Schedule' },
  { id: 'share', label: 'Share' },

  // User Management Actions
  { id: 'invite_user', label: 'Invite User' },
  { id: 'deactivate_user', label: 'Deactivate User' },
  { id: 'activate_user', label: 'Activate User' },
  { id: 'reset_password', label: 'Reset Password' },
  { id: 'assign_roles', label: 'Assign Roles' },
  { id: 'change_department', label: 'Change Department' },
  { id: 'transfer_ownership', label: 'Transfer Ownership' },
  { id: 'force_logout', label: 'Force Logout' },
  { id: 'view_login_history', label: 'View Login History' },
  { id: 'delete_user', label: 'Delete User' }
];

export const DATA_SCOPES = [
  { id: 'own', label: 'Own Records', description: 'Can only access records they created or are directly assigned to.' },
  { id: 'assigned', label: 'Assigned Records', description: 'Can only access records specifically assigned to them.' },
  { id: 'team', label: 'Team Records', description: 'Can access records owned by anyone in their immediate team.' },
  { id: 'department', label: 'Department Records', description: 'Can access records owned by anyone in their department.' },
  { id: 'branch', label: 'Branch Records', description: 'Can access records owned by anyone in their branch.' },
  { id: 'all', label: 'Company Records (All)', description: 'Can access all records across the entire company.' },
  { id: 'specific_branches', label: 'Specific Branches', description: 'Can access records owned by users in explicitly selected branches.' },
  { id: 'specific_departments', label: 'Specific Departments', description: 'Can access records owned by users in explicitly selected departments.' }
];

export const PLAN_DEFAULTS = {
  starter: [
    'dashboard', 'leads', 'leads-dashboard', 'leads-list', 'leads-kanban', 'leads-calendar', 'leads-map',
    'projects', 'tasks', 'reports', 'analytics', 'analytics-leads', 'analytics-projects', 'analytics-csat',
    'analytics-delay', 'analytics-boq', 'analytics-resources', 'analytics-resource-workload',
    'coordination', 'handover-dashboard', 'retention-dashboard',
    'resource-capacity', 'absences', 'inventory', 'factory-production', 'vendor-performance', 'vendor-capacity',
    'finance-overview', 'financial-approvals', 'analytics-profitability', 'analytics-collection-forecast',
    'team-management', 'team-members', 'roles-permissions', 'organization', 'email-templates', 'logs'
  ],
  growth: [
    'dashboard', 'leads', 'leads-dashboard', 'leads-list', 'leads-kanban', 'leads-calendar', 'leads-map',
    'projects', 'tasks', 'reports', 'analytics', 'analytics-leads', 'analytics-projects', 'analytics-csat',
    'analytics-delay', 'coordination', 'handover-dashboard', 'retention-dashboard', 'resource-capacity',
    'absences', 'inventory', 'factory-production', 'vendor-performance', 'vendor-capacity',
    'finance-overview', 'financial-approvals', 'team-management', 'team-members',
    'roles-permissions', 'organization', 'email-templates', 'logs'
  ],
  enterprise: [
    'dashboard', 'leads', 'leads-dashboard', 'leads-list', 'leads-kanban', 'leads-calendar', 'leads-map',
    'projects', 'tasks', 'reports', 'analytics', 'analytics-leads', 'analytics-projects', 'analytics-csat',
    'analytics-delay', 'analytics-boq', 'analytics-resources', 'analytics-resource-workload',
    'lead-stages', 'custom-fields', 'lead-forms', 'templates', 'trade-activities', 'qc-checklists',
    'conversion-checklist', 'automations', 'coordination', 'handover-dashboard', 'retention-dashboard',
    'resource-capacity', 'absences', 'inventory', 'factory-production', 'vendor-performance', 'vendor-capacity', 'vendor-lead-times',
    'finance-overview', 'financial-approvals', 'analytics-profitability', 'analytics-collection-forecast',
    'financial-thresholds', 'team-management', 'team-members', 'roles-permissions', 'organization',
    'login-history', 'audit-trail', 'email-templates', 'logs'
  ]
};

export const MODULE_TAB_MAPPING = {
  dashboards: ['dashboard'],
  leads: ['leads', 'leads-dashboard', 'leads-list', 'leads-kanban', 'leads-calendar', 'leads-map', 'lead-stages', 'custom-fields', 'lead-forms'],
  projects: ['projects', 'templates', 'trade-activities', 'qc-checklists', 'conversion-checklist', 'automations', 'coordination', 'handover-dashboard', 'retention-dashboard', 'resource-capacity', 'absences'],
  tasks: ['tasks'],
  clients: ['clients', 'leads', 'projects', 'retention-dashboard'],
  quotations: ['quotations', 'projects', 'leads'],
  reports: ['reports'],
  users: ['users', 'team-management', 'team-members', 'roles-permissions'],
  settings: ['organization', 'company-settings', 'login-history', 'audit-trail', 'superadmin', 'api-keys', 'api-integration', 'webhooks', 'email-templates', 'logs', 'lead-stages', 'custom-fields', 'templates', 'trade-activities', 'qc-checklists', 'conversion-checklist', 'automations', 'vendor-lead-times', 'financial-thresholds', 'roles-permissions', 'team-management', 'team-members'],
  analytics: ['analytics', 'analytics-leads', 'analytics-projects', 'analytics-csat', 'analytics-delay', 'analytics-boq', 'analytics-resources', 'analytics-resource-workload', 'analytics-profitability', 'analytics-collection-forecast', 'vendor-performance', 'vendor-capacity'],
  finance: ['finance', 'projects', 'finance-overview', 'financial-approvals', 'analytics-profitability', 'analytics-collection-forecast', 'financial-thresholds'],
  invoices: ['finance-overview', 'financial-approvals'],
  payments: ['payments', 'projects', 'finance-overview', 'financial-approvals', 'analytics-collection-forecast'],
  discounts: ['discounts', 'financial-approvals', 'finance-overview'],
  vendors: ['vendors', 'vendor-performance', 'vendor-capacity', 'vendor-lead-times'],
  purchase_orders: ['purchase_orders', 'vendor-performance', 'vendor-capacity', 'vendor-lead-times', 'finance-overview'],
  inventory: ['inventory', 'vendor-capacity', 'resource-capacity', 'coordination'],
  warehouse: ['warehouse', 'inventory', 'vendor-capacity', 'coordination'],
  factory: ['factory', 'factory-production', 'coordination', 'projects'],
  boq: ['boq', 'projects', 'analytics-boq'],
  material_requests: ['material_requests', 'coordination', 'projects'],
  change_orders: ['change_orders', 'projects', 'financial-approvals'],
  design_reviews: ['design_reviews', 'projects', 'coordination']
};

export const getModulesForTabs = (enabledTabs = []) => {
  if (!Array.isArray(enabledTabs) || enabledTabs.length === 0) return PERMISSION_MODULES;
  return PERMISSION_MODULES.filter(mod => {
    const requiredTabs = MODULE_TAB_MAPPING[mod.id];
    if (!requiredTabs) return true;
    return requiredTabs.some(t => enabledTabs.includes(t));
  });
};

/**
 * Generates all possible permission strings (e.g., 'leads:view')
 */
export const getAllAvailablePermissions = () => {
  const permissions = [];
  for (const mod of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      permissions.push(`${mod.id}:${action.id}`);
    }
  }
  return permissions;
};

/**
 * Validates a single permission string against the schema
 */
export const isValidPermission = (perm) => {
  if (perm === '*') return true;
  const [mod, action] = perm.split(':');
  const validMod = PERMISSION_MODULES.some(m => m.id === mod);
  const validAction = PERMISSION_ACTIONS.some(a => a.id === action);
  return validMod && validAction;
};

export const ACTION_DEPENDENCIES = {
  'delete': ['view', 'edit'],
  'edit': ['view'],
  'create': ['view'],
  'archive': ['view', 'edit'],
  'export_excel': ['view'],
  'export_csv': ['view'],
  'export_pdf': ['view'],
  'export_finance': ['view'],
  'print': ['view'],
  'duplicate': ['view', 'create'],
  'approve': ['view'],
  'assign': ['view'],
  'transfer': ['view'],
  'restore': ['view', 'edit'],
  'bulk_update': ['view', 'edit'],
  'bulk_delete': ['view', 'delete']
};

export const isTabPermitted = (item, user, planTabs = null) => {
  if (!user || !item) return false;

  const isPlatformDeveloperAdmin = isSuperMasterDeveloper(user);

  const isAdmin = isPlatformDeveloperAdmin;

  const roleName = (typeof user?.role === 'string' ? user.role : user?.role?.name || user?.role_name || '').toLowerCase().trim();
  const perms = Array.isArray(user?.role?.permissions) 
    ? user.role.permissions 
    : (Array.isArray(user?.permissions) ? user.permissions : []);

  const isWorkspaceAdmin = 
    isAdmin ||
    roleName === 'superadmin' || 
    roleName === 'admin' || 
    roleName === 'owner' ||
    roleName === 'super admin' ||
    (typeof user?.role === 'string' && user?.role?.toLowerCase() === 'admin') ||
    perms.includes('*') ||
    perms.includes('*:*') ||
    perms.includes('all');

  // 1. Developer / Admin Bypass: Superadmin / Developer sees all tabs immediately
  if (isAdmin) return true;

  // Developer-only tabs are never shown to client workspaces
  const DEVELOPER_TABS = ['superadmin', 'api-keys', 'api-integration', 'webhooks'];
  if (item.developerOnly || DEVELOPER_TABS.includes(item.id)) {
    return false;
  }

  // 2. Universal Team Member Portal Bypass: Leave Management must be present in every team member portal by default
  if (item.id === 'absences') return true;

  const modules = Array.isArray(user?.role?.enabled_modules)
    ? user.role.enabled_modules
    : (Array.isArray(user?.enabled_modules)
      ? user.enabled_modules
      : (Array.isArray(user?.role?.modules) ? user.role.modules : []));

  const isTabExplicitlyRoleGranted = item.id && (
    modules.includes(item.id) || 
    perms.includes(item.id) || 
    perms.includes(`${item.id}:view`) ||
    (item.subItems && Array.isArray(item.subItems) && item.subItems.some(sub => modules.includes(sub.id) || perms.includes(sub.id) || perms.includes(`${sub.id}:view`)))
  );

  // 3. Subscription Plan filtering for all client accounts (including workspace admins)
  const tenantPlan = (user?.tenant?.plan || 'starter').toLowerCase();
  const effectivePlanTabs = (planTabs && Array.isArray(planTabs) && planTabs.length > 0)
    ? planTabs
    : ((user?.sidebarConfig?.planTabs && Array.isArray(user.sidebarConfig.planTabs) && user.sidebarConfig.planTabs.length > 0)
      ? user.sidebarConfig.planTabs
      : (PLAN_DEFAULTS[tenantPlan] || PLAN_DEFAULTS.starter));

  if (effectivePlanTabs && Array.isArray(effectivePlanTabs) && !isTabExplicitlyRoleGranted) {
    if (item.id && !effectivePlanTabs.includes(item.id)) {
      if (item.subItems && Array.isArray(item.subItems)) {
        const hasSubInPlan = item.subItems.some(sub => effectivePlanTabs.includes(sub.id));
        if (!hasSubInPlan) return false;
      } else {
        return false;
      }
    }
  }

  // 4. Workspace administrator has access to all permitted tabs within this workspace's plan
  if (isWorkspaceAdmin) return true;

  // 5. Admin-only tabs are allowed if explicitly granted in role permissions/modules
  if (item.adminOnly) {
    const isExplicitlyGranted = modules.includes(item.id) || perms.includes(item.id) || perms.includes(`${item.id}:view`);
    if (!isExplicitlyGranted) return false;
  }

  const hasWildcard = perms.includes('*') || perms.includes('*:*');
  if (hasWildcard) return true;

  // 6. Parent dropdown items with subItems (Leads, Analytics, Team Management)
  // Must only be visible if at least one child sub-item is permitted
  if (item.subItems && Array.isArray(item.subItems) && item.subItems.length > 0) {
    return item.subItems.some(sub => isTabPermitted(sub, user, planTabs));
  }

  // 7. Individual Nav Item / Sub-item Permission check
  const itemMods = Array.isArray(item.module) ? item.module : (item.module ? [item.module] : []);

  if (item.id) {
    // Check explicit grant by item.id in enabled_modules or permissions
    const hasExplicitTabInModules = modules.includes(item.id);
    const hasExplicitTabInPerms = perms.includes(item.id) || perms.includes(`${item.id}:view`) || perms.some(p => p.startsWith(`${item.id}:`));

    if (hasExplicitTabInModules || hasExplicitTabInPerms) {
      // Check page-level permissions if defined
      const pagePerms = user?.role?.page_permissions || {};
      for (const mod of itemMods) {
        if (pagePerms[mod] && Array.isArray(pagePerms[mod]) && pagePerms[mod].length > 0) {
          const allowed = pagePerms[mod].includes(item.id) || pagePerms[mod].includes(item.label);
          if (!allowed) return false;
        }
      }
      return true;
    }

    // Special case for dashboard
    if (item.id === 'dashboard') {
      const isDashboardAllowed = (
        modules.includes('dashboards') || 
        modules.includes('dashboard') ||
        perms.includes('dashboards') ||
        perms.includes('dashboard') ||
        perms.some(p => p.startsWith('dashboards:'))
      );
      if (isDashboardAllowed) return true;
    }

    // Special case for reports hub
    if (item.id === 'reports') {
      const isReportsAllowed = (
        modules.includes('reports') ||
        perms.includes('reports') ||
        perms.includes('reports:view') ||
        perms.some(p => p.startsWith('reports:'))
      );
      if (isReportsAllowed) return true;
    }

    // Special case for leads sub-items: if role was granted generic 'leads' module and no specific sub-tabs were configured
    if (item.id.startsWith('leads-') && (modules.includes('leads') || perms.includes('leads') || perms.includes('leads:view'))) {
      const hasAnySpecificLeadsTabConfigured = modules.some(m => m.startsWith('leads-'));
      if (!hasAnySpecificLeadsTabConfigured) {
        return true;
      }
    }

    // Distinct tabs (e.g. coordination, handover-dashboard, retention-dashboard, resource-capacity,
    // factory-production, vendor-performance, vendor-capacity, vendor-lead-times, analytics-*, etc.)
    // MUST NOT leak through parent module names like 'projects', 'factory', 'vendors', 'analytics'.
    return false;
  }

  return false;
};

export const getDefaultRouteForUser = (user, planTabs = null) => {
  if (!user) return '/login';

  const isPlatformDeveloperAdmin = isSuperMasterDeveloper(user);

  const roleName = (typeof user?.role === 'string' ? user.role : user?.role?.name || user?.role_name || '').toLowerCase().trim();
  const perms = Array.isArray(user?.role?.permissions) 
    ? user.role.permissions 
    : (Array.isArray(user?.permissions) ? user.permissions : []);

  const isWorkspaceAdmin = 
    isPlatformDeveloperAdmin ||
    roleName === 'superadmin' || 
    roleName === 'admin' || 
    roleName === 'owner' ||
    roleName === 'super admin' ||
    perms.includes('*') ||
    perms.includes('*:*') ||
    perms.includes('all');

  if (isPlatformDeveloperAdmin || isWorkspaceAdmin) {
    return '/dashboard/sales';
  }

  const modules = user?.role?.enabled_modules || [];

  // Iterate NAV_ITEMS in sidebar order to find the first permitted tab
  for (const group of NAV_ITEMS) {
    if (group.adminOnly && !isPlatformDeveloperAdmin && !isWorkspaceAdmin) {
      const hasAnyGroupItemGranted = (group.items || []).some(item => {
        if (item.id === 'absences') return true;
        return modules.includes(item.id) || perms.includes(item.id) || perms.includes(`${item.id}:view`);
      });
      if (!hasAnyGroupItemGranted) continue;
    }

    if (group.financeOnly) {
      const hasFinance = isWorkspaceAdmin || perms.some(p => p.startsWith('finance:')) || modules.includes('finance');
      if (!hasFinance) continue;
    }

    for (const item of (group.items || [])) {
      if (item.subItems && Array.isArray(item.subItems) && item.subItems.length > 0) {
        for (const sub of item.subItems) {
          if (isTabPermitted(sub, user, planTabs) && sub.to) {
            return sub.to;
          }
        }
      } else if (isTabPermitted(item, user, planTabs) && item.to) {
        return item.to;
      }
    }
  }

  return '/forbidden';
};


