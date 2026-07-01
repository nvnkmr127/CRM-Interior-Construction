const PERMISSIONS = {
  // Generic Project Scoped Permissions
  PROJECTS: {
    READ: 'projects:read',
    CREATE: 'projects:create',
    UPDATE: 'projects:update',
    DELETE: 'projects:delete',
    MANAGE: 'projects:manage',
  },
  
  // Department-Wise Permissions
  DESIGN: {
    READ: 'design:read',
    MANAGE: 'design:manage',
    APPROVE: 'design:approve',
  },
  
  PROCUREMENT: {
    READ: 'procurement:read',
    MANAGE: 'procurement:manage',
    APPROVE: 'procurement:approve',
  },
  
  FINANCE: {
    READ: 'finance:read',
    INVOICES: 'finance:invoices',
    PAYMENTS: 'finance:payments',
    DISCOUNTS: 'finance:discounts',
    MANAGE: 'finance:manage',
    APPROVE_L2: 'finance:approve_l2',
  },
  
  QC: {
    READ: 'qc:read',
    MANAGE: 'qc:manage',
    APPROVE: 'qc:approve',
  },
  
  HANDOVER: {
    READ: 'handover:read',
    AUTHORIZE: 'handover:authorize',
  },
  
  WARRANTY: {
    READ: 'warranty:read',
    MANAGE: 'warranty:manage',
  },
  
  SUPPORT: {
    READ: 'support:read',
    MANAGE: 'support:manage',
  },
};

module.exports = PERMISSIONS;
