const pool = require('../../db/pool');

async function getContacts({ tenantId, leadId }) {
  const result = await pool.query(
    'SELECT * FROM lead_contacts WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at ASC',
    [leadId, tenantId]
  );
  return result.rows;
}

async function createContact({ tenantId, leadId, name, phone, email, role, decision_authority, relationship_notes }) {
  const result = await pool.query(
    `INSERT INTO lead_contacts (tenant_id, lead_id, name, phone, email, role, decision_authority, relationship_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [tenantId, leadId, name, phone, email, role, decision_authority, relationship_notes]
  );
  return result.rows[0];
}

async function updateContact({ tenantId, leadId, cid, name, phone, email, role, decision_authority, relationship_notes }) {
  const result = await pool.query(
    `UPDATE lead_contacts 
     SET name = $1, phone = $2, email = $3, role = $4, decision_authority = $5, relationship_notes = $6, updated_at = NOW()
     WHERE id = $7 AND lead_id = $8 AND tenant_id = $9 RETURNING *`,
    [name, phone, email, role, decision_authority, relationship_notes, cid, leadId, tenantId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Contact not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

async function deleteContact({ tenantId, leadId, cid }) {
  await pool.query('DELETE FROM lead_contacts WHERE id = $1 AND lead_id = $2 AND tenant_id = $3', [cid, leadId, tenantId]);
  return true;
}

module.exports = {
  getContacts,
  createContact,
  updateContact,
  deleteContact
};
