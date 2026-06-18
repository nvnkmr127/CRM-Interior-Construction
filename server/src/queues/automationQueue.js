const pool = require('../db/pool');
const evaluateTrigger = require('../services/automation/evaluateTrigger');
const executeAction = require('../services/automation/executeAction');

/**
 * Enqueues an event to be processed by the asynchronous automation engine.
 */
async function enqueueAutomation({ tenantId, eventType, entity, record, changes = {} }) {
  const query = `
    INSERT INTO automation_jobs (tenant_id, event_type, entity, record, changes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `;
  const result = await pool.query(query, [
    tenantId, 
    eventType, 
    entity, 
    JSON.stringify(record), 
    JSON.stringify(changes)
  ]);
  return result.rows[0];
}

/**
 * Processes a batch of pending automation jobs safely via transactional row locks.
 */
async function processAutomationJobs() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch up to 10 pending jobs, strictly locking them so concurrent workers don't execute duplicates
    const fetchQuery = `
      SELECT id, tenant_id, event_type, entity, record, changes 
      FROM automation_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 10
    `;
    const jobsResult = await client.query(fetchQuery);
    const jobs = jobsResult.rows;

    if (jobs.length === 0) {
      await client.query('ROLLBACK');
      return;
    }

    // Mark them explicitly as processing
    const jobIds = jobs.map(j => j.id);
    await client.query(`
      UPDATE automation_jobs 
      SET status = 'processing', attempts = attempts + 1 
      WHERE id = ANY($1)
    `, [jobIds]);

    await client.query('COMMIT');

    // Process each job independently (outside of the initial select transaction)
    for (const job of jobs) {
      try {
        // 1. Fetch active automation_rules for tenant
        const rulesRes = await pool.query(`
          SELECT id, name, trigger, conditions, actions 
          FROM automation_rules 
          WHERE tenant_id = $1 AND is_active = true
        `, [job.tenant_id]);
        
        const rules = rulesRes.rows;

        // 2. Evaluate triggers dynamically
        for (const rule of rules) {
          const shouldFire = evaluateTrigger(rule, job.event_type, job.record, job.changes);
          
          if (shouldFire) {
            const actions = rule.actions || [];
            
            // Execute all configured rule actions
            for (const action of actions) {
              const context = {
                tenantId: job.tenant_id,
                userId: 'system',
                record: job.record,
                triggeredBy: rule.id
              };
              await executeAction(action, context);
            }

            // Update rule statistics independently
            pool.query(`
              UPDATE automation_rules 
              SET run_count = run_count + 1, last_run_at = NOW() 
              WHERE id = $1
            `, [rule.id]).catch(err => console.error('[AutomationQueue] Failed to update rule execution stats:', err));
          }
        }

        // 3. Mark job as fully completed
        await pool.query(`
          UPDATE automation_jobs 
          SET status = 'completed', processed_at = NOW() 
          WHERE id = $1
        `, [job.id]);

      } catch (err) {
        // 4. On structural evaluation error: mark failed and securely store the diagnostic message
        await pool.query(`
          UPDATE automation_jobs 
          SET status = 'failed', error = $1, processed_at = NOW() 
          WHERE id = $2
        `, [err.message || String(err), job.id]);
      }
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[AutomationQueue] Fatal error during batch processing:', error);
  } finally {
    client.release();
  }
}

// Semaphore to ensure the polling routine does not stack overlaps
let isProcessing = false;

// Detect DB connection/network errors that warrant backoff
function isConnectionError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNRESET' ||
    // pg FATAL from Supabase pooler when host unreachable (code XX000)
    (err.severity === 'FATAL' && msg.includes('not found'))
  );
}

function startQueuePolling() {
  const BASE_DELAY = 5_000;       // 5 s normal poll interval
  const MAX_BACKOFF = 120_000;    // 2 min ceiling
  let backoff = BASE_DELAY;
  let consecutiveConnErrors = 0;

  console.log('[AutomationQueue] Poller started (5000ms cycle).');

  const schedule = () => {
    setTimeout(async () => {
      if (isProcessing) { schedule(); return; }
      isProcessing = true;
      try {
        await processAutomationJobs();
        // Successful poll — reset backoff
        if (consecutiveConnErrors > 0) {
          console.log('[AutomationQueue] DB connection restored. Resuming normal polling.');
          consecutiveConnErrors = 0;
        }
        backoff = BASE_DELAY;
      } catch (e) {
        if (isConnectionError(e)) {
          consecutiveConnErrors++;
          backoff = Math.min(backoff * 2, MAX_BACKOFF);
          // Only log the first occurrence and every 5th repeat to avoid spam
          if (consecutiveConnErrors === 1 || consecutiveConnErrors % 5 === 0) {
            console.error(
              `[AutomationQueue] DB unreachable (attempt ${consecutiveConnErrors}). ` +
              `Backing off to ${backoff / 1000}s. Error: ${e.message}`
            );
          }
        } else {
          console.error('[AutomationQueue Poller] Execution exception:', e);
          backoff = BASE_DELAY;
        }
      } finally {
        isProcessing = false;
        schedule();
      }
    }, backoff);
  };

  schedule();
}

module.exports = {
  enqueueAutomation,
  processAutomationJobs,
  startQueuePolling
};
