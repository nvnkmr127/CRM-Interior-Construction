const pool = require('../../../../db/pool');

/**
 * Assign User Action Handler
 * Dynamically assigns a specific user (assigneeId) to a designated user field on the entity.
 */
async function handle(config, context) {
  const { entity, userIdField, assigneeId } = config;
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

  const tableName = safeEntity + 's'; 

  const query = `
    UPDATE ${tableName}
    SET ${safeUserIdField} = $1, updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3
  `;

  await pool.query(query, [assigneeId, record.id, tenantId]);
}

module.exports = { handle };
