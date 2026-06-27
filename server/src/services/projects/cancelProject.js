const pool = require('../../db/pool');
const { logAction } = require('../auditLog');

/**
 * Cancels a project, calculating financial settlements, releasing team resources, 
 * updating cancellation state, enqueuing PDF closure documents, and logging audit events.
 */
async function cancelProject({ projectId, tenantId, userId, reason, settlementNotes, refundOverride, recoverOverride }) {
  const currentRes = await pool.query(
    'SELECT id, name, status, contract_value FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [projectId, tenantId]
  );
  if (currentRes.rows.length === 0) {
    const err = new Error('PROJECT_NOT_FOUND');
    err.status = 404;
    throw err;
  }
  const project = currentRes.rows[0];

  if (project.status === 'cancelled' || project.status === 'completed') {
    const err = new Error('PROJECT_ALREADY_CLOSED');
    err.message = `Cannot cancel a project in status: ${project.status}`;
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Calculate default financial settlement numbers
    // Sum of paid payment milestones
    const paidMilestonesRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric as total_paid 
       FROM payment_milestones 
       WHERE project_id = $1 AND tenant_id = $2 AND status = 'paid'`,
      [projectId, tenantId]
    );
    const totalPaid = parseFloat(paidMilestonesRes.rows[0].total_paid);

    // Sum of completed work activities ratio
    const totalActRes = await client.query(
      `SELECT count(*)::int as count FROM project_work_activities 
       WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );
    const totalActivities = totalActRes.rows[0].count;

    const compActRes = await client.query(
      `SELECT count(*)::int as count FROM project_work_activities 
       WHERE project_id = $1 AND tenant_id = $2 AND status = 'completed'`,
      [projectId, tenantId]
    );
    const completedActivities = compActRes.rows[0].count;

    const completedRatio = totalActivities > 0 ? (completedActivities / totalActivities) : 1.0;
    const completedWorkValue = parseFloat(project.contract_value || 0) * completedRatio;

    let refundAmount = 0;
    let recoverAmount = 0;

    if (totalPaid > completedWorkValue) {
      refundAmount = totalPaid - completedWorkValue;
    } else if (completedWorkValue > totalPaid) {
      recoverAmount = completedWorkValue - totalPaid;
    }

    // Apply manual overrides if provided
    if (refundOverride !== undefined && refundOverride !== null) {
      refundAmount = parseFloat(refundOverride);
    }
    if (recoverOverride !== undefined && recoverOverride !== null) {
      recoverAmount = parseFloat(recoverOverride);
    }

    // 2. Update project status and cancellation settlement
    const updateRes = await client.query(
      `UPDATE projects 
       SET status = 'cancelled',
           cancellation_reason = $1,
           cancelled_at = NOW(),
           cancelled_by = $2,
           settlement_amount_refunded = $3,
           settlement_amount_recovered = $4,
           settlement_status = 'pending_acknowledgement',
           settlement_notes = $5,
           updated_at = NOW()
       WHERE id = $6 AND tenant_id = $7
       RETURNING *`,
      [reason, userId, refundAmount, recoverAmount, settlementNotes || null, projectId, tenantId]
    );
    const updatedProject = updateRes.rows[0];

    // 3. Resource Reallocation Trigger: Deactivate all project site team members
    await client.query(
      `UPDATE project_site_team
       SET status = 'inactive',
           updated_at = NOW()
       WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );

    // 4. Enqueue closure document generation job
    await client.query(
      `INSERT INTO automation_jobs (tenant_id, event_type, entity, record)
       VALUES ($1, 'generate_project_cancellation_pdf', 'project', $2)`,
      [tenantId, JSON.stringify({ projectId, cancellationReason: reason, refundAmount, recoverAmount })]
    );

    // 5. Log audit action
    await logAction({
      tenantId,
      userId,
      action: 'project.cancelled',
      entity: 'project',
      entityId: projectId,
      oldValue: { status: project.status },
      newValue: { status: 'cancelled', reason, refundAmount, recoverAmount }
    }, client);

    await client.query('COMMIT');
    return updatedProject;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Acknowledges the cancellation settlement by the client.
 */
async function acknowledgeCancellation({ projectId, tenantId, userId }) {
  const currentRes = await pool.query(
    'SELECT id, status, cancellation_client_acknowledged FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [projectId, tenantId]
  );
  if (currentRes.rows.length === 0) {
    const err = new Error('PROJECT_NOT_FOUND');
    err.status = 404;
    throw err;
  }
  const project = currentRes.rows[0];

  if (project.status !== 'cancelled') {
    const err = new Error('PROJECT_NOT_CANCELLED');
    err.message = 'Only cancelled projects can have their settlements acknowledged.';
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `UPDATE projects 
     SET cancellation_client_acknowledged = TRUE,
         cancellation_client_acknowledged_at = NOW(),
         settlement_status = 'settled',
         updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [projectId, tenantId]
  );

  return rows[0];
}

module.exports = { cancelProject, acknowledgeCancellation };
