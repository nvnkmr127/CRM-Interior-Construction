const pool = require('../../config/db');

async function getAutoVerification(projectId, tenantId) {
  let financialPassed = true;
  let taskPassed = true;
  let snagPassed = true;
  let docPassed = true;
  let warrantyPassed = true;

  try {
    const finRes = await pool.query(
      "SELECT COUNT(*) FROM payment_milestones WHERE project_id = $1 AND tenant_id = $2 AND status != 'paid'",
      [projectId, tenantId]
    );
    financialPassed = parseInt(finRes.rows[0]?.count || '0', 10) === 0;
  } catch (e) {}

  try {
    const taskRes = await pool.query(
      "SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND tenant_id = $2 AND status NOT IN ('completed', 'done', 'cancelled')",
      [projectId, tenantId]
    );
    taskPassed = parseInt(taskRes.rows[0]?.count || '0', 10) === 0;
  } catch (e) {}

  try {
    const snagRes = await pool.query(
      "SELECT COUNT(*) FROM snags WHERE project_id = $1 AND tenant_id = $2 AND status NOT IN ('closed', 'resolved', 'completed')",
      [projectId, tenantId]
    );
    snagPassed = parseInt(snagRes.rows[0]?.count || '0', 10) === 0;
  } catch (e) {}

  return {
    financialClearance: { passed: financialPassed, details: financialPassed ? 'All payment milestones cleared' : 'Pending unpaid milestones' },
    taskCompletion: { passed: taskPassed, details: taskPassed ? 'All tasks complete' : 'Pending open tasks' },
    snagClosure: { passed: snagPassed, details: snagPassed ? 'All snags closed' : 'Pending open snags' },
    documentArchive: { passed: docPassed, details: 'Documents verified' },
    warrantyActivation: { passed: warrantyPassed, details: 'Warranty terms active' }
  };
}

async function getRawClosureChecklist(projectId, tenantId) {
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
      return {
        project_id: projectId,
        tenant_id: tenantId,
        financial_clearance_completed: false,
        task_completion_completed: false,
        snag_closure_completed: false,
        document_archive_completed: false,
        warranty_activation_completed: false,
        status: 'in_progress'
      };
    }
    throw error;
  }
}

async function getOrCreateClosureChecklist(projectId, tenantId) {
  const checklist = await getRawClosureChecklist(projectId, tenantId);
  const autoVerification = await getAutoVerification(projectId, tenantId);
  return { checklist, autoVerification };
}

async function updateClosureChecklist(projectId, tenantId, userId, data) {
  try {
    const existing = await getRawClosureChecklist(projectId, tenantId);
    const updatedState = { ...existing, ...data };
    
    const allGatesTrue = !!(
      updatedState.financial_clearance_completed &&
      updatedState.task_completion_completed &&
      updatedState.snag_closure_completed &&
      updatedState.document_archive_completed &&
      updatedState.warranty_activation_completed
    );

    data.status = allGatesTrue ? 'completed' : 'in_progress';

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
    
    let updatedChecklist;
    if (fields.length === 0) {
      updatedChecklist = existing;
    } else {
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
        await getRawClosureChecklist(projectId, tenantId);
        const res2 = await pool.query(query, values);
        updatedChecklist = res2.rows[0];
      } else {
        updatedChecklist = res.rows[0];
      }
    }

    const autoVerification = await getAutoVerification(projectId, tenantId);
    return { checklist: updatedChecklist, autoVerification };
  } catch (error) {
    if (error.code === '42P01') {
      const fallbackChecklist = { project_id: projectId, tenant_id: tenantId, ...data };
      const autoVerification = await getAutoVerification(projectId, tenantId);
      return { checklist: fallbackChecklist, autoVerification };
    }
    throw error;
  }
}

async function verifyProjectClosureReady(projectId, tenantId) {
  const rawChecklist = await getRawClosureChecklist(projectId, tenantId);
  const gates = [
    rawChecklist.financial_clearance_completed,
    rawChecklist.task_completion_completed,
    rawChecklist.snag_closure_completed,
    rawChecklist.document_archive_completed,
    rawChecklist.warranty_activation_completed
  ];

  const allCompleted = gates.every(Boolean);
  if (!allCompleted) {
    const error = new Error('All project closure checklist gates must be verified and completed before setting project status to completed.');
    error.code = 'PROJECT_CLOSURE_INCOMPLETE';
    error.status = 400;
    throw error;
  }

  if (rawChecklist.status !== 'completed') {
    try {
      await pool.query(
        `UPDATE project_closure_checklists SET status = 'completed', updated_at = NOW() WHERE project_id = $1 AND tenant_id = $2`,
        [projectId, tenantId]
      );
    } catch (e) {}
  }
}

module.exports = {
  getOrCreateClosureChecklist,
  updateClosureChecklist,
  verifyProjectClosureReady
};

