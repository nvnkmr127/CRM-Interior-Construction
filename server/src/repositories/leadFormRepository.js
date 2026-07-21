const pool = require('../db/pool');

async function createForm(tenantId, data) {
  const { name, slug, description, successMessage, redirectUrl, leadSource, assigneeId, status, fields, settings } = data;
  const res = await pool.query(
    `INSERT INTO lead_forms (tenant_id, name, slug, description, success_message, redirect_url, lead_source, assignee_id, status, fields, settings)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [tenantId, name, slug, description, successMessage, redirectUrl, leadSource, assigneeId, status || 'active', JSON.stringify(fields || []), JSON.stringify(settings || {})]
  );
  return res.rows[0];
}

async function getForms(tenantId) {
  const res = await pool.query(
    `SELECT * FROM lead_forms WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return res.rows;
}

async function getFormById(tenantId, formId) {
  const res = await pool.query(
    `SELECT * FROM lead_forms WHERE tenant_id = $1 AND id = $2`,
    [tenantId, formId]
  );
  return res.rows[0];
}

async function getFormBySlug(tenantId, slug) {
  const res = await pool.query(
    `SELECT * FROM lead_forms WHERE tenant_id = $1 AND slug = $2`,
    [tenantId, slug]
  );
  return res.rows[0];
}

async function updateForm(tenantId, formId, data) {
  const { name, slug, description, successMessage, redirectUrl, leadSource, assigneeId, status, fields, settings } = data;
  const res = await pool.query(
    `UPDATE lead_forms 
     SET name = $1, slug = $2, description = $3, success_message = $4, redirect_url = $5, 
         lead_source = $6, assignee_id = $7, status = $8, fields = $9, settings = $10, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $11 AND id = $12
     RETURNING *`,
    [name, slug, description, successMessage, redirectUrl, leadSource, assigneeId, status, JSON.stringify(fields || []), JSON.stringify(settings || {}), tenantId, formId]
  );
  return res.rows[0];
}

async function deleteForm(tenantId, formId) {
  await pool.query(
    `DELETE FROM lead_forms WHERE tenant_id = $1 AND id = $2`,
    [tenantId, formId]
  );
}

async function incrementFormViews(tenantId, formId) {
  await pool.query(
    `UPDATE lead_forms SET views = views + 1 WHERE tenant_id = $1 AND id = $2`,
    [tenantId, formId]
  );
}

async function createSubmission(tenantId, formId, data, ipAddress, userAgent, leadId) {
  const res = await pool.query(
    `INSERT INTO lead_form_submissions (tenant_id, form_id, data, ip_address, user_agent, lead_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [tenantId, formId, JSON.stringify(data), ipAddress, userAgent, leadId]
  );
  
  await pool.query(
    `UPDATE lead_forms SET submissions = submissions + 1 WHERE tenant_id = $1 AND id = $2`,
    [tenantId, formId]
  );
  
  return res.rows[0];
}

async function getSubmissionsByFormId(tenantId, formId) {
  const res = await pool.query(
    `SELECT * FROM lead_form_submissions WHERE tenant_id = $1 AND form_id = $2 ORDER BY created_at DESC`,
    [tenantId, formId]
  );
  return res.rows;
}

module.exports = {
  createForm,
  getForms,
  getFormById,
  getFormBySlug,
  updateForm,
  deleteForm,
  incrementFormViews,
  createSubmission,
  getSubmissionsByFormId
};
