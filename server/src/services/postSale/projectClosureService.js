const pool = require('../../db/pool');
const { logAction } = require('../auditLog');

/**
 * Run automatic system verification checks for project closure gates.
 */
async function runAutoVerification(projectId, tenantId, client = pool) {
  // 1. Financial Clearance check
  const unpaidRes = await client.query(
    `SELECT COUNT(*)::int as count 
     FROM payment_milestones 
     WHERE project_id = $1 AND tenant_id = $2 
       AND status != 'paid' AND is_deferred = false`,
    [projectId, tenantId]
  );
  const unpaidCount = unpaidRes.rows[0]?.count || 0;
  const financialClearance = {
    passed: unpaidCount === 0,
    message: unpaidCount === 0 
      ? 'All payment milestones are paid or deferred.' 
      : `${unpaidCount} unpaid payment milestone(s) pending clearance.`
  };

  // 2. Task Completion check
  const openTasksRes = await client.query(
    `SELECT COUNT(*)::int as count 
     FROM tasks 
     WHERE project_id = $1 AND tenant_id = $2 
       AND status != 'done' AND deleted_at IS NULL`,
    [projectId, tenantId]
  );
  const openTasksCount = openTasksRes.rows[0]?.count || 0;
  const taskCompletion = {
    passed: openTasksCount === 0,
    message: openTasksCount === 0 
      ? 'All project tasks are completed.' 
      : `${openTasksCount} task(s) pending completion.`
  };

  // 3. Snag Closure check
  const openSnagsRes = await client.query(
    `SELECT COUNT(*)::int as count 
     FROM snags 
     WHERE project_id = $1 AND tenant_id = $2 
       AND status NOT IN ('resolved', 'client_verified')`,
    [projectId, tenantId]
  );
  const openSnagsCount = openSnagsRes.rows[0]?.count || 0;

  const openPunchItemsRes = await client.query(
    `SELECT COUNT(pli.id)::int as count 
     FROM punch_list_items pli 
     JOIN punch_lists pl ON pli.punch_list_id = pl.id 
     WHERE pl.project_id = $1 AND pli.tenant_id = $2 
       AND pli.status NOT IN ('resolved', 'verified')`,
    [projectId, tenantId]
  );
  const openPunchItemsCount = openPunchItemsRes.rows[0]?.count || 0;
  
  const snagClosurePassed = openSnagsCount === 0 && openPunchItemsCount === 0;
  let snagMessage = 'All snags and punch list defects are closed.';
  if (!snagClosurePassed) {
    const parts = [];
    if (openSnagsCount > 0) parts.push(`${openSnagsCount} open snag(s)`);
    if (openPunchItemsCount > 0) parts.push(`${openPunchItemsCount} open punch list item(s)`);
    snagMessage = `${parts.join(' and ')} pending resolution.`;
  }
  const snagClosure = {
    passed: snagClosurePassed,
    message: snagMessage
  };

  // 4. Document Archive check
  const unapprovedDocsRes = await client.query(
    `SELECT COUNT(*)::int as count 
     FROM documents 
     WHERE project_id = $1 AND tenant_id = $2 
       AND status != 'approved'`,
    [projectId, tenantId]
  );
  const unapprovedDocsCount = unapprovedDocsRes.rows[0]?.count || 0;

  const totalDocsRes = await client.query(
    `SELECT COUNT(*)::int as count 
     FROM documents 
     WHERE project_id = $1 AND tenant_id = $2`,
    [projectId, tenantId]
  );
  const totalDocsCount = totalDocsRes.rows[0]?.count || 0;

  const documentArchive = {
    passed: unapprovedDocsCount === 0,
    message: totalDocsCount === 0 
      ? 'No documents uploaded for this project yet.' 
      : unapprovedDocsCount === 0 
        ? `All ${totalDocsCount} uploaded document(s) are approved.` 
        : `${unapprovedDocsCount} document(s) pending approval.`
  };

  // 5. Warranty Activation check
  const activeWarrantiesRes = await client.query(
    `SELECT COUNT(*)::int as count 
     FROM warranties 
     WHERE project_id = $1 AND tenant_id = $2 
       AND status = 'active'`,
    [projectId, tenantId]
  );
  const activeWarrantiesCount = activeWarrantiesRes.rows[0]?.count || 0;
  const warrantyActivation = {
    passed: activeWarrantiesCount > 0,
    message: activeWarrantiesCount > 0 
      ? `${activeWarrantiesCount} active warranty/warranties registered.` 
      : 'No active warranties registered for this project.'
  };

  return {
    financialClearance,
    taskCompletion,
    snagClosure,
    documentArchive,
    warrantyActivation
  };
}

/**
 * Fetch a project closure checklist, or create one if it doesn't exist yet.
 */
async function getOrCreateClosureChecklist(projectId, tenantId) {
  // First verify the project exists
  const projRes = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [projectId, tenantId]
  );
  if (projRes.rows.length === 0) {
    const err = new Error('PROJECT_NOT_FOUND');
    err.status = 404;
    throw err;
  }

  // Fetch checklist
  const res = await pool.query(
    'SELECT * FROM project_closure_checklists WHERE project_id = $1 AND tenant_id = $2',
    [projectId, tenantId]
  );

  let checklist;
  if (res.rows.length === 0) {
    // Create new checklist
    const insertRes = await pool.query(
      `INSERT INTO project_closure_checklists (tenant_id, project_id, status)
       VALUES ($1, $2, 'in_progress')
       RETURNING *`,
      [tenantId, projectId]
    );
    checklist = insertRes.rows[0];
  } else {
    checklist = res.rows[0];
  }

  const autoVerification = await runAutoVerification(projectId, tenantId);

  return {
    checklist,
    autoVerification
  };
}

/**
 * Update the checklist manual gates verification and notes.
 */
async function updateClosureChecklist(projectId, tenantId, userId, data) {
  const { checklist } = await getOrCreateClosureChecklist(projectId, tenantId);
  
  const gates = [
    'financial_clearance',
    'task_completion',
    'snag_closure',
    'document_archive',
    'warranty_activation'
  ];

  const updateFields = [];
  const values = [];
  let idx = 1;

  for (const gate of gates) {
    const completedKey = `${gate}_completed`;
    const notesKey = `${gate}_notes`;
    const verifiedByKey = `${gate}_verified_by`;
    const verifiedAtKey = `${gate}_verified_at`;

    if (data[completedKey] !== undefined) {
      const isCompleted = !!data[completedKey];
      
      updateFields.push(`${completedKey} = $${idx}`);
      values.push(isCompleted);
      idx++;

      // Handle transitioning of verified_by and verified_at
      const wasCompleted = !!checklist[completedKey];
      if (isCompleted && !wasCompleted) {
        updateFields.push(`${verifiedByKey} = $${idx}`);
        values.push(userId);
        idx++;

        updateFields.push(`${verifiedAtKey} = CURRENT_TIMESTAMP`);
      } else if (!isCompleted && wasCompleted) {
        updateFields.push(`${verifiedByKey} = NULL`);
        updateFields.push(`${verifiedAtKey} = NULL`);
      }
    }

    if (data[notesKey] !== undefined) {
      updateFields.push(`${notesKey} = $${idx}`);
      values.push(data[notesKey]);
      idx++;
    }
  }

  if (updateFields.length === 0) {
    const autoVerification = await runAutoVerification(projectId, tenantId);
    return { checklist, autoVerification };
  }

  // Determine updated status
  // Build a query to update first, and then fetch the result to determine status
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    values.push(checklist.id, tenantId);
    const updateQuery = `
      UPDATE project_closure_checklists
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${idx} AND tenant_id = $${idx + 1}
      RETURNING *
    `;

    const { rows } = await client.query(updateQuery, values);
    let updatedChecklist = rows[0];

    // Recalculate overall checklist status based on updated checklist values
    const allCompleted = 
      updatedChecklist.financial_clearance_completed &&
      updatedChecklist.task_completion_completed &&
      updatedChecklist.snag_closure_completed &&
      updatedChecklist.document_archive_completed &&
      updatedChecklist.warranty_activation_completed;

    const newStatus = allCompleted ? 'completed' : 'in_progress';
    if (newStatus !== updatedChecklist.status) {
      const statusRes = await client.query(
        `UPDATE project_closure_checklists 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING *`,
        [newStatus, updatedChecklist.id]
      );
      updatedChecklist = statusRes.rows[0];
    }

    // Log audit action
    const oldValues = {};
    const newValues = {};
    for (const key of Object.keys(data)) {
      if (checklist[key] !== updatedChecklist[key]) {
        oldValues[key] = checklist[key];
        newValues[key] = updatedChecklist[key];
      }
    }

    if (Object.keys(newValues).length > 0) {
      await logAction({
        tenantId,
        userId,
        action: 'project.closure_checklist_updated',
        entity: 'project',
        entityId: projectId,
        oldValue: oldValues,
        newValue: newValues
      });
    }

    await client.query('COMMIT');

    const autoVerification = await runAutoVerification(projectId, tenantId);
    return {
      checklist: updatedChecklist,
      autoVerification
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verify if the project is ready for closure. Called when project transitions to completed.
 */
async function verifyProjectClosureReady(projectId, tenantId) {
  const res = await pool.query(
    'SELECT * FROM project_closure_checklists WHERE project_id = $1 AND tenant_id = $2',
    [projectId, tenantId]
  );
  
  if (res.rows.length === 0) {
    const error = new Error('PROJECT_CLOSURE_CHECKLIST_MISSING');
    error.message = 'Cannot complete project: Project closure checklist has not been created.';
    error.status = 400;
    throw error;
  }

  const checklist = res.rows[0];
  if (
    !checklist.financial_clearance_completed ||
    !checklist.task_completion_completed ||
    !checklist.snag_closure_completed ||
    !checklist.document_archive_completed ||
    !checklist.warranty_activation_completed
  ) {
    const error = new Error('PROJECT_CLOSURE_CHECKLIST_INCOMPLETE');
    error.message = 'Cannot complete project: All project closure checklist gates must be verified and completed.';
    error.status = 400;
    throw error;
  }

  return true;
}

module.exports = {
  getOrCreateClosureChecklist,
  updateClosureChecklist,
  verifyProjectClosureReady
};
