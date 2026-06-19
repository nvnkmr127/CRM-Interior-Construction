const pool = require('../../../db/pool');

/**
 * Assign User Action Handler
 * Dynamically assigns a specific user (assigneeId) or uses a strategy to a designated user field on the entity.
 */
async function handle(config, context) {
  let { entity = 'lead', userIdField = 'assigned_rep_id', assigneeId, strategy } = config;
  const { tenantId, record } = context;

  if (!record || !record.id) {
    throw new Error('Record ID missing for assignUser action');
  }

  // Strict sanitize layer to prevent SQL injection vectors
  const safeEntity = entity.replace(/[^a-z_]/gi, '');
  const safeUserIdField = userIdField.replace(/[^a-z_]/gi, '');

  if (!safeEntity || !safeUserIdField) {
    throw new Error('Invalid entity or field configuration syntax');
  }

  // If no assigneeId is provided, try to resolve via strategy
  if (!assigneeId && strategy) {
    if (strategy === 'senior_rep') {
      const res = await pool.query(`SELECT id FROM users WHERE tenant_id = $1 AND role = 'senior_sales_rep' LIMIT 1`, [tenantId]);
      if (res.rows.length > 0) assigneeId = res.rows[0].id;
    } else if (strategy === 'round_robin' || strategy === 'reassign_round_robin') {
      const res = await pool.query(`
        SELECT id FROM users 
        WHERE tenant_id = $1 AND role IN ('sales_rep', 'senior_sales_rep') 
        ORDER BY active_leads_count ASC NULLS FIRST LIMIT 1
      `, [tenantId]);
      if (res.rows.length > 0) assigneeId = res.rows[0].id;
    }
  }

  // If still no assigneeId, fallback to a system assignment or do nothing
  if (!assigneeId) {
    console.log(`[Automation] assignUser strategy '${strategy}' failed to find a valid user for tenant ${tenantId}`);
    return;
  }

  const tableName = safeEntity + 's'; 

  const query = `
    UPDATE ${tableName}
    SET ${safeUserIdField} = $1, updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3
  `;

  await pool.query(query, [assigneeId, record.id, tenantId]);
  console.log(`[Automation] Assigned user ${assigneeId} to ${tableName} ${record.id}`);
}

module.exports = { handle };
