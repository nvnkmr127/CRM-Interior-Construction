const pool = require('../../db/pool');
const { logAction } = require('../auditLog');
const { notifyUser } = require('../notificationService');

/**
 * Generates a unique service ticket number for a tenant (format: ST-YYYY-0001)
 */
async function generateTicketNumber(client, tenantId) {
  const year = new Date().getFullYear();
  const pattern = `ST-${year}-%`;
  const query = `
    SELECT ticket_number FROM service_tickets
    WHERE tenant_id = $1 AND ticket_number LIKE $2
    ORDER BY ticket_number DESC LIMIT 1
  `;
  const result = await client.query(query, [tenantId, pattern]);

  let nextSeq = 1;
  if (result.rows.length > 0) {
    const lastNum = result.rows[0].ticket_number;
    const parts = lastNum.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `ST-${year}-${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Creates a new service ticket.
 */
async function createTicket({
  tenantId,
  projectId,
  clientPortalUserId = null,
  title,
  description = null,
  category,
  affectedItem = null,
  priority = 'medium',
  warrantyEligibility = 'checking',
  assignedEngineerId = null,
  userId = null
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ticketNumber = await generateTicketNumber(client, tenantId);

    let isRepeatComplaint = false;
    if (affectedItem && category) {
      const repeatCheck = await client.query(`
        SELECT COUNT(*) as count FROM service_tickets 
        WHERE project_id = $1 AND category = $2 AND LOWER(affected_item) = LOWER($3)
      `, [projectId, category, affectedItem]);
      if (parseInt(repeatCheck.rows[0].count, 10) > 0) {
        isRepeatComplaint = true;
      }
    }

    const firstResponseSlaMap = {
      critical: 4,
      high: 24,
      medium: 72,
      low: 72
    };
    const resolutionSlaMap = {
      critical: 24,
      high: 72,
      medium: 168,
      low: 168
    };
    
    const p = priority.toLowerCase();
    const firstResponseSlaHours = firstResponseSlaMap[p] || 72;
    const resolutionSlaHours = resolutionSlaMap[p] || 168;

    const now = Date.now();
    const firstResponseDueDate = new Date(now + firstResponseSlaHours * 60 * 60 * 1000).toISOString();
    const resolutionDueDate = new Date(now + resolutionSlaHours * 60 * 60 * 1000).toISOString();

    const ticketQuery = `
      INSERT INTO service_tickets (
        tenant_id, project_id, client_portal_user_id, ticket_number,
        title, description, category, priority, status,
        warranty_eligibility, assigned_engineer_id, 
        first_response_sla_hours, resolution_sla_hours,
        first_response_due_date, resolution_due_date,
        affected_item, is_repeat_complaint
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    const ticketValues = [
      tenantId, projectId, clientPortalUserId, ticketNumber,
      title, description, category, priority, warrantyEligibility, assignedEngineerId,
      firstResponseSlaHours, resolutionSlaHours, firstResponseDueDate, resolutionDueDate,
      affectedItem, isRepeatComplaint
    ];

    const { rows } = await client.query(ticketQuery, ticketValues);
    const ticket = rows[0];

    // Log audit action
    await logAction({
      tenantId,
      userId: userId || clientPortalUserId,
      action: 'service_ticket.created',
      entity: 'service_ticket',
      entityId: ticket.id,
      newValue: ticket
    });

    await client.query('COMMIT');

    if (isRepeatComplaint) {
      try {
        await escalateTicket({
          tenantId,
          ticketId: ticket.id,
          escalatedToRole: 'qc',
          previousLevel: 0,
          newLevel: 1,
          reason: 'Auto-escalated: Repeat Complaint detected for this item/category.'
        });
      } catch (err) {
        console.error('Failed to auto-escalate repeat complaint:', err);
      }
    }

    return ticket;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Updates an existing service ticket.
 */
async function updateTicket(ticketId, tenantId, updateData, userId = null) {
  const existingRes = await pool.query(
    'SELECT * FROM service_tickets WHERE id = $1 AND tenant_id = $2',
    [ticketId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('TICKET_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  const firstResponseSlaMap = {
    critical: 4,
    high: 24,
    medium: 72,
    low: 72
  };
  const resolutionSlaMap = {
    critical: 24,
    high: 72,
    medium: 168,
    low: 168
  };

  const newPriority = updateData.priority || oldValue.priority;
  if (updateData.priority && updateData.priority !== oldValue.priority) {
    const p = newPriority.toLowerCase();
    const firstResponseSlaHours = firstResponseSlaMap[p] || 72;
    const resolutionSlaHours = resolutionSlaMap[p] || 168;

    updateData.first_response_sla_hours = firstResponseSlaHours;
    updateData.resolution_sla_hours = resolutionSlaHours;
    
    const createdAt = new Date(oldValue.created_at);
    updateData.first_response_due_date = new Date(createdAt.getTime() + firstResponseSlaHours * 60 * 60 * 1000).toISOString();
    updateData.resolution_due_date = new Date(createdAt.getTime() + resolutionSlaHours * 60 * 60 * 1000).toISOString();
  }

  if (updateData.status && updateData.status !== 'open' && oldValue.status === 'open' && !oldValue.first_responded_at) {
    updateData.first_responded_at = new Date().toISOString();
  }

  // Estimate logic
  if (updateData.warranty_eligibility === 'chargeable') {
    if (updateData.chargeable_estimate !== undefined && !updateData.chargeable_estimate_status) {
      updateData.chargeable_estimate_status = 'pending_approval';
    }
  }

  if (updateData.chargeable_estimate_status === 'approved' && oldValue.chargeable_estimate_status !== 'approved') {
    updateData.chargeable_estimate_approved_at = new Date().toISOString();
  }

  const allowedKeys = [
    'title', 'description', 'category', 'priority', 'status',
    'warranty_eligibility', 'assigned_engineer_id', 'resolution_details',
    'resolved_at', 'client_feedback_rating', 'client_feedback_comments',
    'sla_hours', 'due_date', 'first_response_sla_hours', 'resolution_sla_hours',
    'first_response_due_date', 'resolution_due_date', 'first_responded_at',
    'chargeable_estimate', 'chargeable_estimate_status', 'chargeable_estimate_approved_at'
  ];

  const updateFields = [];
  const values = [];
  let idx = 1;

  for (const key of allowedKeys) {
    if (updateData[key] !== undefined) {
      updateFields.push(`${key} = $${idx}`);
      values.push(updateData[key]);
      idx++;
    }
  }

  // Auto-set resolved_at if status becomes resolved
  if (updateData.status === 'resolved' && oldValue.status !== 'resolved') {
    const resolvedAt = updateData.resolved_at || new Date().toISOString();
    if (updateData.resolved_at === undefined) {
      updateFields.push(`resolved_at = $${idx}`);
      values.push(resolvedAt);
      idx++;
    }

    const resDueDateVal = updateData.resolution_due_date || oldValue.resolution_due_date || updateData.due_date || oldValue.due_date;
    if (resDueDateVal && new Date(resolvedAt) > new Date(resDueDateVal)) {
      await logAction({
        tenantId,
        userId,
        action: 'service_ticket.sla_breached',
        entity: 'service_ticket',
        entityId: ticketId,
        newValue: {
          resolvedAt,
          dueDate: resDueDateVal,
          hoursTaken: (new Date(resolvedAt) - new Date(oldValue.created_at)) / (3600 * 1000),
          slaHours: updateData.resolution_sla_hours || oldValue.resolution_sla_hours || oldValue.sla_hours || 168
        }
      });
    }
  }

  // Check first response breach
  if (updateData.first_responded_at) {
    const frDueDate = updateData.first_response_due_date || oldValue.first_response_due_date;
    if (frDueDate && new Date(updateData.first_responded_at) > new Date(frDueDate)) {
      await logAction({
        tenantId,
        userId,
        action: 'service_ticket.first_response_sla_breached',
        entity: 'service_ticket',
        entityId: ticketId,
        newValue: {
          respondedAt: updateData.first_responded_at,
          dueDate: frDueDate
        }
      });
    }
  }

  if (updateFields.length === 0) {
    return oldValue;
  }

  values.push(ticketId);
  values.push(tenantId);
  const query = `
    UPDATE service_tickets
    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idx} AND tenant_id = $${idx + 1}
    RETURNING *
  `;

  const { rows } = await pool.query(query, values);
  const newValue = rows[0];

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'service_ticket.updated',
    entity: 'service_ticket',
    entityId: ticketId,
    oldValue,
    newValue
  });

  return newValue;
}

/**
 * Deletes a service ticket.
 */
async function deleteTicket(ticketId, tenantId, userId = null) {
  const existingRes = await pool.query(
    'SELECT * FROM service_tickets WHERE id = $1 AND tenant_id = $2',
    [ticketId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('TICKET_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  await pool.query(
    'DELETE FROM service_tickets WHERE id = $1 AND tenant_id = $2',
    [ticketId, tenantId]
  );

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'service_ticket.deleted',
    entity: 'service_ticket',
    entityId: ticketId,
    oldValue
  });

  return oldValue;
}

/**
 * Gets a service ticket by ID (including visits and escalation history).
 */
async function getTicketById(ticketId, tenantId) {
  const ticketRes = await pool.query(
    `SELECT t.*, u.name as assigned_engineer_name, p.name as project_name
     FROM service_tickets t
     LEFT JOIN users u ON t.assigned_engineer_id = u.id
     JOIN projects p ON t.project_id = p.id
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [ticketId, tenantId]
  );

  const ticket = ticketRes.rows[0];
  if (!ticket) {
    return null;
  }

  const visitsRes = await pool.query(
    `SELECT v.*, u.name as engineer_name
     FROM service_visits v
     LEFT JOIN users u ON v.engineer_id = u.id
     WHERE v.ticket_id = $1 AND v.tenant_id = $2
     ORDER BY v.scheduled_date ASC`,
    [ticketId, tenantId]
  );

  const escalationsRes = await pool.query(
    `SELECT * FROM service_ticket_escalations 
     WHERE ticket_id = $1 AND tenant_id = $2
     ORDER BY escalated_at ASC`,
    [ticketId, tenantId]
  );

  const partsRes = await pool.query(
    `SELECT * FROM service_ticket_parts
     WHERE ticket_id = $1 AND tenant_id = $2
     ORDER BY created_at ASC`,
    [ticketId, tenantId]
  );

  ticket.visits = visitsRes.rows;
  ticket.escalations = escalationsRes.rows;
  ticket.parts_used = partsRes.rows;
  return ticket;
}

/**
 * Gets all service tickets for a project.
 */
async function getTicketsByProject(projectId, tenantId) {
  const query = `
    SELECT t.*, u.name as assigned_engineer_name
    FROM service_tickets t
    LEFT JOIN users u ON t.assigned_engineer_id = u.id
    WHERE t.project_id = $1 AND t.tenant_id = $2
    ORDER BY t.created_at DESC
  `;
  const { rows } = await pool.query(query, [projectId, tenantId]);
  return rows;
}

/**
 * Schedules a new service visit.
 */
async function scheduleVisit({
  tenantId,
  ticketId,
  scheduledDate,
  engineerId = null,
  visitSummary = null,
  userId = null
}) {
  // Verify ticket exists
  const ticketRes = await pool.query(
    'SELECT id, status, ticket_number, project_id FROM service_tickets WHERE id = $1 AND tenant_id = $2',
    [ticketId, tenantId]
  );
  if (ticketRes.rows.length === 0) {
    throw new Error('TICKET_NOT_FOUND');
  }
  const ticketInfo = ticketRes.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const visitQuery = `
      INSERT INTO service_visits (
        tenant_id, ticket_id, scheduled_date, status, engineer_id, visit_summary
      )
      VALUES ($1, $2, $3, 'scheduled', $4, $5)
      RETURNING *
    `;
    const visitValues = [tenantId, ticketId, scheduledDate, engineerId, visitSummary];
    const visitRes = await client.query(visitQuery, visitValues);
    const visit = visitRes.rows[0];

    // If ticket was 'open', auto-update it to 'scheduled' or 'assigned' if an engineer is assigned
    const currentTicketStatus = ticketInfo.status;
    let nextStatus = currentTicketStatus;
    if (currentTicketStatus === 'open') {
      nextStatus = 'scheduled';
    }

    const ticketUpdateData = { status: nextStatus };
    if (engineerId) {
      ticketUpdateData.assigned_engineer_id = engineerId;
      if (currentTicketStatus === 'open' || currentTicketStatus === 'scheduled') {
        ticketUpdateData.status = 'assigned';
      }
    }

    await client.query(
      `UPDATE service_tickets
       SET status = $1, assigned_engineer_id = COALESCE($2, assigned_engineer_id), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND tenant_id = $4`,
      [ticketUpdateData.status, engineerId, ticketId, tenantId]
    );

    // Notify assigned engineer
    if (engineerId) {
      notifyUser({
        tenantId,
        userId: engineerId,
        type: 'visit_assigned',
        message: `You have been assigned to service visit for ticket ${ticketInfo.ticket_number}.`,
        referenceUrl: `/projects/${ticketInfo.project_id}/service-tickets/${ticketId}`
      });
    }

    // Log audit action
    await logAction({
      tenantId,
      userId,
      action: 'service_visit.scheduled',
      entity: 'service_visit',
      entityId: visit.id,
      newValue: visit
    });

    await client.query('COMMIT');
    return visit;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Updates a service visit.
 */
async function updateVisit(visitId, ticketId, tenantId, updateData, userId = null) {
  const existingRes = await pool.query(
    'SELECT v.*, t.project_id FROM service_visits v JOIN service_tickets t ON v.ticket_id = t.id WHERE v.id = $1 AND v.ticket_id = $2 AND v.tenant_id = $3',
    [visitId, ticketId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('VISIT_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  const allowedKeys = [
    'scheduled_date', 'status', 'completed_date', 'engineer_id', 'visit_summary',
    'client_confirmed', 'client_confirmed_at', 'reminder_sent', 'visit_outcome'
  ];
  const updateFields = [];
  const values = [];
  let idx = 1;

  for (const key of allowedKeys) {
    if (updateData[key] !== undefined) {
      updateFields.push(`${key} = $${idx}`);
      values.push(updateData[key]);
      idx++;
    }
  }

  // Auto-set completed_date if status becomes completed
  if (updateData.status === 'completed' && oldValue.status !== 'completed' && !updateData.completed_date) {
    updateFields.push(`completed_date = $${idx}`);
    values.push(new Date().toISOString());
    idx++;
  }

  if (updateFields.length === 0) {
    return oldValue;
  }

  // Notify new engineer if assigned/changed
  if (updateData.engineer_id && updateData.engineer_id !== oldValue.engineer_id) {
    notifyUser({
      tenantId,
      userId: updateData.engineer_id,
      type: 'visit_assigned',
      message: `You have been assigned to service visit for ticket.`,
      referenceUrl: `/projects/${oldValue.project_id}/service-tickets/${ticketId}`
    });
  }

  values.push(visitId);
  values.push(ticketId);
  values.push(tenantId);
  const query = `
    UPDATE service_visits
    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idx} AND ticket_id = $${idx + 1} AND tenant_id = $${idx + 2}
    RETURNING *
  `;

  const { rows } = await pool.query(query, values);
  const newValue = rows[0];

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'service_visit.updated',
    entity: 'service_visit',
    entityId: visitId,
    oldValue,
    newValue
  });

  return newValue;
}

/**
 * Confirms a service visit from client portal.
 */
async function confirmVisit(visitId, ticketId, tenantId, clientPortalUserId) {
  const visitRes = await pool.query(
    'SELECT * FROM service_visits WHERE id = $1 AND ticket_id = $2 AND tenant_id = $3',
    [visitId, ticketId, tenantId]
  );
  if (visitRes.rows.length === 0) {
    throw new Error('VISIT_NOT_FOUND');
  }

  const query = `
    UPDATE service_visits
    SET client_confirmed = true,
        client_confirmed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND ticket_id = $2 AND tenant_id = $3
    RETURNING *
  `;
  const { rows } = await pool.query(query, [visitId, ticketId, tenantId]);
  const visit = rows[0];

  // Log audit action
  await logAction({
    tenantId,
    userId: clientPortalUserId,
    action: 'service_visit.client_confirmed',
    entity: 'service_visit',
    entityId: visitId,
    newValue: visit
  });

  return visit;
}

/**
 * Sends pre-visit reminders for visits scheduled in the next 24 hours.
 */
async function sendPreVisitReminders() {
  const query = `
    SELECT v.*, t.ticket_number, t.project_id
    FROM service_visits v
    JOIN service_tickets t ON v.ticket_id = t.id
    WHERE v.status = 'scheduled'
    AND v.reminder_sent = false
    AND v.scheduled_date BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
  `;
  const { rows } = await pool.query(query);

  for (const visit of rows) {
    console.log(`[Reminder] Sending pre-visit reminder for visit ${visit.id} (Ticket ${visit.ticket_number})`);
    
    if (visit.engineer_id) {
      notifyUser({
        tenantId: visit.tenant_id,
        userId: visit.engineer_id,
        type: 'visit_reminder',
        message: `Reminder: You have a scheduled service visit for ticket ${visit.ticket_number} in the next 24 hours.`,
        referenceUrl: `/projects/${visit.project_id}/service-tickets/${visit.ticket_id}`
      });
    }

    console.log(`[Reminder] Mock SMS sent to project client for service visit ${visit.id}`);

    await pool.query(
      `UPDATE service_visits SET reminder_sent = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [visit.id]
    );
  }
  return rows.length;
}

/**
 * Deletes a service visit.
 */
async function deleteVisit(visitId, ticketId, tenantId, userId = null) {
  const existingRes = await pool.query(
    'SELECT * FROM service_visits WHERE id = $1 AND ticket_id = $2 AND tenant_id = $3',
    [visitId, ticketId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('VISIT_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  await pool.query(
    'DELETE FROM service_visits WHERE id = $1 AND ticket_id = $2 AND tenant_id = $3',
    [visitId, ticketId, tenantId]
  );

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'service_visit.deleted',
    entity: 'service_visit',
    entityId: visitId,
    oldValue
  });

  return oldValue;
}

/**
 * Gets all visits for a specific service ticket.
 */
async function getVisitsByTicket(ticketId, tenantId) {
  const query = `
    SELECT v.*, u.name as engineer_name
    FROM service_visits v
    LEFT JOIN users u ON v.engineer_id = u.id
    WHERE v.ticket_id = $1 AND v.tenant_id = $2
    ORDER BY v.scheduled_date ASC
  `;
  const { rows } = await pool.query(query, [ticketId, tenantId]);
  return rows;
}

/**
 * Submits client feedback for a resolved/closed service ticket.
 */
async function submitClientFeedback(ticketId, tenantId, { rating, comments }, clientPortalUserId) {
  // Check ticket status first (must be resolved or closed to give feedback, or at least exist)
  const ticketRes = await pool.query(
    'SELECT * FROM service_tickets WHERE id = $1 AND tenant_id = $2 AND client_portal_user_id = $3',
    [ticketId, tenantId, clientPortalUserId]
  );
  if (ticketRes.rows.length === 0) {
    throw new Error('TICKET_NOT_FOUND');
  }

  const ticket = ticketRes.rows[0];
  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
    throw new Error('INVALID_TICKET_STATUS_FOR_FEEDBACK');
  }

  const query = `
    UPDATE service_tickets
    SET client_feedback_rating = $1,
        client_feedback_comments = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND tenant_id = $4 AND client_portal_user_id = $5
    RETURNING *
  `;
  const { rows } = await pool.query(query, [rating, comments, ticketId, tenantId, clientPortalUserId]);
  const updatedTicket = rows[0];

  // Log audit action
  await logAction({
    tenantId,
    userId: clientPortalUserId,
    action: 'service_ticket.feedback_submitted',
    entity: 'service_ticket',
    entityId: ticketId,
    newValue: { rating, comments }
  });

  return updatedTicket;
}

/**
 * Submits CSAT feedback for a project handover or service visit.
 */
async function submitCsat({
  tenantId,
  projectId,
  referenceType,
  referenceId,
  score,
  comments = null,
  clientPortalUserId
}) {
  // Fetch PM and designer from project
  const projectRes = await pool.query(
    'SELECT pm_id, designer_id FROM projects WHERE id = $1 AND tenant_id = $2',
    [projectId, tenantId]
  );
  if (projectRes.rows.length === 0) {
    throw new Error('PROJECT_NOT_FOUND');
  }
  const { pm_id, designer_id } = projectRes.rows[0];

  const query = `
    INSERT INTO csat_feedback (
      tenant_id, project_id, reference_type, reference_id, score, comments, pm_id, designer_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const values = [tenantId, projectId, referenceType, referenceId, score, comments, pm_id, designer_id];
  const { rows } = await pool.query(query, values);
  const csat = rows[0];

  // Log audit action
  await logAction({
    tenantId,
    userId: clientPortalUserId,
    action: 'csat.submitted',
    entity: referenceType === 'handover' ? 'handover_checklist' : 'service_visit',
    entityId: referenceId,
    newValue: csat
  });

  return csat;
}

/**
 * Escalates a service ticket to a specific role.
 */
async function escalateTicket({
  tenantId,
  ticketId,
  escalatedToRole,
  previousLevel,
  newLevel,
  reason
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update ticket level
    await client.query(
      `UPDATE service_tickets 
       SET escalation_level = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3`,
      [newLevel, ticketId, tenantId]
    );

    // Insert escalation record
    const escQuery = `
      INSERT INTO service_ticket_escalations (
        tenant_id, ticket_id, escalated_to_role, previous_level, new_level, reason
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const escValues = [tenantId, ticketId, escalatedToRole, previousLevel, newLevel, reason];
    const escRes = await client.query(escQuery, escValues);
    const escalation = escRes.rows[0];

    // Log audit action
    await logAction({
      tenantId,
      action: 'service_ticket.escalated',
      entity: 'service_ticket',
      entityId: ticketId,
      newValue: escalation
    });

    // Notify PM or Director
    const ticketRes = await client.query(
      `SELECT t.ticket_number, t.project_id, p.pm_id
       FROM service_tickets t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1`,
      [ticketId]
    );
    const ticketInfo = ticketRes.rows[0];

    let notifyUserId = null;
    if (escalatedToRole === 'pm' && ticketInfo?.pm_id) {
      notifyUserId = ticketInfo.pm_id;
    } else {
      const adminRes = await client.query(
        `SELECT id FROM users WHERE tenant_id = $1 AND role_id IN (
           SELECT id FROM roles WHERE name = 'superadmin' OR name = 'admin'
         ) LIMIT 1`,
        [tenantId]
      );
      notifyUserId = adminRes.rows[0]?.id;
    }

    if (notifyUserId) {
      notifyUser({
        tenantId,
        userId: notifyUserId,
        type: 'ticket_escalation',
        message: `Service ticket ${ticketInfo?.ticket_number || ''} has been escalated to ${escalatedToRole.toUpperCase()} (Level ${newLevel}): ${reason}.`,
        referenceUrl: `/projects/${ticketInfo?.project_id || ''}/service-tickets/${ticketId}`
      });
    }

    await client.query('COMMIT');
    return escalation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Scans unresolved tickets for automatic SLA breaches and executes escalations.
 */
async function checkAutomaticEscalations() {
  const query = `
    SELECT t.*, p.pm_id,
           EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.created_at)) / 3600 as hours_elapsed
    FROM service_tickets t
    JOIN projects p ON t.project_id = p.id
    WHERE t.status NOT IN ('resolved', 'closed')
  `;
  const { rows } = await pool.query(query);

  let escalationCount = 0;
  for (const ticket of rows) {
    const hoursElapsed = parseFloat(ticket.hours_elapsed);
    const resSlaHours = ticket.resolution_sla_hours || ticket.sla_hours || 168;
    const frSlaHours = ticket.first_response_sla_hours || 72;

    let escalated = false;

    // Check Resolution SLA
    if (hoursElapsed > resSlaHours * 3 && ticket.escalation_level < 2) {
      await escalateTicket({
        tenantId: ticket.tenant_id,
        ticketId: ticket.id,
        escalatedToRole: 'director',
        previousLevel: ticket.escalation_level,
        newLevel: 2,
        reason: `Ticket unresolved past 3x Resolution SLA (${resSlaHours * 3} hours)`
      });
      escalationCount++;
      escalated = true;
    }
    else if (hoursElapsed > resSlaHours * 2 && ticket.escalation_level < 1) {
      await escalateTicket({
        tenantId: ticket.tenant_id,
        ticketId: ticket.id,
        escalatedToRole: 'pm',
        previousLevel: ticket.escalation_level,
        newLevel: 1,
        reason: `Ticket unresolved past 2x Resolution SLA (${resSlaHours * 2} hours)`
      });
      escalationCount++;
      escalated = true;
    }

    // Check First Response SLA (if not responded yet and not already escalated for resolution)
    if (!escalated && !ticket.first_responded_at && ticket.status === 'open') {
      if (hoursElapsed > frSlaHours * 3 && ticket.escalation_level < 2) {
        await escalateTicket({
          tenantId: ticket.tenant_id,
          ticketId: ticket.id,
          escalatedToRole: 'director',
          previousLevel: ticket.escalation_level,
          newLevel: 2,
          reason: `Ticket not responded past 3x First Response SLA (${frSlaHours * 3} hours)`
        });
        escalationCount++;
      }
      else if (hoursElapsed > frSlaHours * 2 && ticket.escalation_level < 1) {
        await escalateTicket({
          tenantId: ticket.tenant_id,
          ticketId: ticket.id,
          escalatedToRole: 'pm',
          previousLevel: ticket.escalation_level,
          newLevel: 1,
          reason: `Ticket not responded past 2x First Response SLA (${frSlaHours * 2} hours)`
        });
        escalationCount++;
      }
    }
  }

  return escalationCount;
}

/**
 * Gets CSAT metrics for a tenant.
 */
async function getCsatMetrics(tenantId) {
  const projectQuery = `
    SELECT c.project_id, p.name as project_name, AVG(c.score)::NUMERIC(3,2) as avg_score, COUNT(*)::INT as count
    FROM csat_feedback c
    JOIN projects p ON c.project_id = p.id
    WHERE c.tenant_id = $1
    GROUP BY c.project_id, p.name
    ORDER BY avg_score DESC
  `;
  const projectRes = await pool.query(projectQuery, [tenantId]);

  const pmQuery = `
    SELECT c.pm_id, u.name as pm_name, AVG(c.score)::NUMERIC(3,2) as avg_score, COUNT(*)::INT as count
    FROM csat_feedback c
    JOIN users u ON c.pm_id = u.id
    WHERE c.tenant_id = $1
    GROUP BY c.pm_id, u.name
    ORDER BY avg_score DESC
  `;
  const pmRes = await pool.query(pmQuery, [tenantId]);

  const designerQuery = `
    SELECT c.designer_id, u.name as designer_name, AVG(c.score)::NUMERIC(3,2) as avg_score, COUNT(*)::INT as count
    FROM csat_feedback c
    JOIN users u ON c.designer_id = u.id
    WHERE c.tenant_id = $1
    GROUP BY c.designer_id, u.name
    ORDER BY avg_score DESC
  `;
  const designerRes = await pool.query(designerQuery, [tenantId]);

  const overallQuery = `
    SELECT reference_type, AVG(score)::NUMERIC(3,2) as avg_score, COUNT(*)::INT as count
    FROM csat_feedback
    WHERE tenant_id = $1
    GROUP BY reference_type
  `;
  const overallRes = await pool.query(overallQuery, [tenantId]);

  return {
    byProject: projectRes.rows,
    byPM: pmRes.rows,
    byDesigner: designerRes.rows,
    overall: overallRes.rows
  };
}

/**
 * Adds a part used to a service ticket.
 */
async function addPartUsed({ tenantId, ticketId, visitId = null, partName, quantity, cost = null, userId = null }) {
  // Verify ticket exists
  const ticketRes = await pool.query(
    'SELECT id FROM service_tickets WHERE id = $1 AND tenant_id = $2',
    [ticketId, tenantId]
  );
  if (ticketRes.rows.length === 0) {
    throw new Error('TICKET_NOT_FOUND');
  }

  const query = `
    INSERT INTO service_ticket_parts (tenant_id, ticket_id, visit_id, part_name, quantity, cost)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const { rows } = await pool.query(query, [tenantId, ticketId, visitId, partName, quantity, cost]);
  const part = rows[0];

  await logAction({
    tenantId,
    userId,
    action: 'service_ticket.part_added',
    entity: 'service_ticket',
    entityId: ticketId,
    newValue: part
  });

  return part;
}

/**
 * Removes a part used from a service ticket.
 */
async function removePartUsed(partId, ticketId, tenantId, userId = null) {
  const existingRes = await pool.query(
    'SELECT * FROM service_ticket_parts WHERE id = $1 AND ticket_id = $2 AND tenant_id = $3',
    [partId, ticketId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('PART_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  await pool.query(
    'DELETE FROM service_ticket_parts WHERE id = $1 AND ticket_id = $2 AND tenant_id = $3',
    [partId, ticketId, tenantId]
  );

  await logAction({
    tenantId,
    userId,
    action: 'service_ticket.part_removed',
    entity: 'service_ticket',
    entityId: ticketId,
    oldValue
  });

  return oldValue;
}

module.exports = {
  createTicket,
  updateTicket,
  deleteTicket,
  getTicketById,
  getTicketsByProject,
  scheduleVisit,
  updateVisit,
  deleteVisit,
  getVisitsByTicket,
  submitClientFeedback,
  confirmVisit,
  sendPreVisitReminders,
  submitCsat,
  escalateTicket,
  checkAutomaticEscalations,
  getCsatMetrics,
  addPartUsed,
  removePartUsed
};
