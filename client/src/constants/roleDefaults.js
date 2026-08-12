export const ROLE_DEFAULTS = {
  'superadmin': {
    description: 'Full system access with all permissions and visibility',
    permissions: ['*'],
    enabled_modules: [
      'leads', 'projects', 'tasks', 'clients', 'payments', 'quotations', 
      'boq', 'vendors', 'purchase_orders', 'inventory', 'warehouse', 
      'factory', 'analytics', 'reports', 'settings'
    ],
    data_scopes: {
      leads: 'all', projects: 'all', tasks: 'all', clients: 'all',
      payments: 'all', quotations: 'all', boq: 'all', vendors: 'all',
      purchase_orders: 'all', inventory: 'all', warehouse: 'all',
      factory: 'all', analytics: 'all', reports: 'all', settings: 'all'
    },
    field_permissions: {
      projects: { budget: 'editable', profit: 'editable', margin: 'editable', discount: 'editable', vendor_cost: 'editable', gst: 'editable', customer_contact: 'editable', internal_notes: 'editable' },
      leads: { budget: 'editable', expected_revenue: 'editable', source: 'editable', internal_notes: 'editable' },
      tasks: { budget: 'editable', priority: 'editable' },
      clients: { financial_history: 'editable' },
      payments: { amount: 'editable', tax: 'editable' },
      quotations: { discount: 'editable', margin: 'editable', profit: 'editable' },
      vendors: { bank_details: 'editable', rating: 'editable' },
      purchase_orders: { total_amount: 'editable', discount: 'editable' }
    },
    page_permissions: {},
    security_policies: {
      allowed_days: [0, 1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '00:00', end: '23:59' },
      allowed_ips: [],
      trusted_browsers: [],
      allowed_devices: []
    }
  },
  'admin': {
    description: 'Administrator access to manage most operations and settings',
    permissions: [
      'leads:view', 'leads:create', 'leads:edit', 'leads:delete', 'leads:assign', 'leads:transfer', 'leads:approve', 'leads:export', 'leads:import', 'leads:print', 'leads:duplicate', 'leads:bulk_update', 'leads:bulk_delete',
      'projects:view', 'projects:create', 'projects:edit', 'projects:delete', 'projects:assign', 'projects:transfer', 'projects:approve', 'projects:export', 'projects:import', 'projects:print', 'projects:duplicate', 'projects:bulk_update', 'projects:bulk_delete',
      'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:assign', 'tasks:transfer', 'tasks:approve', 'tasks:export', 'tasks:import', 'tasks:print', 'tasks:duplicate', 'tasks:bulk_update', 'tasks:bulk_delete',
      'clients:view', 'clients:create', 'clients:edit', 'clients:delete', 'clients:assign', 'clients:export', 'clients:import', 'clients:print', 'clients:duplicate',
      'payments:view', 'payments:create', 'payments:edit', 'payments:delete', 'payments:approve', 'payments:export', 'payments:print',
      'quotations:view', 'quotations:create', 'quotations:edit', 'quotations:delete', 'quotations:approve', 'quotations:export', 'quotations:print', 'quotations:duplicate',
      'boq:view', 'boq:create', 'boq:edit', 'boq:delete', 'boq:approve', 'boq:export', 'boq:print', 'boq:duplicate',
      'vendors:view', 'vendors:create', 'vendors:edit', 'vendors:delete', 'vendors:approve', 'vendors:export', 'vendors:import',
      'purchase_orders:view', 'purchase_orders:create', 'purchase_orders:edit', 'purchase_orders:delete', 'purchase_orders:approve', 'purchase_orders:export',
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:export', 'inventory:import',
      'warehouse:view', 'warehouse:create', 'warehouse:edit', 'warehouse:delete',
      'factory:view', 'factory:create', 'factory:edit', 'factory:delete', 'factory:approve',
      'analytics:view', 'analytics:export',
      'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:export',
      'settings:view', 'settings:create', 'settings:edit'
    ],
    enabled_modules: [
      'leads', 'projects', 'tasks', 'clients', 'payments', 'quotations', 
      'boq', 'vendors', 'purchase_orders', 'inventory', 'warehouse', 
      'factory', 'analytics', 'reports', 'settings'
    ],
    data_scopes: {
      leads: 'all', projects: 'all', tasks: 'all', clients: 'all',
      payments: 'all', quotations: 'all', boq: 'all', vendors: 'all',
      purchase_orders: 'all', inventory: 'all', warehouse: 'all',
      factory: 'all', analytics: 'all', reports: 'all', settings: 'all'
    },
    field_permissions: {
      projects: { budget: 'editable', profit: 'editable', margin: 'editable', discount: 'editable', vendor_cost: 'editable', gst: 'editable', customer_contact: 'editable', internal_notes: 'editable' },
      leads: { budget: 'editable', expected_revenue: 'editable', source: 'editable', internal_notes: 'editable' },
      tasks: { budget: 'editable', priority: 'editable' },
      clients: { financial_history: 'editable' },
      payments: { amount: 'editable', tax: 'editable' },
      quotations: { discount: 'editable', margin: 'editable', profit: 'editable' },
      vendors: { bank_details: 'editable', rating: 'editable' },
      purchase_orders: { total_amount: 'editable', discount: 'editable' }
    },
    page_permissions: {},
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5],
      allowed_login_times: { start: '08:00', end: '20:00' },
      allowed_ips: [],
      trusted_browsers: [],
      allowed_devices: []
    }
  },
  'Project Manager': {
    description: 'Manage projects, schedules, timelines, budgets, and project teams',
    permissions: [
      'projects:view', 'projects:create', 'projects:edit', 'projects:assign', 'projects:approve', 'projects:export', 'projects:print', 'projects:duplicate',
      'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:assign', 'tasks:approve', 'tasks:export', 'tasks:duplicate', 'tasks:bulk_update',
      'clients:view', 'clients:create', 'clients:edit', 'clients:print',
      'payments:view', 'payments:create', 'payments:edit', 'payments:print',
      'quotations:view', 'quotations:create', 'quotations:edit', 'quotations:approve', 'quotations:export', 'quotations:print', 'quotations:duplicate',
      'boq:view', 'boq:create', 'boq:edit', 'boq:approve', 'boq:export', 'boq:print', 'boq:duplicate',
      'vendors:view', 'vendors:create', 'vendors:edit',
      'purchase_orders:view', 'purchase_orders:create', 'purchase_orders:edit', 'purchase_orders:export',
      'inventory:view', 'inventory:export',
      'warehouse:view',
      'factory:view', 'factory:create', 'factory:edit',
      'analytics:view', 'analytics:export',
      'reports:view', 'reports:create', 'reports:edit', 'reports:export'
    ],
    enabled_modules: ['projects', 'tasks', 'clients', 'payments', 'quotations', 'boq', 'vendors', 'purchase_orders', 'inventory', 'warehouse', 'factory', 'analytics', 'reports'],
    data_scopes: {
      projects: 'department', tasks: 'department', clients: 'department',
      payments: 'department', quotations: 'department', boq: 'department',
      vendors: 'all', purchase_orders: 'department', inventory: 'all',
      warehouse: 'all', factory: 'department', analytics: 'department', reports: 'department'
    },
    field_permissions: {
      projects: { budget: 'editable', profit: 'editable', margin: 'editable', discount: 'editable', vendor_cost: 'editable', gst: 'editable', customer_contact: 'editable', internal_notes: 'editable' },
      tasks: { budget: 'editable', priority: 'editable' },
      clients: { financial_history: 'editable' },
      payments: { amount: 'editable', tax: 'editable' },
      quotations: { discount: 'editable', margin: 'editable', profit: 'editable' },
      vendors: { bank_details: 'read_only', rating: 'editable' },
      purchase_orders: { total_amount: 'editable', discount: 'editable' }
    },
    page_permissions: {},
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:00', end: '21:00' },
      allowed_ips: [],
      trusted_browsers: [],
      allowed_devices: []
    }
  },
  'Designer': {
    description: 'Create and edit design briefs, palettes, reviews, drawing registers, and design assets',
    permissions: [
      'projects:view', 'projects:edit', 'projects:print',
      'tasks:view', 'tasks:create', 'tasks:edit',
      'quotations:view',
      'boq:view', 'boq:create', 'boq:edit',
      'inventory:view'
    ],
    enabled_modules: ['projects', 'tasks', 'quotations', 'boq', 'inventory'],
    data_scopes: {
      projects: 'assigned', tasks: 'assigned', quotations: 'assigned', boq: 'assigned', inventory: 'all'
    },
    field_permissions: {
      projects: { budget: 'read_only', profit: 'hidden', margin: 'hidden', discount: 'read_only', vendor_cost: 'hidden', gst: 'read_only', customer_contact: 'editable', internal_notes: 'editable' },
      tasks: { budget: 'read_only', priority: 'editable' },
      quotations: { discount: 'read_only', margin: 'hidden', profit: 'hidden' }
    },
    page_permissions: {
      projects: [
        'Overview', 'Team & Roles', 'Site Details', 'Design Brief', 'Design Assets', 
        'Design Reviews', 'Material Palettes', 'Quotations & BOQ', 'Coordination', 
        'Room Progress', 'Tasks', 'Documents', 'Drawing Register'
      ]
    },
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:30', end: '20:00' }
    }
  },
  'Lead Designer': {
    description: 'Senior designer authority to approve design concepts, reviews, and drawings',
    permissions: [
      'projects:view', 'projects:edit', 'projects:assign', 'projects:print',
      'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:assign', 'tasks:approve',
      'clients:view',
      'quotations:view', 'quotations:create', 'quotations:edit',
      'boq:view', 'boq:create', 'boq:edit', 'boq:approve',
      'inventory:view'
    ],
    enabled_modules: ['projects', 'tasks', 'clients', 'quotations', 'boq', 'inventory'],
    data_scopes: {
      projects: 'department', tasks: 'department', clients: 'department', quotations: 'department', boq: 'department', inventory: 'all'
    },
    field_permissions: {
      projects: { budget: 'read_only', profit: 'read_only', margin: 'read_only', discount: 'editable', vendor_cost: 'read_only', gst: 'editable', customer_contact: 'editable', internal_notes: 'editable' },
      tasks: { budget: 'editable', priority: 'editable' },
      quotations: { discount: 'editable', margin: 'read_only', profit: 'read_only' }
    },
    page_permissions: {
      projects: [
        'Overview', 'Team & Roles', 'Client Profile', 'Site Details', 'Design Brief', 
        'Design Assets', 'Design Reviews', 'Material Palettes', 'Quotations & BOQ', 
        'Coordination', 'Room Progress', 'Tasks', 'Documents', 'Drawing Register', 
        'Activity Logs'
      ]
    },
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:00', end: '21:00' }
    }
  },
  'Junior Designer': {
    description: 'Assist in drafting, layout planning, and updating design checklists',
    permissions: [
      'projects:view',
      'tasks:view', 'tasks:edit',
      'boq:view'
    ],
    enabled_modules: ['projects', 'tasks', 'boq'],
    data_scopes: {
      projects: 'assigned', tasks: 'assigned', boq: 'assigned'
    },
    field_permissions: {
      projects: { budget: 'hidden', profit: 'hidden', margin: 'hidden', discount: 'hidden', vendor_cost: 'hidden', gst: 'hidden', customer_contact: 'read_only', internal_notes: 'editable' },
      tasks: { budget: 'hidden', priority: 'read_only' }
    },
    page_permissions: {
      projects: [
        'Overview', 'Site Details', 'Design Brief', 'Design Assets', 'Material Palettes', 
        'Room Progress', 'Tasks', 'Documents', 'Drawing Register'
      ]
    },
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5],
      allowed_login_times: { start: '09:00', end: '18:30' }
    }
  },
  'Sales': {
    description: 'Drive conversion, pipeline tracking, client onboarding, and initial estimations',
    permissions: [
      'leads:view', 'leads:create', 'leads:edit', 'leads:assign', 'leads:transfer', 'leads:export', 'leads:print', 'leads:duplicate',
      'clients:view', 'clients:create', 'clients:edit', 'clients:print',
      'quotations:view', 'quotations:create', 'quotations:edit', 'quotations:export', 'quotations:print', 'quotations:duplicate',
      'boq:view', 'boq:create', 'boq:edit',
      'analytics:view',
      'reports:view', 'reports:export'
    ],
    enabled_modules: ['leads', 'clients', 'quotations', 'boq', 'analytics', 'reports'],
    data_scopes: {
      leads: 'department', clients: 'department', quotations: 'department', boq: 'department', analytics: 'department', reports: 'department'
    },
    field_permissions: {
      leads: { budget: 'editable', expected_revenue: 'editable', source: 'editable', internal_notes: 'editable' },
      clients: { financial_history: 'read_only' },
      quotations: { discount: 'editable', margin: 'read_only', profit: 'read_only' }
    },
    page_permissions: {},
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:00', end: '20:00' }
    }
  },
  'Sales Representative': {
    description: 'Field executive dedicated to individual lead follow-ups and quotations',
    permissions: [
      'leads:view', 'leads:create', 'leads:edit', 'leads:print',
      'clients:view', 'clients:create', 'clients:edit',
      'quotations:view', 'quotations:create', 'quotations:edit', 'quotations:print',
      'boq:view'
    ],
    enabled_modules: ['leads', 'clients', 'quotations', 'boq'],
    data_scopes: {
      leads: 'own', clients: 'assigned', quotations: 'own', boq: 'assigned'
    },
    field_permissions: {
      leads: { budget: 'editable', expected_revenue: 'editable', source: 'editable', internal_notes: 'editable' },
      clients: { financial_history: 'hidden' },
      quotations: { discount: 'editable', margin: 'hidden', profit: 'hidden' }
    },
    page_permissions: {},
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:00', end: '20:00' }
    }
  },
  'Site Engineer': {
    description: 'Oversee site execution, coordination, progress tracking, and materials',
    permissions: [
      'projects:view', 'projects:edit',
      'tasks:view', 'tasks:create', 'tasks:edit',
      'inventory:view', 'inventory:create', 'inventory:edit',
      'warehouse:view',
      'factory:view'
    ],
    enabled_modules: ['projects', 'tasks', 'inventory', 'warehouse', 'factory'],
    data_scopes: {
      projects: 'assigned', tasks: 'assigned', inventory: 'all', warehouse: 'all', factory: 'assigned'
    },
    field_permissions: {
      projects: { budget: 'read_only', profit: 'hidden', margin: 'hidden', discount: 'hidden', vendor_cost: 'read_only', gst: 'read_only', customer_contact: 'editable', internal_notes: 'editable' },
      tasks: { budget: 'read_only', priority: 'editable' }
    },
    page_permissions: {
      projects: [
        'Overview', 'Team & Roles', 'Site Details', 'Vendors & Consultants', 
        'Site Visits', 'Material Deliveries', 'Coordination', 'Phases', 
        'Gantt Chart', 'Work Activities', 'Room Progress', 'Tasks', 
        'Daily Site Reports', 'Documents', 'Drawing Register', 'MEP Checklist'
      ]
    },
    security_policies: {
      allowed_days: [0, 1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '07:00', end: '21:00' }
    }
  },
  'Site Supervisor': {
    description: 'Log daily site reports, monitor labor attendance, and identify snags',
    permissions: [
      'projects:view',
      'tasks:view', 'tasks:create', 'tasks:edit'
    ],
    enabled_modules: ['projects', 'tasks'],
    data_scopes: {
      projects: 'assigned', tasks: 'assigned'
    },
    field_permissions: {
      projects: { budget: 'hidden', profit: 'hidden', margin: 'hidden', discount: 'hidden', vendor_cost: 'hidden', gst: 'hidden', customer_contact: 'read_only', internal_notes: 'editable' },
      tasks: { budget: 'hidden', priority: 'read_only' }
    },
    page_permissions: {
      projects: [
        'Overview', 'Site Details', 'Site Visits', 'Material Deliveries', 
        'Work Activities', 'Room Progress', 'Tasks', 'Daily Site Reports', 
        'Documents', 'MEP Checklist', 'Snags', 'Punch List'
      ]
    },
    security_policies: {
      allowed_days: [0, 1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '07:00', end: '19:00' }
    }
  },
  'Procurement Officer': {
    description: 'Track materials, raise purchase orders, and coordinate with vendors',
    permissions: [
      'vendors:view', 'vendors:create', 'vendors:edit',
      'purchase_orders:view', 'purchase_orders:create', 'purchase_orders:edit', 'purchase_orders:export',
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:export', 'inventory:import',
      'warehouse:view', 'warehouse:create', 'warehouse:edit'
    ],
    enabled_modules: ['vendors', 'purchase_orders', 'inventory', 'warehouse'],
    data_scopes: {
      vendors: 'all', purchase_orders: 'all', inventory: 'all', warehouse: 'all'
    },
    field_permissions: {
      vendors: { bank_details: 'editable', rating: 'read_only' },
      purchase_orders: { total_amount: 'editable', discount: 'editable' }
    },
    page_permissions: {},
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:30', end: '19:30' }
    }
  },
  'Procurement Manager': {
    description: 'Approve vendor rates, purchase orders, and audit materials stock',
    permissions: [
      'vendors:view', 'vendors:create', 'vendors:edit', 'vendors:delete', 'vendors:approve',
      'purchase_orders:view', 'purchase_orders:create', 'purchase_orders:edit', 'purchase_orders:delete', 'purchase_orders:approve', 'purchase_orders:export',
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:export', 'inventory:import',
      'warehouse:view', 'warehouse:create', 'warehouse:edit', 'warehouse:delete'
    ],
    enabled_modules: ['vendors', 'purchase_orders', 'inventory', 'warehouse'],
    data_scopes: {
      vendors: 'all', purchase_orders: 'all', inventory: 'all', warehouse: 'all'
    },
    field_permissions: {
      vendors: { bank_details: 'editable', rating: 'editable' },
      purchase_orders: { total_amount: 'editable', discount: 'editable' }
    },
    page_permissions: {},
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:00', end: '20:30' }
    }
  },
  'Finance Manager': {
    description: 'Oversee accounts payable, collection, invoicing, and budget compliance',
    permissions: [
      'payments:view', 'payments:create', 'payments:edit', 'payments:approve', 'payments:export', 'payments:print',
      'quotations:view', 'quotations:export',
      'boq:view', 'boq:export',
      'vendors:view', 'vendors:edit',
      'purchase_orders:view', 'purchase_orders:approve', 'purchase_orders:export',
      'analytics:view', 'analytics:export',
      'reports:view', 'reports:create', 'reports:edit', 'reports:export'
    ],
    enabled_modules: ['payments', 'quotations', 'boq', 'vendors', 'purchase_orders', 'analytics', 'reports'],
    data_scopes: {
      payments: 'all', quotations: 'all', boq: 'all', vendors: 'all', purchase_orders: 'all', analytics: 'all', reports: 'all'
    },
    field_permissions: {
      payments: { amount: 'editable', tax: 'editable' },
      quotations: { discount: 'read_only', margin: 'read_only', profit: 'read_only' },
      vendors: { bank_details: 'editable', rating: 'read_only' },
      purchase_orders: { total_amount: 'read_only', discount: 'read_only' }
    },
    page_permissions: {},
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5],
      allowed_login_times: { start: '08:30', end: '19:00' }
    }
  },
  'Finance Controller': {
    description: 'Audit cashflow, verify profitability, change billing thresholds and margins',
    permissions: [
      'payments:view', 'payments:create', 'payments:edit', 'payments:delete', 'payments:approve', 'payments:export', 'payments:print',
      'quotations:view', 'quotations:edit', 'quotations:approve', 'quotations:export', 'quotations:print',
      'boq:view', 'boq:edit', 'boq:approve', 'boq:export', 'boq:print',
      'vendors:view', 'vendors:create', 'vendors:edit', 'vendors:approve',
      'purchase_orders:view', 'purchase_orders:create', 'purchase_orders:edit', 'purchase_orders:delete', 'purchase_orders:approve', 'purchase_orders:export',
      'analytics:view', 'analytics:export',
      'reports:view', 'reports:create', 'reports:edit', 'reports:delete', 'reports:export'
    ],
    enabled_modules: ['payments', 'quotations', 'boq', 'vendors', 'purchase_orders', 'analytics', 'reports'],
    data_scopes: {
      payments: 'all', quotations: 'all', boq: 'all', vendors: 'all', purchase_orders: 'all', analytics: 'all', reports: 'all'
    },
    field_permissions: {
      payments: { amount: 'editable', tax: 'editable' },
      quotations: { discount: 'editable', margin: 'editable', profit: 'editable' },
      vendors: { bank_details: 'editable', rating: 'editable' },
      purchase_orders: { total_amount: 'editable', discount: 'editable' }
    },
    page_permissions: {},
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5],
      allowed_login_times: { start: '08:00', end: '20:00' }
    }
  },
  'QC Engineer': {
    description: 'Enforce interior quality checklists, verify snags and clear punch lists',
    permissions: [
      'projects:view',
      'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:approve'
    ],
    enabled_modules: ['projects', 'tasks'],
    data_scopes: {
      projects: 'all', tasks: 'all'
    },
    field_permissions: {
      projects: { budget: 'hidden', profit: 'hidden', margin: 'hidden', discount: 'hidden', vendor_cost: 'hidden', gst: 'hidden', customer_contact: 'read_only', internal_notes: 'editable' },
      tasks: { budget: 'hidden', priority: 'editable' }
    },
    page_permissions: {
      projects: [
        'Overview', 'Site Details', 'Coordination', 'Room Progress', 'Tasks', 
        'Daily Site Reports', 'Documents', 'MEP Checklist', 'Execution QC', 
        'Snags', 'Punch List'
      ]
    },
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:00', end: '19:00' }
    }
  },
  'QC Inspector': {
    description: 'Document defects, post snag photos and coordinate resolution',
    permissions: [
      'projects:view',
      'tasks:view', 'tasks:create', 'tasks:edit'
    ],
    enabled_modules: ['projects', 'tasks'],
    data_scopes: {
      projects: 'assigned', tasks: 'assigned'
    },
    field_permissions: {
      projects: { budget: 'hidden', profit: 'hidden', margin: 'hidden', discount: 'hidden', vendor_cost: 'hidden', gst: 'hidden', customer_contact: 'read_only', internal_notes: 'editable' },
      tasks: { budget: 'hidden', priority: 'read_only' }
    },
    page_permissions: {
      projects: [
        'Overview', 'Site Details', 'Room Progress', 'Tasks', 'Daily Site Reports', 
        'Documents', 'MEP Checklist', 'Execution QC', 'Snags', 'Punch List'
      ]
    },
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:00', end: '18:30' }
    }
  },
  'Handover Specialist': {
    description: 'Ensure handover readiness checklist completion, compile warranties & manuals',
    permissions: [
      'projects:view', 'projects:edit',
      'tasks:view', 'tasks:create', 'tasks:edit'
    ],
    enabled_modules: ['projects', 'tasks'],
    data_scopes: {
      projects: 'assigned', tasks: 'assigned'
    },
    field_permissions: {
      projects: { budget: 'read_only', profit: 'hidden', margin: 'hidden', discount: 'read_only', vendor_cost: 'hidden', gst: 'read_only', customer_contact: 'editable', internal_notes: 'editable' },
      tasks: { budget: 'read_only', priority: 'editable' }
    },
    page_permissions: {
      projects: [
        'Overview', 'Site Details', 'Handovers', 'Documents', 'Payments', 
        'Handover', 'Warranties', 'AMCs', 'Handover Readiness', 'Project Closure'
      ]
    },
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:30', end: '19:30' }
    }
  },
  'Warranty Manager': {
    description: 'Handle post-handover warranty claims, AMC schedules and service tickets',
    permissions: [
      'projects:view',
      'tasks:view', 'tasks:create', 'tasks:edit'
    ],
    enabled_modules: ['projects', 'tasks'],
    data_scopes: {
      projects: 'all', tasks: 'all'
    },
    field_permissions: {
      projects: { budget: 'hidden', profit: 'hidden', margin: 'hidden', discount: 'hidden', vendor_cost: 'hidden', gst: 'hidden', customer_contact: 'editable', internal_notes: 'editable' },
      tasks: { budget: 'hidden', priority: 'editable' }
    },
    page_permissions: {
      projects: [
        'Overview', 'Site Details', 'Documents', 'Warranties', 'AMCs', 
        'Service Tickets', 'Customer Retention'
      ]
    },
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:30', end: '18:30' }
    }
  },
  'CRM Executive': {
    description: 'Manage client relationship channels, onboarding surveys, and CSAT feedbacks',
    permissions: [
      'leads:view', 'leads:edit',
      'clients:view', 'clients:create', 'clients:edit',
      'analytics:view',
      'reports:view'
    ],
    enabled_modules: ['leads', 'clients', 'analytics', 'reports'],
    data_scopes: {
      leads: 'all', clients: 'all', analytics: 'all', reports: 'all'
    },
    field_permissions: {
      leads: { budget: 'read_only', expected_revenue: 'read_only', source: 'editable', internal_notes: 'editable' },
      clients: { financial_history: 'read_only' }
    },
    page_permissions: {},
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5],
      allowed_login_times: { start: '09:00', end: '18:00' }
    }
  },
  'Customer Support Rep': {
    description: 'Log and track customer complaints, support requests and tickets',
    permissions: [
      'clients:view',
      'tasks:view', 'tasks:create', 'tasks:edit'
    ],
    enabled_modules: ['clients', 'tasks'],
    data_scopes: {
      clients: 'assigned', tasks: 'assigned'
    },
    field_permissions: {
      clients: { financial_history: 'hidden' },
      tasks: { budget: 'hidden', priority: 'editable' }
    },
    page_permissions: {},
    security_policies: {
      allowed_days: [1, 2, 3, 4, 5, 6],
      allowed_login_times: { start: '08:00', end: '20:00' }
    }
  }
};
