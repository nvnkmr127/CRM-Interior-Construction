const ROLE_DEFAULTS = {
  'superadmin': {
    name: 'Super Admin',
    description: 'Full system access with all permissions and visibility',
    permissions: ['*'],
    enabled_modules: [
      'dashboards', 'leads', 'projects', 'tasks', 'clients', 'payments', 'quotations', 
      'boq', 'vendors', 'purchase_orders', 'inventory', 'warehouse', 
      'factory', 'analytics', 'reports', 'settings', 'finance'
    ]
  },
  'admin': {
    name: 'Admin',
    description: 'Administrator access to manage most operations and settings',
    permissions: ['*'],
    enabled_modules: [
      'dashboards', 'leads', 'projects', 'tasks', 'clients', 'payments', 'quotations', 
      'boq', 'vendors', 'purchase_orders', 'inventory', 'warehouse', 
      'factory', 'analytics', 'reports', 'settings', 'finance'
    ]
  },
  'Project Manager': {
    name: 'Project Manager',
    description: 'Manage projects, schedules, timelines, budgets, and project teams',
    permissions: [
      'dashboards:view_project_dashboard',
      'projects:view', 'projects:read', 'projects:create', 'projects:edit', 'projects:assign', 'projects:approve', 'projects:export', 'projects:print', 'projects:duplicate',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:assign', 'tasks:approve', 'tasks:export', 'tasks:duplicate', 'tasks:bulk_update',
      'clients:view', 'clients:create', 'clients:edit', 'clients:print',
      'payments:view', 'payments:create', 'payments:edit', 'payments:print',
      'quotations:view', 'quotations:create', 'quotations:edit', 'quotations:approve', 'quotations:export', 'quotations:print', 'quotations:duplicate',
      'boq:view', 'boq:create', 'boq:edit', 'boq:approve', 'boq:export', 'boq:print', 'boq:duplicate',
      'vendors:view', 'vendors:create', 'vendors:edit',
      'purchase_orders:view', 'purchase_orders:create', 'purchase_orders:edit', 'purchase_orders:export',
      'inventory:view', 'inventory:export',
      'warehouse:view',
      'factory:view', 'factory:create', 'factory:edit',
      'analytics:view', 'analytics:view_project_analytics', 'analytics:export',
      'reports:view', 'reports:create', 'reports:edit', 'reports:export'
    ],
    enabled_modules: ['dashboards', 'projects', 'tasks', 'clients', 'payments', 'quotations', 'boq', 'vendors', 'purchase_orders', 'inventory', 'warehouse', 'factory', 'analytics', 'reports']
  },
  'Designer': {
    name: 'Designer',
    description: 'Create and edit design briefs, palettes, reviews, drawing registers, and design assets',
    permissions: [
      'dashboards:view_project_dashboard',
      'projects:view', 'projects:read', 'projects:edit', 'projects:print',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit',
      'quotations:view',
      'boq:view', 'boq:create', 'boq:edit',
      'inventory:view'
    ],
    enabled_modules: ['dashboards', 'projects', 'tasks', 'quotations', 'boq', 'inventory']
  },
  'Lead Designer': {
    name: 'Lead Designer',
    description: 'Senior designer authority to approve design concepts, reviews, and drawings',
    permissions: [
      'dashboards:view_project_dashboard',
      'projects:view', 'projects:read', 'projects:edit', 'projects:assign', 'projects:print',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit', 'tasks:assign', 'tasks:approve',
      'clients:view',
      'quotations:view', 'quotations:create', 'quotations:edit',
      'boq:view', 'boq:create', 'boq:edit', 'boq:approve',
      'inventory:view'
    ],
    enabled_modules: ['dashboards', 'projects', 'tasks', 'clients', 'quotations', 'boq', 'inventory']
  },
  'Junior Designer': {
    name: 'Junior Designer',
    description: 'Assist in drafting, layout planning, and updating design checklists',
    permissions: [
      'projects:view', 'projects:read',
      'tasks:view', 'tasks:read', 'tasks:edit',
      'boq:view'
    ],
    enabled_modules: ['projects', 'tasks', 'boq']
  },
  'Sales': {
    name: 'Sales',
    description: 'Drive conversion, pipeline tracking, client onboarding, and initial estimations',
    permissions: [
      'dashboards:view_sales_dashboard',
      'leads:view', 'leads:read', 'leads:create', 'leads:edit', 'leads:assign', 'leads:transfer', 'leads:export', 'leads:print', 'leads:duplicate',
      'clients:view', 'clients:create', 'clients:edit', 'clients:print',
      'quotations:view', 'quotations:create', 'quotations:edit', 'quotations:export', 'quotations:print', 'quotations:duplicate',
      'boq:view', 'boq:create', 'boq:edit',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit',
      'projects:view', 'projects:read',
      'analytics:view', 'analytics:view_lead_analytics',
      'reports:view', 'reports:export'
    ],
    enabled_modules: ['dashboards', 'leads', 'clients', 'quotations', 'boq', 'tasks', 'projects', 'analytics', 'reports']
  },
  'Sales Executive': {
    name: 'Sales Executive',
    description: 'Field executive dedicated to individual lead follow-ups, conversion, and estimations',
    permissions: [
      'dashboards:view_sales_dashboard',
      'leads:view', 'leads:read', 'leads:create', 'leads:edit', 'leads:assign', 'leads:transfer', 'leads:export', 'leads:print', 'leads:duplicate',
      'clients:view', 'clients:create', 'clients:edit', 'clients:print',
      'quotations:view', 'quotations:create', 'quotations:edit', 'quotations:export', 'quotations:print', 'quotations:duplicate',
      'boq:view', 'boq:create', 'boq:edit',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit',
      'projects:view', 'projects:read',
      'analytics:view', 'analytics:view_lead_analytics',
      'reports:view', 'reports:export'
    ],
    enabled_modules: ['dashboards', 'leads', 'clients', 'quotations', 'boq', 'tasks', 'projects', 'analytics', 'reports']
  },
  'Sales Representative': {
    name: 'Sales Representative',
    description: 'Field executive dedicated to individual lead follow-ups',
    permissions: [
      'dashboards:view_sales_dashboard',
      'leads:view', 'leads:read', 'leads:create', 'leads:edit', 'leads:assign',
      'clients:view',
      'quotations:view',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit',
      'projects:view', 'projects:read'
    ],
    enabled_modules: ['dashboards', 'leads', 'tasks', 'quotations', 'projects', 'clients']
  },
  'Site Supervisor': {
    name: 'Site Supervisor',
    description: 'Supervise on-site construction, safety, daily logs, snags, and materials',
    permissions: [
      'dashboards:view_project_dashboard',
      'projects:view', 'projects:read', 'projects:edit',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit',
      'inventory:view', 'warehouse:view', 'factory:view'
    ],
    enabled_modules: ['dashboards', 'projects', 'tasks', 'inventory', 'warehouse', 'factory']
  },
  'Site Engineer': {
    name: 'Site Engineer',
    description: 'Oversee site execution, coordination, progress tracking, and materials',
    permissions: [
      'dashboards:view_project_dashboard',
      'projects:view', 'projects:read', 'projects:edit',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit',
      'inventory:view', 'inventory:create', 'inventory:edit',
      'warehouse:view', 'factory:view',
      'boq:view'
    ],
    enabled_modules: ['dashboards', 'projects', 'tasks', 'inventory', 'warehouse', 'factory', 'boq']
  },
  'Procurement Officer': {
    name: 'Procurement Officer',
    description: 'Track materials, raise purchase orders, and coordinate with vendors',
    permissions: [
      'vendors:view', 'vendors:create', 'vendors:edit',
      'purchase_orders:view', 'purchase_orders:create', 'purchase_orders:edit', 'purchase_orders:export',
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:export', 'inventory:import',
      'warehouse:view', 'warehouse:create', 'warehouse:edit'
    ],
    enabled_modules: ['vendors', 'purchase_orders', 'inventory', 'warehouse']
  },
  'Procurement Manager': {
    name: 'Procurement Manager',
    description: 'Approve vendor rates, purchase orders, and audit materials stock',
    permissions: [
      'vendors:view', 'vendors:create', 'vendors:edit', 'vendors:delete', 'vendors:approve',
      'purchase_orders:view', 'purchase_orders:create', 'purchase_orders:edit', 'purchase_orders:delete', 'purchase_orders:approve', 'purchase_orders:export',
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:export', 'inventory:import',
      'warehouse:view', 'warehouse:create', 'warehouse:edit', 'warehouse:delete'
    ],
    enabled_modules: ['vendors', 'purchase_orders', 'inventory', 'warehouse']
  },
  'Finance Manager': {
    name: 'Finance Manager',
    description: 'Oversee accounts payable, collection, invoicing, and budget compliance',
    permissions: [
      'dashboards:view_finance_dashboard',
      'finance:view', 'finance:read',
      'payments:view', 'payments:create', 'payments:edit', 'payments:approve', 'payments:export', 'payments:print',
      'invoices:view', 'invoices:create', 'invoices:edit',
      'quotations:view', 'quotations:export',
      'boq:view', 'boq:export',
      'vendors:view', 'vendors:edit',
      'purchase_orders:view', 'purchase_orders:approve', 'purchase_orders:export',
      'analytics:view', 'analytics:export',
      'reports:view', 'reports:create', 'reports:edit', 'reports:export'
    ],
    enabled_modules: ['dashboards', 'finance', 'invoices', 'payments', 'quotations', 'boq', 'vendors', 'purchase_orders', 'analytics', 'reports']
  },
  'Finance Controller': {
    name: 'Finance Controller',
    description: 'Audit cashflow, verify profitability, change billing thresholds and margins',
    permissions: [
      'dashboards:view_finance_dashboard',
      'finance:view', 'finance:read',
      'payments:view', 'payments:create', 'payments:edit', 'payments:delete', 'payments:approve', 'payments:export', 'payments:print',
      'invoices:view', 'invoices:create', 'invoices:edit', 'invoices:delete',
      'quotations:view', 'quotations:edit', 'quotations:approve', 'quotations:export', 'quotations:print',
      'boq:view', 'boq:edit', 'boq:approve', 'boq:export', 'boq:print',
      'vendors:view', 'vendors:create', 'vendors:edit', 'vendors:approve',
      'purchase_orders:view', 'purchase_orders:create', 'purchase_orders:edit', 'purchase_orders:delete', 'purchase_orders:approve', 'purchase_orders:export',
      'analytics:view', 'analytics:export',
      'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:export'
    ],
    enabled_modules: ['dashboards', 'finance', 'invoices', 'payments', 'quotations', 'boq', 'vendors', 'purchase_orders', 'analytics', 'reports']
  },
  'Accountant': {
    name: 'Accountant',
    description: 'Manage payments, invoices, transactions, taxes, and financial audits',
    permissions: [
      'dashboards:view_finance_dashboard',
      'finance:view', 'finance:read', 'finance:invoices', 'finance:payments', 'finance:approvals',
      'invoices:view', 'invoices:read', 'invoices:create', 'invoices:edit',
      'payments:view', 'payments:read', 'payments:create', 'payments:edit',
      'quotations:view', 'boq:view',
      'analytics:view', 'analytics:view_finance_analytics',
      'reports:view', 'reports:export'
    ],
    enabled_modules: ['dashboards', 'finance', 'invoices', 'payments', 'quotations', 'boq', 'analytics', 'reports']
  },
  'QC Engineer': {
    name: 'QC Engineer',
    description: 'Enforce interior quality checklists, verify snags and clear punch lists',
    permissions: [
      'projects:view', 'projects:read',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit', 'tasks:approve'
    ],
    enabled_modules: ['projects', 'tasks']
  },
  'QC Inspector': {
    name: 'QC Inspector',
    description: 'Document defects, post snag photos and coordinate resolution',
    permissions: [
      'projects:view', 'projects:read',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit'
    ],
    enabled_modules: ['projects', 'tasks']
  },
  'Handover Specialist': {
    name: 'Handover Specialist',
    description: 'Ensure handover readiness checklist completion, compile warranties & manuals',
    permissions: [
      'projects:view', 'projects:read', 'projects:edit',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit'
    ],
    enabled_modules: ['projects', 'tasks']
  },
  'Warranty Manager': {
    name: 'Warranty Manager',
    description: 'Handle post-handover warranty claims, AMC schedules and service tickets',
    permissions: [
      'projects:view', 'projects:read',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit'
    ],
    enabled_modules: ['projects', 'tasks']
  },
  'CRM Executive': {
    name: 'CRM Executive',
    description: 'Manage client relationship channels, onboarding surveys, and CSAT feedbacks',
    permissions: [
      'leads:view', 'leads:read', 'leads:edit',
      'clients:view', 'clients:create', 'clients:edit',
      'analytics:view',
      'reports:view'
    ],
    enabled_modules: ['leads', 'clients', 'analytics', 'reports']
  },
  'Customer Support Rep': {
    name: 'Customer Support Rep',
    description: 'Log and track customer complaints, support requests and tickets',
    permissions: [
      'clients:view',
      'tasks:view', 'tasks:read', 'tasks:create', 'tasks:edit'
    ],
    enabled_modules: ['clients', 'tasks']
  }
};

const getRoleConfig = (roleKeyOrName) => {
  if (!roleKeyOrName) return null;
  const clean = roleKeyOrName.toLowerCase().replace(/[\s_-]+/g, '');

  // 1. Direct or normalized key match
  const exactKey = Object.keys(ROLE_DEFAULTS).find(
    k => k.toLowerCase() === roleKeyOrName.toLowerCase() || 
         ROLE_DEFAULTS[k].name?.toLowerCase() === roleKeyOrName.toLowerCase() ||
         k.toLowerCase().replace(/[\s_-]+/g, '') === clean
  );
  if (exactKey) return ROLE_DEFAULTS[exactKey];

  // 2. Comprehensive role fuzzy/alias matching
  if (clean.includes('sales') || (clean.includes('lead') && !clean.includes('design'))) {
    if (clean.includes('rep') || clean.includes('representative')) {
      return ROLE_DEFAULTS['Sales Representative'];
    }
    return ROLE_DEFAULTS['Sales Executive'] || ROLE_DEFAULTS['Sales'];
  }
  if (clean.includes('pm') || clean.includes('projectmanager')) {
    return ROLE_DEFAULTS['Project Manager'];
  }
  if (clean.includes('designer') || clean.includes('design')) {
    if (clean.includes('lead') || clean.includes('sr') || clean.includes('senior')) {
      return ROLE_DEFAULTS['Lead Designer'];
    }
    if (clean.includes('jr') || clean.includes('junior')) {
      return ROLE_DEFAULTS['Junior Designer'];
    }
    return ROLE_DEFAULTS['Designer'];
  }
  if (clean.includes('site') && (clean.includes('eng') || clean.includes('engineer'))) {
    return ROLE_DEFAULTS['Site Engineer'];
  }
  if (clean.includes('site') && (clean.includes('sup') || clean.includes('supervisor'))) {
    return ROLE_DEFAULTS['Site Supervisor'];
  }
  if (clean.includes('procure') || clean.includes('purchase')) {
    if (clean.includes('man') || clean.includes('head')) {
      return ROLE_DEFAULTS['Procurement Manager'];
    }
    return ROLE_DEFAULTS['Procurement Officer'];
  }
  if (clean.includes('finance') || clean.includes('account')) {
    if (clean.includes('control') || clean.includes('auditor')) {
      return ROLE_DEFAULTS['Finance Controller'];
    }
    if (clean.includes('man') || clean.includes('head')) {
      return ROLE_DEFAULTS['Finance Manager'];
    }
    return ROLE_DEFAULTS['Accountant'];
  }
  if (clean.includes('qc') || clean.includes('quality')) {
    if (clean.includes('inspect')) {
      return ROLE_DEFAULTS['QC Inspector'];
    }
    return ROLE_DEFAULTS['QC Engineer'];
  }
  if (clean.includes('handover')) {
    return ROLE_DEFAULTS['Handover Specialist'];
  }
  if (clean.includes('warrant')) {
    return ROLE_DEFAULTS['Warranty Manager'];
  }
  if (clean.includes('crm')) {
    return ROLE_DEFAULTS['CRM Executive'];
  }
  if (clean.includes('support')) {
    return ROLE_DEFAULTS['Customer Support Rep'];
  }

  return null;
};

module.exports = {
  ROLE_DEFAULTS,
  getRoleConfig
};
