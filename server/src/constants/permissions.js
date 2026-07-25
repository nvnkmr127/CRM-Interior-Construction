const PERMISSION_MODULES = [
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

const PERMISSION_ACTIONS = [
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

const DATA_SCOPES = [
  { id: 'own', label: 'Own Records', description: 'Can only access records they created or are directly assigned to.' },
  { id: 'assigned', label: 'Assigned Records', description: 'Can only access records specifically assigned to them.' },
  { id: 'team', label: 'Team Records', description: 'Can access records owned by anyone in their immediate team.' },
  { id: 'department', label: 'Department Records', description: 'Can access records owned by anyone in their department.' },
  { id: 'branch', label: 'Branch Records', description: 'Can access records owned by anyone in their branch.' },
  { id: 'all', label: 'Company Records (All)', description: 'Can access all records across the entire company.' },
];

const getAllAvailablePermissions = () => {
  const permissions = [];
  for (const mod of PERMISSION_MODULES) {
    for (const action of PERMISSION_ACTIONS) {
      permissions.push(`${mod.id}:${action.id}`);
    }
  }
  return permissions;
};

const isValidPermission = (perm) => {
  if (perm === '*') return true;
  const parts = perm.split(':');
  if (parts.length !== 2) return false;
  const [mod, action] = parts;
  const validMod = PERMISSION_MODULES.some(m => m.id === mod);
  const validAction = PERMISSION_ACTIONS.some(a => a.id === action);
  return validMod && validAction;
};

module.exports = {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  DATA_SCOPES,
  getAllAvailablePermissions,
  isValidPermission
};
