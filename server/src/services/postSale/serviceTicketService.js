const pool = require('../../db/pool');
const { logAction } = require('../auditLog');

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
  priority = 'medium',
  warrantyEligibility = 'checking',
  assignedEngineerId = null,
  userId = null
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ticketNumber = await generateTicketNumber(client, tenantId);

    const ticketQuery = `
      INSERT INTO service_tickets (
        tenant_id, project_id, client_portal_user_id, ticket_number,
        title, description, category, priority, status,
        warranty_eligibility, assigned_engineer_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10)
      RETURNING *
    `;
    const ticketValues = [
      tenantId, projectId, clientPortalUserId, ticketNumber,
      title, description, category, priority, warrantyEligibility, assignedEngineerId
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

  const allowedKeys = [
    'title', 'description', 'category', 'priority', 'status',
    'warranty_eligibility', 'assigned_engineer_id', 'resolution_details',
    'resolved_at', 'client_feedback_rating', 'client_feedback_comments'
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
  if (updateData.status === 'resolved' && oldValue.status !== 'resolved' && !updateData.resolved_at) {
    updateFields.push(`resolved_at = $${idx}`);
    values.push(new Date().toISOString());
    idx++;
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
 * Gets a service ticket by ID (including visits).
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

  ticket.visits = visitsRes.rows;
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
    'SELECT id, status FROM service_tickets WHERE id = $1 AND tenant_id = $2',
    [ticketId, tenantId]
  );
  if (ticketRes.rows.length === 0) {
    throw new Error('TICKET_NOT_FOUND');
  }

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
    const currentTicketStatus = ticketRes.rows[0].status;
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
    'SELECT * FROM service_visits WHERE id = $1 AND ticket_id = $2 AND tenant_id = $3',
    [visitId, ticketId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('VISIT_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  const allowedKeys = ['scheduled_date', 'status', 'completed_date', 'engineer_id', 'visit_summary'];
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
  submitClientFeedback
};
