const pool = require('../db/pool');
const { calculateLeadScore } = require('./leadScoringService');

/**
 * Enforces working hours in Asia/Kolkata timezone.
 * Rules: Mon-Fri (09:00-20:00), Sat (10:00-18:00), Sun (Closed).
 * If the provided date is outside this window, returns the next valid start time.
 * If urgent, bypasses check.
 */
function enforceWorkingHours(inputDate, isUrgent = false) {
  if (isUrgent) return inputDate;

  // We operate on the provided date (assuming it's a JS Date object)
  // For simplicity without luxon/moment, we rely on UTC offsets for IST (+5:30)
  // 5 hours = 18000000 ms, 30 min = 1800000 ms. Total = 19800000 ms.
  const IST_OFFSET_MS = 19800000;
  
  // Convert input to IST
  const dateIST = new Date(inputDate.getTime() + IST_OFFSET_MS);
  
  let day = dateIST.getUTCDay(); // 0=Sun, 1=Mon...6=Sat
  let hour = dateIST.getUTCHours();
  
  let valid = false;
  let nextDateIST = new Date(dateIST);

  if (day >= 1 && day <= 5) {
    if (hour >= 9 && hour < 20) valid = true;
    else if (hour < 9) {
      nextDateIST.setUTCHours(9, 0, 0, 0);
    } else {
      // Move to next day 09:00
      nextDateIST.setUTCDate(nextDateIST.getUTCDate() + 1);
      nextDateIST.setUTCHours(9, 0, 0, 0);
      if (nextDateIST.getUTCDay() === 6) nextDateIST.setUTCHours(10, 0, 0, 0); // Sat rule
    }
  } else if (day === 6) {
    if (hour >= 10 && hour < 18) valid = true;
    else if (hour < 10) {
      nextDateIST.setUTCHours(10, 0, 0, 0);
    } else {
      // Move to Monday 09:00
      nextDateIST.setUTCDate(nextDateIST.getUTCDate() + 2);
      nextDateIST.setUTCHours(9, 0, 0, 0);
    }
  } else if (day === 0) {
    // Move to Monday 09:00
    nextDateIST.setUTCDate(nextDateIST.getUTCDate() + 1);
    nextDateIST.setUTCHours(9, 0, 0, 0);
  }

  if (valid) return inputDate;

  // Convert nextDateIST back to system time
  return new Date(nextDateIST.getTime() - IST_OFFSET_MS);
}

/**
 * Basic job scheduler for SQLite environments.
 * Logs to automation_logs as queued, and uses setTimeout to fire.
 * In a real robust system, a worker would poll this table.
 */
async function _scheduleJob(leadId, triggerEvent, actionTaken, delayMs, payload = {}, _channel = 'system') {
  const _sentAt = new Date(Date.now() + delayMs);
  
  // Insert queued log
  const res = await pool.query(`
    INSERT INTO automation_events (tenant_id, lead_id, workflow, action_type, status)
    VALUES ((SELECT tenant_id FROM leads WHERE id = $1), $1, $2, $3, 'pending')
    RETURNING id
  `, [leadId, triggerEvent, actionTaken]);
  
  const eventId = res.rows[0].id;

  // Schedule memory task
  setTimeout(async () => {
    const startTime = Date.now();
    try {
      console.log(`[Queue] Executing action for ${leadId}: ${actionTaken}`);
      
      // If action is creating a task, do it here
      if (payload.createTask) {
        await pool.query(`
          INSERT INTO lead_tasks (lead_id, title, due_date, assigned_to)
          VALUES ($1, $2, $3, $4)
        `, [leadId, payload.createTask.title, payload.createTask.dueDate, payload.createTask.assignedTo]);
      }
      
      // If action is alerting manager
      if (payload.managerAlert) {
         await pool.query(`
           INSERT INTO lead_timeline (tenant_id, lead_id, event_type, summary)
           VALUES ((SELECT tenant_id FROM leads WHERE id = $1), $1, 'automation.alert', $2)
         `, [leadId, `Manager Alert: ${payload.managerAlert}`]);
      }

      const duration = Date.now() - startTime;
      await pool.query(`UPDATE automation_events SET status = 'success', duration_ms = $1 WHERE id = $2`, [duration, eventId]);

    } catch (e) {
      console.error('Job failed', e);
      const duration = Date.now() - startTime;
      await pool.query(`UPDATE automation_events SET status = 'failed', duration_ms = $1, error_message = $2 WHERE id = $3`, [duration, e.message, eventId]);
    }
  }, delayMs);
}

/**
 * Assignment Algorithm
 */
async function assignRep(lead) {
  // Priority 1: Match Zone/Locality
  const zoneMatch = await pool.query(`
    SELECT id, active_leads_count FROM users 
    WHERE role = 'sales_rep' AND zone ILIKE $1
    ORDER BY active_leads_count ASC LIMIT 1
  `, [`%${lead.locality}%`]);

  if (zoneMatch.rows.length > 0 && zoneMatch.rows[0].active_leads_count < 40) {
    return zoneMatch.rows[0].id;
  }

  // Priority 2: Fewest leads
  const capacityMatch = await pool.query(`
    SELECT id FROM users 
    WHERE role = 'sales_rep' AND active_leads_count < 40
    ORDER BY active_leads_count ASC LIMIT 1
  `);

  if (capacityMatch.rows.length > 0) {
    return capacityMatch.rows[0].id;
  }

  // Fallback: null (requires manager)
  return null;
}

/**
 * Trigger Automation Engine
 */
async function triggerAutomation(event, lead, payload = {}) {
  try {
    // 1. Core synchronous business logic (e.g., Lead Scoring) that shouldn't be fully decoupled yet
    if (event === 'lead_created') {
      const scoreResult = calculateLeadScore(lead);
      await pool.query(`
        UPDATE leads SET score = $1, score_tier = $2 WHERE id = $3
      `, [scoreResult.score, scoreResult.tier, lead.id]);
      lead.score = scoreResult.score;
      lead.score_tier = scoreResult.tier;
    }

    if (event === 'first_contact_logged' && !lead.first_contacted_at) {
      await pool.query(`UPDATE leads SET first_contacted_at = CURRENT_TIMESTAMP WHERE id = $1`, [lead.id]);
    }

    // 2. Delegate everything else to the dynamic Rule Evaluator
    const ruleEvaluator = require('./automation/ruleEvaluator');
    await ruleEvaluator.processEvent(lead.tenant_id, event, lead, payload.changes || {});

  } catch (err) {
    console.error(`[Automation Engine] Error executing ${event} for lead ${lead.id}:`, err);
  }
}

module.exports = {
  triggerAutomation,
  enforceWorkingHours,
  assignRep
};
