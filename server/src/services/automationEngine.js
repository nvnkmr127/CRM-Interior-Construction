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
async function scheduleJob(leadId, triggerEvent, actionTaken, delayMs, payload = {}, channel = 'system') {
  const sentAt = new Date(Date.now() + delayMs);
  
  // Insert queued log
  const res = await pool.query(`
    INSERT INTO automation_logs (lead_id, trigger_event, action_taken, channel, status, sent_at)
    VALUES ($1, $2, $3, $4, 'queued', $5)
    RETURNING id
  `, [leadId, triggerEvent, actionTaken, channel, sentAt.toISOString()]);
  
  const logId = res.rows[0].id;

  // Schedule memory task
  setTimeout(async () => {
    try {
      // Execute the action (we mock execution by just marking it sent)
      console.log(`[Queue] Executing action for ${leadId}: ${actionTaken}`);
      
      await pool.query(`
        UPDATE automation_logs SET status = 'sent' WHERE id = $1
      `, [logId]);

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
           INSERT INTO lead_activities (lead_id, type, summary, logged_by)
           VALUES ($1, 'system', $2, NULL)
         `, [leadId, `Manager Alert: ${payload.managerAlert}`]);
      }

    } catch (e) {
      console.error('Job failed', e);
      await pool.query(`UPDATE automation_logs SET status = 'failed' WHERE id = $1`, [logId]);
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
    switch (event) {
      case 'lead_created': {
        // 1. Run scoring
        const scoreResult = calculateLeadScore(lead);
        await pool.query(`
          UPDATE leads SET score = $1, score_tier = $2 WHERE id = $3
        `, [scoreResult.score, scoreResult.tier, lead.id]);

        // 2. Assignment
        if (!lead.assigned_rep_id) {
          const repId = await assignRep(lead);
          if (repId) {
            await pool.query(`UPDATE leads SET assigned_rep_id = $1, assigned_at = CURRENT_TIMESTAMP WHERE id = $2`, [repId, lead.id]);
            lead.assigned_rep_id = repId; // Update local ref
          } else {
             // Notify manager
             await pool.query(`
                INSERT INTO lead_activities (lead_id, type, summary) VALUES ($1, 'system', 'Failed to auto-assign rep. Manual assignment required.')
             `, [lead.id]);
          }
        }

        // 3. Queue Intro Email (Replacing WhatsApp)
        const sendDate = enforceWorkingHours(new Date(), lead.urgency_flag);
        const delay = Math.max(0, sendDate.getTime() - Date.now());
        await scheduleJob(lead.id, 'lead_created', 'Queue intro email', delay, {}, 'email');

        // 4. Create first contact task
        const dueAt = new Date(Date.now() + 30 * 60000); // 30 min
        await pool.query(`
          INSERT INTO lead_tasks (lead_id, title, due_date, assigned_to)
          VALUES ($1, 'First contact within 30 min', $2, $3)
        `, [lead.id, dueAt.toISOString(), lead.assigned_rep_id]);

        // 5. Schedule escalation check (4 hours)
        await scheduleJob(lead.id, 'lead_created', 'Escalation check', 4 * 3600000, {
          managerAlert: 'Lead not contacted within 4 hours'
        }, 'system');
        
        break;
      }

      case 'first_contact_logged': {
        // 1. Update timestamp if null
        if (!lead.first_contacted_at) {
          await pool.query(`UPDATE leads SET first_contacted_at = CURRENT_TIMESTAMP WHERE id = $1`, [lead.id]);
        }
        // 2. Recalculate score omitted here for brevity (usually called via middleware)
        // 3. Create site visit task
        const dueVisit = new Date(Date.now() + 3 * 86400000);
        await pool.query(`
          INSERT INTO lead_tasks (lead_id, title, due_date, assigned_to)
          VALUES ($1, 'Schedule site visit', $2, $3)
        `, [lead.id, dueVisit.toISOString(), lead.assigned_rep_id]);
        break;
      }

      case 'site_visit_scheduled': {
        const visitDate = new Date(payload.visit_datetime);
        // 1. Mock Calendar
        await pool.query(`
          INSERT INTO automation_logs (lead_id, trigger_event, action_taken, status)
          VALUES ($1, 'site_visit_scheduled', 'Created calendar event', 'sent')
        `, [lead.id]);

        // 2. Post visit prompt
        const promptDelay = Math.max(0, visitDate.getTime() + 2 * 3600000 - Date.now());
        await scheduleJob(lead.id, 'site_visit_scheduled', 'Post-visit prompt task', promptDelay, {
          createTask: { title: 'Post-visit follow up', dueDate: new Date(Date.now() + promptDelay).toISOString(), assignedTo: lead.assigned_rep_id }
        }, 'system');
        break;
      }

      case 'proposal_sent': {
        // 1. Task
        const dueProp = new Date(Date.now() + 2 * 86400000);
        await pool.query(`
          INSERT INTO lead_tasks (lead_id, title, due_date, assigned_to)
          VALUES ($1, 'Follow up on proposal', $2, $3)
        `, [lead.id, dueProp.toISOString(), lead.assigned_rep_id]);
        
        // 2. Manager alert 7 days
        await scheduleJob(lead.id, 'proposal_sent', 'Check if still in proposal stage', 7 * 86400000, {
          managerAlert: 'Lead stuck in proposal_sent for 7 days'
        }, 'system');
        break;
      }

      case 'lead_won': {
        // Mock project creation, PM notify, portal invite, finance sync
        await pool.query(`
          INSERT INTO automation_logs (lead_id, trigger_event, action_taken, status)
          VALUES ($1, 'lead_won', 'Created project record, notified PM, sent portal invite, synced finance', 'sent')
        `, [lead.id]);
        break;
      }

      case 'lead_lost': {
        if (!lead.lost_reason) throw new Error("lost_reason is required for lead_lost event");
        // Revival task 90 days
        await scheduleJob(lead.id, 'lead_lost', 'Revive lead', 90 * 86400000, {
          createTask: { title: 'Revive lost lead', dueDate: new Date(Date.now() + 90 * 86400000).toISOString(), assignedTo: lead.assigned_rep_id }
        }, 'system');
        break;
      }

      case 'score_tier_changed': {
        const { oldTier, newTier } = payload;
        if ((oldTier === 'cold' && newTier === 'warm') || (oldTier === 'warm' && newTier === 'hot')) {
          // Reassign logic could go here
          await pool.query(`
            INSERT INTO automation_logs (lead_id, trigger_event, action_taken, status)
            VALUES ($1, 'score_tier_changed', 'Notified manager/rep of tier upgrade', 'sent')
          `, [lead.id]);
        } else if (newTier === 'dead') {
          // Remove from rep queue
          await pool.query(`UPDATE leads SET assigned_rep_id = NULL WHERE id = $1`, [lead.id]);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[Automation Engine] Error executing ${event} for lead ${lead.id}:`, err);
  }
}

module.exports = {
  triggerAutomation,
  enforceWorkingHours,
  assignRep
};
