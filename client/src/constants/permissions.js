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
];

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
  { id: 'export', label: 'Export' },
  { id: 'import', label: 'Import' },
  { id: 'print', label: 'Print' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'bulk_update', label: 'Bulk Update' },
  { id: 'bulk_delete', label: 'Bulk Delete' },
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
  'export': ['view'],
  'print': ['view'],
  'duplicate': ['view', 'create'],
  'approve': ['view'],
  'assign': ['view'],
  'transfer': ['view'],
  'restore': ['view', 'edit'],
  'bulk_update': ['view', 'edit'],
  'bulk_delete': ['view', 'delete']
};
