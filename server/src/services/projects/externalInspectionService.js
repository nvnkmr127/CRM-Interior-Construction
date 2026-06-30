const { pool } = require('../../config/db');

exports.getExternalInspections = async ({ tenantId, projectId }) => {
  const result = await pool.query(
    `SELECT * FROM external_inspections 
     WHERE tenant_id = $1 AND project_id = $2 
     ORDER BY inspection_date DESC, created_at DESC`,
    [tenantId, projectId]
  );
  return result.rows;
};

exports.createExternalInspection = async ({ tenantId, projectId, inspectorName, organization, inspectionDate, findings, severity, userId }) => {
  const result = await pool.query(
    `INSERT INTO external_inspections 
      (tenant_id, project_id, inspector_name, organization, inspection_date, findings, severity, created_by) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
     RETURNING *`,
    [tenantId, projectId, inspectorName, organization, inspectionDate, findings, severity, userId]
  );
  return result.rows[0];
};

exports.updateExternalInspection = async ({ tenantId, projectId, id, updates }) => {
  const { inspectorName, organization, inspectionDate, findings, severity, status } = updates;
  
  const setClauses = [];
  const values = [];
  let index = 1;

  if (inspectorName !== undefined) { setClauses.push(`inspector_name = $${index++}`); values.push(inspectorName); }
  if (organization !== undefined) { setClauses.push(`organization = $${index++}`); values.push(organization); }
  if (inspectionDate !== undefined) { setClauses.push(`inspection_date = $${index++}`); values.push(inspectionDate); }
  if (findings !== undefined) { setClauses.push(`findings = $${index++}`); values.push(findings); }
  if (severity !== undefined) { setClauses.push(`severity = $${index++}`); values.push(severity); }
  if (status !== undefined) { setClauses.push(`status = $${index++}`); values.push(status); }

  if (setClauses.length === 0) {
    const res = await pool.query(`SELECT * FROM external_inspections WHERE id = $1 AND tenant_id = $2 AND project_id = $3`, [id, tenantId, projectId]);
    return res.rows[0];
  }

  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  
  const query = `
    UPDATE external_inspections 
    SET ${setClauses.join(', ')} 
    WHERE id = $${index++} AND tenant_id = $${index++} AND project_id = $${index} 
    RETURNING *
  `;
  
  values.push(id, tenantId, projectId);

  const result = await pool.query(query, values);
  if (result.rows.length === 0) {
    throw new Error('External inspection not found or access denied');
  }
  return result.rows[0];
};

exports.deleteExternalInspection = async ({ tenantId, projectId, id }) => {
  const result = await pool.query(
    `DELETE FROM external_inspections WHERE id = $1 AND tenant_id = $2 AND project_id = $3 RETURNING id`,
    [id, tenantId, projectId]
  );
  if (result.rows.length === 0) {
    throw new Error('External inspection not found or access denied');
  }
  return true;
};
