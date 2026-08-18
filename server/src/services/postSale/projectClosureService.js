const pool = require('../../config/db');

async function getOrCreateClosureChecklist(projectId, tenantId) {
  try {
    const res = await pool.query(
      'SELECT * FROM project_closure_checklists WHERE project_id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );
    if (res.rows.length > 0) return res.rows[0];
    
    const insertRes = await pool.query(
      `INSERT INTO project_closure_checklists (project_id, tenant_id) 
       VALUES ($1, $2) RETURNING *`,
      [projectId, tenantId]
    );
    return insertRes.rows[0];
  } catch (error) {
    if (error.code === '42P01') {
      return { project_id: projectId, tenant_id: tenantId };
    }
    throw error;
  }
}

async function updateClosureChecklist(projectId, tenantId, userId, data) {
  try {
    const fields = [];
    const values = [];
    let i = 1;
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        fields.push(`${key} = $${i}`);
        values.push(value);
        i++;
        
        // If a section is marked completed, set verified_by and verified_at
        if (key.endsWith('_completed')) {
          const section = key.replace('_completed', '');
          if (value === true) {
             fields.push(`${section}_verified_by = $${i}`);
             values.push(userId);
             i++;
             fields.push(`${section}_verified_at = NOW()`);
          } else {
             fields.push(`${section}_verified_by = NULL`);
             fields.push(`${section}_verified_at = NULL`);
          }
        }
      }
    }
    
    if (fields.length === 0) return await getOrCreateClosureChecklist(projectId, tenantId);
    
    fields.push(`updated_at = NOW()`);
    values.push(projectId, tenantId);
    
    const query = `
      UPDATE project_closure_checklists
      SET ${fields.join(', ')}
      WHERE project_id = $${i} AND tenant_id = $${i+1}
      RETURNING *
    `;
    
    const res = await pool.query(query, values);
    if (res.rows.length === 0) {
      await getOrCreateClosureChecklist(projectId, tenantId);
      const res2 = await pool.query(query, values);
      return res2.rows[0];
    }
    return res.rows[0];
  } catch (error) {
    if (error.code === '42P01') {
      return { project_id: projectId, tenant_id: tenantId, ...data };
    }
    throw error;
  }
}

module.exports = {
  getOrCreateClosureChecklist,
  updateClosureChecklist
};
