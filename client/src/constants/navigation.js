export const NAV_ITEMS = [
  { group: 'WORKSPACE', items: [
    { id: 'dashboard', to: '/dashboard/sales', icon: '⊞', label: 'Dashboard', module: 'dashboards' },
    { id: 'leads', label: 'Leads', icon: '◎', module: 'leads', subItems: [
        { id: 'leads-dashboard', to: '/leads?view=dashboard', icon: '📊', label: 'Dashboard', module: 'leads', permission: 'leads:view' },
        { id: 'leads-list', to: '/leads?view=list', icon: '≣', label: 'List', module: 'leads', permission: 'leads:view' },
        { id: 'leads-kanban', to: '/leads?view=kanban', icon: '◫', label: 'Kanban', module: 'leads', permission: 'leads:view' },
        { id: 'leads-calendar', to: '/leads?view=calendar', icon: '📅', label: 'Calendar', module: 'leads', permission: 'leads:view' },
        { id: 'leads-map', to: '/leads?view=map', icon: '🗺️', label: 'Map', module: 'leads', permission: 'leads:view' },
    ]},
    { id: 'projects', to: '/projects', icon: '◈', label: 'Projects', module: 'projects' },
    { id: 'tasks', to: '/tasks', icon: '◻', label: 'My Tasks', module: 'tasks' },
  ]},
  { group: 'ANALYTICS', items: [
    { id: 'analytics', label: 'Analytics', icon: '📊', module: 'analytics', subItems: [
        { id: 'analytics-leads', to: '/analytics/leads', icon: '▲', label: 'Lead Analytics', module: 'analytics', permission: 'analytics:view' },
        { id: 'analytics-projects', to: '/analytics/projects', icon: '◉', label: 'Project Analytics', module: 'analytics', permission: 'analytics:view' },
        { id: 'analytics-csat', to: '/analytics/csat', icon: '⭐', label: 'Client Satisfaction', module: 'analytics', permission: 'analytics:view' },
        { id: 'analytics-delay', to: '/analytics/delay-analysis', icon: '⏱️', label: 'Delay Analysis', module: 'analytics', permission: 'analytics:view' },
        { id: 'analytics-boq', to: '/analytics/boq-variance', icon: '📊', label: 'Budget Variance', module: 'analytics', permission: 'analytics:view' },
        { id: 'analytics-resources', to: '/analytics/resources', icon: '👤', label: 'Team Capacity', module: 'analytics', permission: 'analytics:view' },
        { id: 'analytics-resource-workload', to: '/analytics/resource-workload', icon: '👥', label: 'Team Workload', module: 'analytics', permission: 'analytics:view' }
    ]}
  ]},
  { group: 'SALES SETUP', adminOnly: true, items: [
    { id: 'lead-stages', to: '/lead-stages', icon: '◎', label: 'Lead Stages', module: 'settings' },
    { id: 'custom-fields', to: '/custom-fields', icon: '⊡', label: 'Custom Fields', module: 'settings' },
    { id: 'lead-forms', to: '/leads/forms', icon: '📝', label: 'Lead Forms', module: 'leads' }
  ]},
  { group: 'PROJECT SETUP', adminOnly: true, items: [
    { id: 'templates', to: '/templates', icon: '◈', label: 'Project Templates', module: 'settings' },
    { id: 'trade-activities', to: '/trade-activities', icon: '🛠', label: 'Trade Activities', module: 'settings' },
    { id: 'qc-checklists', to: '/qc-checklists', icon: '☑', label: 'QC Checklists', module: 'settings' },
    { id: 'conversion-checklist', to: '/conversion-checklist', icon: '☑', label: 'Conversion Checklist', module: 'settings' },
    { id: 'automations', to: '/automations', icon: '⚙', label: 'Automations', module: 'settings' }
  ]},
  { group: 'PROJECT WORKFLOWS', items: [
    { id: 'coordination', to: '/projects/coordination', icon: '🔄', label: 'Project Coordination', module: 'projects' },
    { id: 'handover-dashboard', to: '/projects/handover-dashboard', icon: '📋', label: 'Handover Dashboard', module: 'projects' },
    { id: 'retention-dashboard', to: '/projects/retention-dashboard', icon: '🤝', label: 'Client Retention', module: 'projects' }
  ]},
  { group: 'TEAM MANAGEMENT', items: [
    { id: 'resource-capacity', to: '/projects/resources', icon: '👥', label: 'Team Capacity', module: 'projects' },
    { id: 'absences', to: '/projects/absences', icon: '🌴', label: 'Leave Management', module: 'projects' }
  ]},
  { group: 'VENDORS', items: [
    { id: 'inventory', to: '/warehouse', icon: '📦', label: 'Warehouse & Inventory', module: ['inventory', 'warehouse'] },
    { id: 'factory-production', to: '/factory/production', icon: '🏭', label: 'Factory Production', module: 'factory' },
    { id: 'vendor-performance', to: '/analytics/vendors', icon: '🤝', label: 'Vendor Performance', module: ['vendors', 'analytics'] },
    { id: 'vendor-capacity', to: '/analytics/vendors-capacity', icon: '⚖️', label: 'Vendor Capacity', module: ['vendors', 'analytics', 'purchase_orders'] },
    { id: 'vendor-lead-times', to: '/vendor-lead-times', icon: '⏱', label: 'Vendor Lead Times', module: 'settings', adminOnly: true }
  ]},
  { group: 'FINANCE', items: [
    { id: 'finance-overview', to: '/finance', icon: '💰', label: 'Finance Overview', module: ['finance', 'payments', 'invoices', 'discounts'] },
    { id: 'financial-approvals', to: '/financial-approvals', icon: '📝', label: 'Financial Approvals', module: ['finance', 'payments'] },
    { id: 'analytics-profitability', to: '/analytics/profitability', icon: '💎', label: 'Project Profitability', module: 'analytics', permission: 'analytics:view' },
    { id: 'analytics-collection-forecast', to: '/analytics/collection-forecast', icon: '📈', label: 'Payment Forecast', module: 'analytics', permission: 'analytics:view' },
    { id: 'financial-thresholds', to: '/financial-settings', icon: '💰', label: 'Financial Settings', module: 'settings', adminOnly: true }
  ]},
  { group: 'TEAM & SECURITY', adminOnly: true, items: [
    { id: 'team-management', label: 'Team Management', icon: '👥', module: 'settings', subItems: [
        { id: 'team-members', to: '/team/members', icon: '◉', label: 'Team Members', module: 'settings', permission: 'settings:view' },
        { id: 'roles-permissions', to: '/team/roles', icon: '🔑', label: 'Roles & Permissions', module: 'settings', permission: 'settings:view' },
    ]},
    { id: 'organization', to: '/organization', icon: '🏢', label: 'Organization', module: 'settings' },
    { id: 'company-settings', to: '/settings/company', icon: '🏢', label: 'Company Settings', module: 'settings' },
    { id: 'login-history', to: '/login-history', icon: '🛡️', label: 'Login History', module: 'settings' },
    { id: 'audit-trail', to: '/settings/audit-trail', icon: '📜', label: 'Audit Trail', module: 'settings' }
  ]},
  { group: 'REPORTS', items: [
    { id: 'reports', to: '/reports', icon: '📋', label: 'Reports Hub', module: ['reports', 'analytics'] }
  ]},
  { group: 'DEVELOPER TOOLS', adminOnly: true, items: [
    { id: 'superadmin', to: '/settings/superadmin', icon: '⚡', label: 'Super Admin Center', module: 'settings' },
    { id: 'api-keys', to: '/api-keys', icon: '⊙', label: 'API Keys', module: 'settings' },
    { id: 'api-integration', to: '/developer/api', icon: '🔌', label: 'API Integration', module: 'settings' },
    { id: 'webhooks', to: '/developer/webhooks', icon: '🪝', label: 'Webhooks', module: 'settings' },
    { id: 'email-templates', to: '/email-templates', icon: '📧', label: 'Email Templates', module: 'settings' },
    { id: 'logs', to: '/logs', icon: '≡', label: 'Logs', module: 'settings' },
  ]}
];
