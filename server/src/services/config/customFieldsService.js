const pool = require('../../db/pool');

/**
 * Retrieves all active custom fields for a specific entity, ordered by sort_order.
 */
async function getFields(tenantId, entity) {
  const query = `
    SELECT id, entity, name, label, field_type, options, is_required, visible_to_roles, sort_order, is_active
    FROM custom_fields_config
    WHERE tenant_id = $1 AND entity = $2 AND is_active = true
    ORDER BY sort_order ASC, created_at ASC
  `;
  const result = await pool.query(query, [tenantId, entity]);
  return result.rows;
}

/**
 * Adds a new custom field configuration.
 */
async function addField(tenantId, fieldData) {
  const {
    entity, name, label, field_type, options = [], is_required = false,
    visible_to_roles = ['all'], sort_order = 0
  } = fieldData;

  const query = `
    INSERT INTO custom_fields_config (
      tenant_id, entity, name, label, field_type, options, is_required, visible_to_roles, sort_order
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9)
    RETURNING id, entity, name, label, field_type, options, is_required, visible_to_roles, sort_order, is_active
  `;

  const result = await pool.query(query, [
    tenantId,
    entity,
    name,
    label,
    field_type,
    JSON.stringify(options),
    is_required,
    JSON.stringify(visible_to_roles),
    sort_order
  ]);

  return result.rows[0];
}

/**
 * Updates an existing custom field configuration.
 * Prevents changing the machine 'name' or 'entity' to avoid schema collisions on existing data.
 */
async function updateField(tenantId, fieldId, updates) {
  const allowedFields = ['label', 'options', 'is_required', 'visible_to_roles', 'sort_order', 'is_active'];
  const sets = [];
  const values = [tenantId, fieldId];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      sets.push(`${key} = $${paramIndex}`);
      // Explicitly serialize JSON arrays to JSON strings for parameterized insert
      values.push(key === 'options' || key === 'visible_to_roles' ? JSON.stringify(value) : value);
      paramIndex++;
    }
  }

  if (sets.length === 0) {
    throw new Error('No valid fields provided for update');
  }

  const query = `
    UPDATE custom_fields_config
    SET ${sets.join(', ')}
    WHERE id = $2 AND tenant_id = $1
    RETURNING id, entity, name, label, field_type, options, is_required, visible_to_roles, sort_order, is_active
  `;

  const result = await pool.query(query, values);
  
  if (result.rows.length === 0) {
    throw new Error('NOT_FOUND');
  }

  return result.rows[0];
}

/**
 * Soft deletes a custom field configuration by setting is_active to false.
 */
async function deleteField(tenantId, fieldId) {
  const query = `
    UPDATE custom_fields_config
    SET is_active = false
    WHERE id = $2 AND tenant_id = $1
  `;
  await pool.query(query, [tenantId, fieldId]);
}

/**
 * Generates a JSON Schema object dynamically based on active custom fields for an entity.
 * Designed to be consumed by Zod/Ajv to validate incoming arbitrary JSONB payloads.
 */
async function renderSchema(tenantId, entity) {
  const fields = await getFields(tenantId, entity);

  const schema = {
    type: 'object',
    properties: {},
    required: []
  };

  for (const field of fields) {
    let fieldSchema;

    switch (field.field_type) {
      case 'text':
        fieldSchema = { type: 'string' };
        break;
      case 'number':
        fieldSchema = { type: 'number' };
        break;
      case 'date':
        fieldSchema = { type: 'string', format: 'date' };
        break;
      case 'dropdown':
        fieldSchema = { type: 'string', enum: field.options || [] };
        break;
      case 'multi_select':
        fieldSchema = { 
          type: 'array', 
          items: { type: 'string', enum: field.options || [] } 
        };
        break;
      case 'boolean':
        fieldSchema = { type: 'boolean' };
        break;
      case 'file':
        fieldSchema = { type: 'string', format: 'uri' }; // Representing S3/cloud URL
        break;
      default:
        fieldSchema = { type: 'string' };
    }

    schema.properties[field.name] = fieldSchema;

    if (field.is_required) {
      schema.required.push(field.name);
    }
  }

  // Remove the required array entirely if empty to ensure strictly valid JSON schema definitions
  if (schema.required.length === 0) {
    delete schema.required;
  }

  return schema;
}

module.exports = {
  getFields,
  addField,
  updateField,
  deleteField,
  renderSchema
};
