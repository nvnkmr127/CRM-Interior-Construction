const pool = require('../../../db/pool');

/**
 * Update Field Action Handler
 * Dynamically updates a specific field directly on a target entity record.
 */
async function handle(config, context) {
  let { entity = 'lead', field, value, relative = false } = config;
  const { tenantId, record } = context;

  if (!record || !record.id) {
    throw new Error('Record ID is fundamentally missing for updateField execution.');
  }

  // Strict sanitize layer to prevent severe SQL injection vectors 
  const safeEntity = entity.replace(/[^a-z_]/gi, '');
  const safeField = field.replace(/[^a-z_]/gi, '');

  if (!safeEntity || !safeField) {
    throw new Error('Invalid entity or field configuration syntax detected.');
  }

  const tableName = safeEntity + 's'; 

  let query;
  if (relative && typeof value === 'number') {
    query = `
      UPDATE ${tableName}
      SET ${safeField} = COALESCE(${safeField}, 0) + $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `;
  } else {
    query = `
      UPDATE ${tableName}
      SET ${safeField} = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `;
  }

  await pool.query(query, [value, record.id, tenantId]);
}

module.exports = { handle };
