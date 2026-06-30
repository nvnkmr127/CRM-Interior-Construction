const pool = require('../../db/pool');
const { logAction } = require('../auditLog');
const { notifyUser } = require('../notificationService');

/**
 * Creates an AMC contract, optionally pre-generating quarterly visit schedules.
 */
async function createAmc({
  tenantId,
  projectId,
  contractNumber,
  contractValue = 0,
  startDate,
  endDate,
  coveredScope = null,
  autoRenewalAlertDays = 90,
  generateVisits = false,
  visitFrequency = 'quarterly',
  coveredProducts = [],
  exclusions = null,
  renewalDate = null,
  paymentSchedule = null,
  userId = null
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const amcQuery = `
      INSERT INTO amcs (
        tenant_id, project_id, contract_number, contract_value, 
        start_date, end_date, covered_scope, auto_renewal_alert_days,
        visit_frequency, covered_products, exclusions, renewal_date, payment_schedule
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    const amcValues = [
      tenantId, projectId, contractNumber, contractValue,
      startDate, endDate, coveredScope, autoRenewalAlertDays,
      visitFrequency, JSON.stringify(coveredProducts || []), exclusions, renewalDate || endDate, paymentSchedule
    ];

    const amcRes = await client.query(amcQuery, amcValues);
    const amc = amcRes.rows[0];

    const visits = [];
    if (generateVisits) {
      // Parse dates to calculate schedules
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Calculate total months of AMC
      const totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      let intervalMonths = 3;
      if (visitFrequency === 'monthly') intervalMonths = 1;
      else if (visitFrequency === 'bi-annual') intervalMonths = 6;
      else if (visitFrequency === 'annual') intervalMonths = 12;

      const numVisits = Math.max(1, Math.floor(totalMonths / intervalMonths));
      
      for (let i = 1; i <= numVisits; i++) {
        const visitDate = new Date(start);
        visitDate.setMonth(start.getMonth() + (i * intervalMonths));
        
        // If scheduled date exceeds the contract end date, adjust or cap it
        if (visitDate > end) {
          visitDate.setTime(end.getTime());
        }

        const formattedDate = visitDate.toISOString().split('T')[0];

        const visitQuery = `
          INSERT INTO amc_visits (tenant_id, amc_id, scheduled_date, status)
          VALUES ($1, $2, $3, 'scheduled')
          RETURNING *
        `;
        const visitRes = await client.query(visitQuery, [tenantId, amc.id, formattedDate]);
        visits.push(visitRes.rows[0]);
      }
    }

    await client.query('COMMIT');

    // Log audit action
    await logAction({
      tenantId,
      userId,
      action: 'amc.created',
      entity: 'amc',
      entityId: amc.id,
      newValue: { ...amc, visits }
    });

    return { ...amc, visits };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Updates an AMC contract.
 */
async function updateAmc(amcId, tenantId, updateData, userId = null) {
  const existingRes = await pool.query(
    'SELECT * FROM amcs WHERE id = $1 AND tenant_id = $2',
    [amcId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('AMC_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  const allowedKeys = [
    'contract_number', 'contract_value', 'start_date', 'end_date',
    'covered_scope', 'status', 'auto_renewal_alert_days', 'renewal_alert_sent',
    'visit_frequency', 'covered_products', 'exclusions', 'renewal_date', 'payment_schedule'
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

  if (updateFields.length === 0) {
    return oldValue;
  }

  values.push(amcId);
  values.push(tenantId);
  const query = `
    UPDATE amcs
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
    action: 'amc.updated',
    entity: 'amc',
    entityId: amcId,
    oldValue,
    newValue
  });

  return newValue;
}

/**
 * Deletes an AMC contract (automatically cascades visits).
 */
async function deleteAmc(amcId, tenantId, userId = null) {
  const existingRes = await pool.query(
    'SELECT * FROM amcs WHERE id = $1 AND tenant_id = $2',
    [amcId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('AMC_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  await pool.query(
    'DELETE FROM amcs WHERE id = $1 AND tenant_id = $2',
    [amcId, tenantId]
  );

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'amc.deleted',
    entity: 'amc',
    entityId: amcId,
    oldValue
  });

  return oldValue;
}

/**
 * Lists AMCs for a specific project.
 */
async function getAmcsByProject(projectId, tenantId) {
  const query = `
    SELECT 
      a.*,
      COALESCE(
        (SELECT json_agg(v ORDER BY v.scheduled_date ASC) 
         FROM amc_visits v WHERE v.amc_id = a.id), 
        '[]'::json
      ) AS visits
    FROM amcs a
    WHERE a.project_id = $1 AND a.tenant_id = $2
    ORDER BY a.end_date DESC
  `;
  const { rows } = await pool.query(query, [projectId, tenantId]);
  return rows;
}

/**
 * Schedules a new maintenance visit for an AMC.
 */
async function scheduleAmcVisit({
  tenantId,
  amcId,
  scheduledDate,
  technicianId = null,
  remarks = null,
  userId = null
}) {
  const amcRes = await pool.query('SELECT id FROM amcs WHERE id = $1 AND tenant_id = $2', [amcId, tenantId]);
  if (amcRes.rows.length === 0) {
    throw new Error('AMC_NOT_FOUND');
  }

  const query = `
    INSERT INTO amc_visits (tenant_id, amc_id, scheduled_date, technician_id, remarks)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const { rows } = await pool.query(query, [tenantId, amcId, scheduledDate, technicianId, remarks]);
  const visit = rows[0];

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'amc_visit.scheduled',
    entity: 'amc_visit',
    entityId: visit.id,
    newValue: visit
  });

  return visit;
}

/**
 * Updates a maintenance visit (e.g. completes it, assigns technician).
 */
async function updateAmcVisit(visitId, amcId, tenantId, updateData, userId = null) {
  const existingRes = await pool.query(
    'SELECT * FROM amc_visits WHERE id = $1 AND amc_id = $2 AND tenant_id = $3',
    [visitId, amcId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('AMC_VISIT_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  const allowedKeys = ['scheduled_date', 'status', 'completed_date', 'technician_id', 'remarks'];
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

  if (updateFields.length === 0) {
    return oldValue;
  }

  values.push(visitId);
  values.push(amcId);
  values.push(tenantId);
  const query = `
    UPDATE amc_visits
    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idx} AND amc_id = $${idx + 1} AND tenant_id = $${idx + 2}
    RETURNING *
  `;

  const { rows } = await pool.query(query, values);
  const newValue = rows[0];

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'amc_visit.updated',
    entity: 'amc_visit',
    entityId: visitId,
    oldValue,
    newValue
  });

  return newValue;
}

/**
 * Deletes a maintenance visit schedule.
 */
async function deleteAmcVisit(visitId, amcId, tenantId, userId = null) {
  const existingRes = await pool.query(
    'SELECT * FROM amc_visits WHERE id = $1 AND amc_id = $2 AND tenant_id = $3',
    [visitId, amcId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('AMC_VISIT_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  await pool.query(
    'DELETE FROM amc_visits WHERE id = $1 AND amc_id = $2 AND tenant_id = $3',
    [visitId, amcId, tenantId]
  );

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'amc_visit.deleted',
    entity: 'amc_visit',
    entityId: visitId,
    oldValue
  });

  return oldValue;
}

/**
 * Periodic checks for AMC renewals and automated status updates.
 */
async function checkAndNotifyExpiredOrExpiringAMCs() {
  console.log('[AMCScheduler] Running AMC renewal checks...');
  
  // 1. Mark expired contracts
  const expireRes = await pool.query(`
    UPDATE amcs
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'active' AND end_date < CURRENT_DATE
    RETURNING id, contract_number, tenant_id
  `);
  if (expireRes.rows.length > 0) {
    console.log(`[AMCScheduler] Auto-expired ${expireRes.rows.length} AMC contract(s).`);
  }

  // 2. Fetch expiring contracts to alert
  const query = `
    SELECT a.*, p.pm_id, p.created_by, p.name as project_name
    FROM amcs a
    JOIN projects p ON a.project_id = p.id
    WHERE a.status = 'active'
      AND a.renewal_alert_sent = FALSE
      AND (a.end_date - CURRENT_DATE) <= a.auto_renewal_alert_days
  `;
  const { rows: expiringAmcs } = await pool.query(query);

  for (const amc of expiringAmcs) {
    // Determine who to notify
    let recipientUserId = amc.pm_id || amc.created_by;
    if (!recipientUserId) {
      // Fallback: Notify first active superadmin in this tenant
      const adminRes = await pool.query(
        `SELECT u.id FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.tenant_id = $1 AND r.name = 'superadmin' AND u.status = 'active' 
         LIMIT 1`,
        [amc.tenant_id]
      );
      recipientUserId = adminRes.rows[0]?.id;
    }

    if (recipientUserId) {
      const remainingDays = Math.max(0, Math.ceil((new Date(amc.end_date) - new Date()) / (1000 * 60 * 60 * 24)));
      const message = `AMC Contract #${amc.contract_number} for project "${amc.project_name}" is expiring in ${remainingDays} days (on ${new Date(amc.end_date).toLocaleDateString('en-IN')}). Please prepare the renewal quote.`;
      
      notifyUser({
        tenantId: amc.tenant_id,
        userId: recipientUserId,
        type: 'amc_renewal_alert',
        message,
        referenceUrl: `/projects/${amc.project_id}?tab=AMCs`
      });

      // Mark alert as sent
      await pool.query(
        'UPDATE amcs SET renewal_alert_sent = TRUE WHERE id = $1',
        [amc.id]
      );

      console.log(`[AMCScheduler] renewal alert sent for AMC #${amc.contract_number} to user ${recipientUserId}`);
    }
  }
}

module.exports = {
  createAmc,
  updateAmc,
  deleteAmc,
  getAmcsByProject,
  scheduleAmcVisit,
  updateAmcVisit,
  deleteAmcVisit,
  checkAndNotifyExpiredOrExpiringAMCs
};
