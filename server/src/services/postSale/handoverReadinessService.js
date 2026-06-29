const pool = require('../../config/db');

/**
 * Evaluates the 5 handover readiness gates for a project.
 */
async function evaluateReadinessGates(projectId, tenantId, client = pool) {
  // 1. Tasks Completed check
  const tasksRes = await client.query(
    `SELECT COUNT(*)::int as total,
            COUNT(CASE WHEN status != 'done' THEN 1 END)::int as open
     FROM tasks
     WHERE project_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [projectId, tenantId]
  );
  const totalTasks = tasksRes.rows[0]?.total || 0;
  const openTasks = tasksRes.rows[0]?.open || 0;
  const tasksCompleted = {
    passed: openTasks === 0,
    total: totalTasks,
    open: openTasks,
    message: openTasks === 0
      ? 'All project tasks are completed.'
      : `${openTasks} of ${totalTasks} task(s) pending completion.`
  };

  // 2. Snags & Punch Lists Resolved check
  const snagsRes = await client.query(
    `SELECT COUNT(*)::int as count 
     FROM snags 
     WHERE project_id = $1 AND tenant_id = $2 
       AND status NOT IN ('resolved', 'closed', 'client_verified')`,
    [projectId, tenantId]
  );
  const openSnags = snagsRes.rows[0]?.count || 0;

  const punchRes = await client.query(
    `SELECT COUNT(pli.id)::int as count 
     FROM punch_list_items pli 
     JOIN punch_lists pl ON pli.punch_list_id = pl.id 
     WHERE pl.project_id = $1 AND pli.tenant_id = $2 
       AND pli.status NOT IN ('resolved', 'verified')`,
    [projectId, tenantId]
  );
  const openPunchItems = punchRes.rows[0]?.count || 0;

  const totalOpenIssues = openSnags + openPunchItems;
  const snagsResolved = {
    passed: totalOpenIssues === 0,
    openSnags,
    openPunchItems,
    message: totalOpenIssues === 0
      ? 'All snags and punch list items are fully resolved.'
      : `${openSnags} snag(s) and ${openPunchItems} punch item(s) pending resolution.`
  };

  // 3. Payments Cleared or Deferred check
  const pmRes = await client.query(
    `SELECT COUNT(*)::int as total,
            COUNT(CASE WHEN status != 'paid' AND is_deferred = false THEN 1 END)::int as unpaid
     FROM payment_milestones
     WHERE project_id = $1 AND tenant_id = $2`,
    [projectId, tenantId]
  );
  const totalMilestones = pmRes.rows[0]?.total || 0;
  const unpaidMilestones = pmRes.rows[0]?.unpaid || 0;
  const paymentsCleared = {
    passed: unpaidMilestones === 0,
    total: totalMilestones,
    unpaid: unpaidMilestones,
    message: unpaidMilestones === 0
      ? 'All payment milestones are paid or formally deferred.'
      : `${unpaidMilestones} payment milestone(s) pending clearance.`
  };

  // 4. Documents Uploaded & Approved check
  const docsRes = await client.query(
    `SELECT COUNT(*)::int as total,
            COUNT(CASE WHEN status != 'approved' THEN 1 END)::int as unapproved
     FROM documents
     WHERE project_id = $1 AND tenant_id = $2`,
    [projectId, tenantId]
  );
  const totalDocs = docsRes.rows[0]?.total || 0;
  const unapprovedDocs = docsRes.rows[0]?.unapproved || 0;
  const documentsUploaded = {
    passed: totalDocs > 0 && unapprovedDocs === 0,
    total: totalDocs,
    unapproved: unapprovedDocs,
    message: totalDocs === 0
      ? 'No documents uploaded. At least one approved document (e.g. final drawings/handover form) is required.'
      : unapprovedDocs === 0
        ? `All ${totalDocs} uploaded document(s) are approved.`
        : `${unapprovedDocs} of ${totalDocs} document(s) pending approval.`
  };

  // 5. PM Sign-Off check
  const gateRes = await client.query(
    `SELECT pm_signed_off, pm_signed_off_at, pm_signed_off_by,
            (SELECT name FROM users WHERE id = pm_signed_off_by) as pm_name
     FROM handover_readiness_gates
     WHERE project_id = $1 AND tenant_id = $2`,
    [projectId, tenantId]
  );
  const gateRow = gateRes.rows[0];
  const pmSignedOff = {
    passed: !!gateRow?.pm_signed_off,
    signedOffAt: gateRow?.pm_signed_off_at || null,
    pmName: gateRow?.pm_name || null,
    message: gateRow?.pm_signed_off
      ? `PM signed off by ${gateRow.pm_name} on ${new Date(gateRow.pm_signed_off_at).toLocaleDateString('en-IN')}.`
      : 'Project Manager sign-off is pending.'
  };

  const overallReady = tasksCompleted.passed &&
                       snagsResolved.passed &&
                       paymentsCleared.passed &&
                       documentsUploaded.passed &&
                       pmSignedOff.passed;

  return {
    projectId,
    overallReady,
    gates: {
      tasksCompleted,
      snagsResolved,
      paymentsCleared,
      documentsUploaded,
      pmSignedOff
    }
  };
}

/**
 * Allows the PM to sign off on the handover readiness.
 * Validates that all prior 4 gates are green first.
 */
async function pmSignOff(projectId, tenantId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify project exists
    const projRes = await client.query(
      `SELECT id FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [projectId, tenantId]
    );
    if (projRes.rows.length === 0) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    // 2. Evaluate gates
    const evalResult = await evaluateReadinessGates(projectId, tenantId, client);
    const { tasksCompleted, snagsResolved, paymentsCleared, documentsUploaded } = evalResult.gates;

    if (!tasksCompleted.passed || !snagsResolved.passed || !paymentsCleared.passed || !documentsUploaded.passed) {
      throw new Error('GATES_PENDING');
    }

    // 3. Upsert PM sign-off
    const upsertRes = await client.query(
      `INSERT INTO handover_readiness_gates (project_id, tenant_id, pm_signed_off, pm_signed_off_by, pm_signed_off_at)
       VALUES ($1, $2, TRUE, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (project_id)
       DO UPDATE SET pm_signed_off = TRUE,
                     pm_signed_off_by = $3,
                     pm_signed_off_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [projectId, tenantId, userId]
    );

    await client.query('COMMIT');
    return upsertRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Schedules a handover appointment.
 * Blocks scheduling if any gate is not green.
 */
async function scheduleAppointment(projectId, tenantId, appointmentDate, notes, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify project exists
    const projRes = await client.query(
      `SELECT id FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [projectId, tenantId]
    );
    if (projRes.rows.length === 0) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    // 2. Evaluate all 5 gates
    const evalResult = await evaluateReadinessGates(projectId, tenantId, client);
    if (!evalResult.overallReady) {
      throw new Error('READINESS_CHECK_FAILED');
    }

    // 3. Insert appointment
    const insertRes = await client.query(
      `INSERT INTO handover_appointments (project_id, tenant_id, appointment_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, tenantId, appointmentDate, notes, userId]
    );

    // 4. Update the project status to signify handover stage if required
    // (We keep project active or update property_handover_date)
    await client.query(
      `UPDATE projects SET property_handover_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [appointmentDate, projectId]
    );

    await client.query('COMMIT');
    return insertRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retrieves scheduled appointments for a project.
 */
async function getProjectAppointments(projectId, tenantId) {
  const res = await pool.query(
    `SELECT ha.id, ha.appointment_date::TEXT as appointment_date, ha.status, ha.notes, ha.created_at,
            u.name as creator_name
     FROM handover_appointments ha
     LEFT JOIN users u ON ha.created_by = u.id
     WHERE ha.project_id = $1 AND ha.tenant_id = $2
     ORDER BY ha.appointment_date DESC`,
    [projectId, tenantId]
  );
  return res.rows;
}

/**
 * Unified readiness dashboard for all active projects.
 */
async function getReadinessDashboard(tenantId) {
  const projectsRes = await pool.query(
    `SELECT 
       p.id as project_id,
       p.name as project_name,
       p.status as project_status,
       u.name as pm_name,
       hrg.pm_signed_off,
       hrg.pm_signed_off_at::TEXT as pm_signed_off_at,
       -- Open tasks count
       (SELECT COUNT(*)::int FROM tasks WHERE project_id = p.id AND tenant_id = p.tenant_id AND status != 'done' AND deleted_at IS NULL) as open_tasks_count,
       -- Open snags + punch items count
       (
         (SELECT COUNT(*)::int FROM snags WHERE project_id = p.id AND tenant_id = p.tenant_id AND status NOT IN ('resolved', 'closed', 'client_verified')) +
         (SELECT COUNT(pli.id)::int FROM punch_list_items pli JOIN punch_lists pl ON pli.punch_list_id = pl.id WHERE pl.project_id = p.id AND pli.tenant_id = p.tenant_id AND pli.status NOT IN ('resolved', 'verified'))
       ) as open_snags_count,
       -- Unpaid payment milestones count
       (SELECT COUNT(*)::int FROM payment_milestones WHERE project_id = p.id AND tenant_id = p.tenant_id AND status != 'paid' AND is_deferred = false) as unpaid_milestones_count,
       -- Total documents count
       (SELECT COUNT(*)::int FROM documents WHERE project_id = p.id AND tenant_id = p.tenant_id) as total_docs_count,
       -- Unapproved documents count
       (SELECT COUNT(*)::int FROM documents WHERE project_id = p.id AND tenant_id = p.tenant_id AND status != 'approved') as unapproved_docs_count,
       -- Scheduled appointment date
       (SELECT appointment_date::TEXT FROM handover_appointments WHERE project_id = p.id AND tenant_id = p.tenant_id AND status = 'scheduled' ORDER BY appointment_date DESC LIMIT 1) as next_appointment_date
     FROM projects p
     LEFT JOIN users u ON p.pm_id = u.id
     LEFT JOIN handover_readiness_gates hrg ON p.id = hrg.project_id AND p.tenant_id = hrg.tenant_id
     WHERE p.tenant_id = $1 AND p.deleted_at IS NULL AND p.status IN ('active', 'pending_booking')
     ORDER BY p.name ASC`,
    [tenantId]
  );

  return projectsRes.rows.map(row => {
    const tasksOk = row.open_tasks_count === 0;
    const snagsOk = row.open_snags_count === 0;
    const paymentsOk = row.unpaid_milestones_count === 0;
    const docsOk = row.total_docs_count > 0 && row.unapproved_docs_count === 0;
    const pmOk = !!row.pm_signed_off;

    return {
      projectId: row.project_id,
      projectName: row.project_name,
      projectStatus: row.project_status,
      pmName: row.pm_name || 'Unassigned',
      gates: {
        tasksCompleted: { passed: tasksOk, detail: `${row.open_tasks_count} pending` },
        snagsResolved: { passed: snagsOk, detail: `${row.open_snags_count} pending` },
        paymentsCleared: { passed: paymentsOk, detail: `${row.unpaid_milestones_count} pending` },
        documentsUploaded: { passed: docsOk, detail: `${row.total_docs_count} docs, ${row.unapproved_docs_count} unapproved` },
        pmSignedOff: { passed: pmOk, detail: pmOk ? 'Yes' : 'No' }
      },
      overallReady: tasksOk && snagsOk && paymentsOk && docsOk && pmOk,
      nextAppointmentDate: row.next_appointment_date
    };
  });
}

module.exports = {
  evaluateReadinessGates,
  pmSignOff,
  scheduleAppointment,
  getProjectAppointments,
  getReadinessDashboard
};
