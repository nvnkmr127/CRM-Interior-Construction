const pool = require('../../config/db');

/**
 * Automatically assigns project roles via round-robin if they are missing.
 * @param {string} tenantId 
 * @param {object} projectData - The data object for project creation.
 * @param {object} client - Optional db client
 * @returns {object} The mutated projectData
 */
async function assignRolesRoundRobin(tenantId, projectData, client = pool) {
  const roleMapping = [
    { field: 'pm_id', dbRoleNames: ['Project Manager', 'pm', 'project_manager'] },
    { field: 'designer_id', dbRoleNames: ['Designer', 'designer'] },
    { field: 'lead_designer_id', dbRoleNames: ['Lead Designer', 'Designer', 'designer'] },
    { field: 'junior_designer_id', dbRoleNames: ['Junior Designer', 'Designer', 'designer'] },
    { field: 'site_engineer_id', dbRoleNames: ['Site Engineer', 'site_engineer'] },
    { field: 'qc_engineer_id', dbRoleNames: ['QC Engineer', 'qc_engineer'] },
    { field: 'site_supervisor_id', dbRoleNames: ['Site Supervisor', 'site_supervisor'] },
    { field: 'crm_executive_id', dbRoleNames: ['CRM Executive', 'crm', 'crm_executive'] },
    { field: 'procurement_officer_id', dbRoleNames: ['Procurement Officer', 'procurement', 'procurement_officer'] }
  ];

  for (const roleDef of roleMapping) {
    if (!projectData[roleDef.field]) {
      // Find the next user to assign
      const assignedUserId = await getNextUserForRole(tenantId, roleDef.dbRoleNames, roleDef.field, client);
      if (assignedUserId) {
        projectData[roleDef.field] = assignedUserId;
      }
    }
  }

  return projectData;
}

async function getNextUserForRole(tenantId, dbRoleNames, projectField, client) {
  // 1. Get eligible active users
  const { rows: users } = await client.query(`
    SELECT u.id 
    FROM users u 
    JOIN roles r ON u.role_id = r.id 
    WHERE u.tenant_id = $1 AND u.status = 'active' AND u.deleted_at IS NULL
    AND r.name = ANY($2::text[])
    ORDER BY u.created_at ASC, u.id ASC
  `, [tenantId, dbRoleNames]);

  if (users.length === 0) return null;

  // 2. Get the last assigned user for this project field from the projects table
  const { rows: lastProject } = await client.query(`
    SELECT ${projectField} as last_assigned_id
    FROM projects
    WHERE tenant_id = $1 AND ${projectField} IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `, [tenantId]);

  let nextIndex = 0;
  if (lastProject.length > 0 && lastProject[0].last_assigned_id) {
    const lastId = lastProject[0].last_assigned_id;
    const lastIndex = users.findIndex(u => u.id === lastId);
    if (lastIndex !== -1) {
      nextIndex = (lastIndex + 1) % users.length;
    }
  }

  return users[nextIndex].id;
}

module.exports = {
  assignRolesRoundRobin
};
