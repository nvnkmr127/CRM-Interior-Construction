const pool = require('../src/db/pool');

const starterTabs = [
  'dashboard',
  'leads',
  'leads-dashboard',
  'leads-list',
  'leads-kanban',
  'leads-calendar',
  'projects',
  'tasks',
  'reports',
  'team-management',
  'team-members',
  'organization'
];

const growthTabs = [
  'dashboard',
  'leads',
  'leads-dashboard',
  'leads-list',
  'leads-kanban',
  'leads-calendar',
  'leads-map',
  'projects',
  'tasks',
  'reports',
  'analytics',
  'analytics-leads',
  'analytics-projects',
  'analytics-csat',
  'analytics-delay',
  'coordination',
  'handover-dashboard',
  'retention-dashboard',
  'resource-capacity',
  'absences',
  'vendor-performance',
  'vendor-capacity',
  'team-management',
  'team-members',
  'roles-permissions',
  'organization'
];

const enterpriseTabs = [
  'dashboard', 'leads', 'leads-dashboard', 'leads-list', 'leads-kanban', 'leads-calendar', 'leads-map',
  'projects', 'tasks', 'reports', 'analytics', 'analytics-leads', 'analytics-projects', 'analytics-csat',
  'analytics-delay', 'analytics-boq', 'analytics-resources', 'analytics-resource-workload',
  'lead-stages', 'custom-fields', 'lead-forms', 'templates', 'trade-activities', 'qc-checklists',
  'conversion-checklist', 'automations', 'coordination', 'handover-dashboard', 'retention-dashboard',
  'resource-capacity', 'absences', 'vendor-performance', 'vendor-capacity', 'vendor-lead-times',
  'finance-overview', 'financial-approvals', 'analytics-profitability', 'analytics-collection-forecast',
  'financial-thresholds', 'team-management', 'team-members', 'roles-permissions', 'organization',
  'login-history', 'audit-trail', 'superadmin', 'api-keys', 'api-integration', 'webhooks',
  'email-templates', 'logs'
];

async function seed() {
  try {
    console.log('Seeding default plan sidebar configurations...');

    // Insert Starter
    await pool.query(`
      INSERT INTO sidebar_tabs_plan_config (plan_name, enabled_tabs, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (plan_name)
      DO UPDATE SET enabled_tabs = EXCLUDED.enabled_tabs, updated_at = NOW()
    `, ['starter', JSON.stringify(starterTabs)]);

    // Insert Growth
    await pool.query(`
      INSERT INTO sidebar_tabs_plan_config (plan_name, enabled_tabs, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (plan_name)
      DO UPDATE SET enabled_tabs = EXCLUDED.enabled_tabs, updated_at = NOW()
    `, ['growth', JSON.stringify(growthTabs)]);

    // Insert Enterprise
    await pool.query(`
      INSERT INTO sidebar_tabs_plan_config (plan_name, enabled_tabs, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (plan_name)
      DO UPDATE SET enabled_tabs = EXCLUDED.enabled_tabs, updated_at = NOW()
    `, ['enterprise', JSON.stringify(enterpriseTabs)]);

    console.log('Default configurations seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed configurations:', error);
    process.exit(1);
  }
}

seed();
