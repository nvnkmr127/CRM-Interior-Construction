import { NAV_ITEMS } from './navigation'

export const PAGE_PERMISSIONS_SCHEMA = {
  dashboards: [
    { id: 'dashboard', label: 'Dashboard Main Tab' },
    { id: 'sales', label: 'Sales Dashboard' },
    { id: 'projects', label: 'Projects Dashboard' },
    { id: 'finance', label: 'Finance Dashboard' },
    { id: 'factory', label: 'Factory Dashboard' },
    { id: 'warehouse', label: 'Warehouse Dashboard' },
    { id: 'management', label: 'Management Dashboard' }
  ],
  leads: [
    { id: 'leads', label: 'Leads Root Tab' },
    { id: 'leads-dashboard', label: 'Dashboard' },
    { id: 'leads-list', label: 'Leads List' },
    { id: 'leads-kanban', label: 'Kanban Board' },
    { id: 'leads-calendar', label: 'Calendar View' },
    { id: 'leads-map', label: 'Map View' },
    { id: 'lead-stages', label: 'Lead Stages' },
    { id: 'custom-fields', label: 'Custom Fields' },
    { id: 'lead-forms', label: 'Lead Forms Builder' }
  ],
  projects: [
    { id: 'projects', label: 'Projects List Tab' },
    { id: 'Overview', label: 'Overview' },
    { id: 'Team & Roles', label: 'Team & Roles' },
    { id: 'Client Profile', label: 'Client Profile' },
    { id: 'Site Details', label: 'Site Details' },
    { id: 'Vendors & Consultants', label: 'Vendors & Consultants' },
    { id: 'Settings', label: 'Settings' },
    { id: 'Financial Overview', label: 'Financial Overview' },
    { id: 'Booking', label: 'Booking' },
    { id: 'Meeting Notes', label: 'Meeting Notes' },
    { id: 'Site Visits', label: 'Site Visits' },
    { id: 'Baseline Assessment', label: 'Baseline Assessment' },
    { id: 'Delay Notifications', label: 'Delay Notifications' },
    { id: 'Handovers', label: 'Handovers' },
    { id: 'Design Brief', label: 'Design Brief' },
    { id: 'Design Assets', label: 'Design Assets' },
    { id: 'Design Reviews', label: 'Design Reviews' },
    { id: 'Material Palettes', label: 'Material Palettes' },
    { id: 'Quotations & Budget', label: 'Quotations & Budget' },
    { id: 'Commercial Approval', label: 'Commercial Approval' },
    { id: 'Change Orders', label: 'Change Orders' },
    { id: 'Budget Variance', label: 'Budget Variance' },
    { id: 'Budget', label: 'Budget' },
    { id: 'Purchase Requests', label: 'Purchase Requests' },
    { id: 'Purchase Orders', label: 'Purchase Orders' },
    { id: 'Material Deliveries', label: 'Material Deliveries' },
    { id: 'Vendors', label: 'Vendors' },
    { id: 'Vendor Payments', label: 'Vendor Payments' },
    { id: 'Substitutions', label: 'Substitutions' },
    { id: 'Factory Production', label: 'Factory Production' },
    { id: 'Coordination', label: 'Coordination' },
    { id: 'Phases', label: 'Phases' },
    { id: 'Gantt Chart', label: 'Gantt Chart' },
    { id: 'Work Activities', label: 'Work Activities' },
    { id: 'Room Progress', label: 'Room Progress' },
    { id: 'Tasks', label: 'Tasks' },
    { id: 'Daily Site Reports', label: 'Daily Site Reports' },
    { id: 'Weekly Reports', label: 'Weekly Reports' },
    { id: 'Documents', label: 'Documents' },
    { id: 'Drawing Register', label: 'Drawing Register' },
    { id: 'MEP Checklist', label: 'MEP Checklist' },
    { id: 'Payments', label: 'Payments' },
    { id: 'Execution QC', label: 'Execution QC' },
    { id: 'Snags', label: 'Snags' },
    { id: 'Punch List', label: 'Punch List' },
    { id: 'Handover', label: 'Handover' },
    { id: 'Warranties', label: 'Warranties' },
    { id: 'AMCs', label: 'AMCs' },
    { id: 'Handover Readiness', label: 'Handover Readiness' },
    { id: 'Service Tickets', label: 'Service Tickets' },
    { id: 'Customer Retention', label: 'Customer Retention' },
    { id: 'Project Closure', label: 'Project Closure' },
    { id: 'Retrospective', label: 'Retrospective' },
    { id: 'Activity Logs', label: 'Activity Logs' },
    { id: 'coordination', label: 'Project Coordination Tab' },
    { id: 'handover-dashboard', label: 'Handover Dashboard Tab' },
    { id: 'retention-dashboard', label: 'Client Retention Tab' },
    { id: 'resource-capacity', label: 'Team Capacity Tab' },
    { id: 'absences', label: 'Leave Management Tab' }
  ],
  tasks: [
    { id: 'tasks', label: 'My Tasks Tab' },
    { id: 'task-board', label: 'Task Board' },
    { id: 'task-calendar', label: 'Task Calendar' }
  ],
  clients: [
    { id: 'clients', label: 'Clients Tab' },
    { id: 'clients-list', label: 'Client Directory' },
    { id: 'client-profile', label: 'Client Profile' },
    { id: 'client-portal', label: 'Client Portal' }
  ],
  quotations: [
    { id: 'quotations', label: 'Quotations & BOQ Tab' },
    { id: 'quotations-list', label: 'Quotations List' },
    { id: 'quotation-builder', label: 'Quotation Builder' },
    { id: 'templates', label: 'Quotation Templates' }
  ],
  boq: [
    { id: 'boq', label: 'BOQ Tab' },
    { id: 'boq-builder', label: 'BOQ Builder' },
    { id: 'rate-cards', label: 'Rate Cards & Items' },
    { id: 'analytics-boq', label: 'Budget Variance' }
  ],
  vendors: [
    { id: 'vendors', label: 'Vendors Tab' },
    { id: 'vendor-performance', label: 'Vendor Performance' },
    { id: 'vendor-capacity', label: 'Vendor Capacity' },
    { id: 'vendor-lead-times', label: 'Vendor Lead Times' }
  ],
  purchase_orders: [
    { id: 'purchase_orders', label: 'Purchase Orders Tab' },
    { id: 'purchase-requests', label: 'Purchase Requests' },
    { id: 'purchase-orders', label: 'Purchase Orders List' },
    { id: 'po-approvals', label: 'PO Approvals' }
  ],
  inventory: [
    { id: 'inventory', label: 'Warehouse & Inventory Tab' },
    { id: 'inventory-stock', label: 'Stock Register' },
    { id: 'material-issue', label: 'Material Issue & Transfer' },
    { id: 'stock-adjustment', label: 'Stock Adjustments' }
  ],
  warehouse: [
    { id: 'warehouse', label: 'Warehouse Tab' },
    { id: 'warehouse-coordination', label: 'Warehouse Coordination' },
    { id: 'material-deliveries', label: 'Material Deliveries' },
    { id: 'warehouse-stock', label: 'Warehouse Stock' }
  ],
  factory: [
    { id: 'factory-production', label: 'Factory Production Tab' },
    { id: 'production-status', label: 'Production Status' },
    { id: 'quality-check', label: 'Quality Check & Dispatch' }
  ],
  analytics: [
    { id: 'analytics', label: 'Analytics Main Tab' },
    { id: 'analytics-leads', label: 'Lead Analytics' },
    { id: 'analytics-projects', label: 'Project Analytics' },
    { id: 'analytics-csat', label: 'Client Satisfaction (CSAT)' },
    { id: 'analytics-delay', label: 'Delay Analysis' },
    { id: 'analytics-boq', label: 'Budget Variance Report' },
    { id: 'analytics-resources', label: 'Team Capacity' },
    { id: 'analytics-resource-workload', label: 'Team Workload' },
    { id: 'analytics-profitability', label: 'Project Profitability' },
    { id: 'analytics-collection-forecast', label: 'Payment Forecast' }
  ],
  reports: [
    { id: 'reports', label: 'Reports Hub Tab' },
    { id: 'csat-report', label: 'CSAT Report' },
    { id: 'resource-utilisation', label: 'Resource Utilisation' },
    { id: 'vendor-performance-report', label: 'Vendor Performance Report' }
  ],
  settings: [
    { id: 'lead-stages', label: 'Lead Stages' },
    { id: 'custom-fields', label: 'Custom Fields' },
    { id: 'templates', label: 'Project Templates' },
    { id: 'trade-activities', label: 'Trade Activities' },
    { id: 'qc-checklists', label: 'QC Checklists' },
    { id: 'conversion-checklist', label: 'Conversion Checklist' },
    { id: 'automations', label: 'Automations' },
    { id: 'vendor-lead-times', label: 'Vendor Lead Times' },
    { id: 'financial-thresholds', label: 'Financial Settings' },
    { id: 'team-management', label: 'Team Management Tab' },
    { id: 'team-members', label: 'Team Members' },
    { id: 'roles-permissions', label: 'Roles & Permissions' },
    { id: 'organization', label: 'Organization Structure' },
    { id: 'company-settings', label: 'Company Settings' },
    { id: 'login-history', label: 'Login History' },
    { id: 'audit-trail', label: 'Audit Trail' },
    { id: 'superadmin', label: 'Super Admin Center' },
    { id: 'api-keys', label: 'API Keys' },
    { id: 'api-integration', label: 'API Integration' },
    { id: 'webhooks', label: 'Webhooks' },
    { id: 'email-templates', label: 'Email Templates' },
    { id: 'logs', label: 'System Logs' }
  ],
  finance: [
    { id: 'finance', label: 'Finance Tab' },
    { id: 'finance-overview', label: 'Finance Overview' },
    { id: 'financial-approvals', label: 'Financial Approvals' },
    { id: 'analytics-profitability', label: 'Project Profitability' },
    { id: 'analytics-collection-forecast', label: 'Payment Forecast' },
    { id: 'financial-thresholds', label: 'Financial Settings' }
  ],
  invoices: [
    { id: 'invoices-list', label: 'Invoices List' },
    { id: 'invoice-builder', label: 'Invoice Builder' },
    { id: 'tax-invoices', label: 'Tax Invoices' }
  ],
  discounts: [
    { id: 'discounts-list', label: 'Discount Requests' },
    { id: 'discounts-approvals', label: 'Discount Approvals' }
  ],
  payments: [
    { id: 'payments', label: 'Payments Tab' },
    { id: 'payments-list', label: 'Payments List' },
    { id: 'vendor-payments', label: 'Vendor Payments' },
    { id: 'payment-receipts', label: 'Payment Receipts' }
  ],
  material_requests: [
    { id: 'material-requests-list', label: 'Material Requests List' },
    { id: 'mr-approvals', label: 'MR Approvals' }
  ],
  change_orders: [
    { id: 'change-orders-list', label: 'Change Orders List' },
    { id: 'co-approvals', label: 'Change Order Approvals' }
  ],
  design_reviews: [
    { id: 'design-brief', label: 'Design Brief' },
    { id: 'design-assets', label: 'Design Assets' },
    { id: 'design-reviews', label: 'Design Reviews' }
  ],
  users: [
    { id: 'users', label: 'Users Management Tab' },
    { id: 'team-management', label: 'Team Management Tab' },
    { id: 'team-members', label: 'Team Members' },
    { id: 'roles-permissions', label: 'Roles & Permissions' },
    { id: 'employee-profiles', label: 'Employee Profiles' }
  ]
};

export const getDynamicPagePermissionsSchema = () => {
  const schema = {};
  Object.keys(PAGE_PERMISSIONS_SCHEMA).forEach(k => {
    schema[k] = [...PAGE_PERMISSIONS_SCHEMA[k]];
  });

  if (NAV_ITEMS && Array.isArray(NAV_ITEMS)) {
    NAV_ITEMS.forEach(group => {
      if (group.items && Array.isArray(group.items)) {
        group.items.forEach(item => {
          const modules = Array.isArray(item.module) ? item.module : (item.module ? [item.module] : []);

          modules.forEach(mod => {
            if (!schema[mod]) schema[mod] = [];
            if (item.id && !schema[mod].some(t => t.id === item.id)) {
              schema[mod].push({ id: item.id, label: item.label || item.id });
            }
          });

          if (item.subItems && Array.isArray(item.subItems)) {
            item.subItems.forEach(sub => {
              const subMods = Array.isArray(sub.module)
                ? sub.module
                : (sub.module ? [sub.module] : modules);

              subMods.forEach(mod => {
                if (!schema[mod]) schema[mod] = [];
                if (sub.id && !schema[mod].some(t => t.id === sub.id)) {
                  schema[mod].push({ id: sub.id, label: sub.label || sub.id });
                }
              });
            });
          }
        });
      }
    });
  }

  return schema;
};
