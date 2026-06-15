const pool = require('../../../../db/pool');

/**
 * Update Field Action Handler
 * Dynamically updates a specific field directly on a target entity record.
 */
async function handle(config, context) {
  const { entity, field, value } = config;
  const { tenantId, record } = context;

  if (!record || !record.id) {
    throw new Error('Record ID is fundamentally missing for updateField execution.');
  }

  // Strict sanitize layer to prevent severe SQL injection vectors 
  // since table and column names cannot be strictly parameterized via $1 syntax.
  const safeEntity = entity.replace(/[^a-z_]/gi, '');
  const safeField = field.replace(/[^a-z_]/gi, '');

  if (!safeEntity || !safeField) {
    throw new Error('Invalid entity or field configuration syntax detected.');
  }

  // Standardize the target table string resolution (e.g. 'lead' -> 'leads')
  const tableName = safeEntity + 's'; 

  const query = `
    UPDATE ${tableName}
    SET ${safeField} = $1, updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3
  `;

  await pool.query(query, [value, record.id, tenantId]);
}

module.exports = { handle };
