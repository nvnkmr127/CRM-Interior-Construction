const pool = require('../../config/db');

/**
 * V4 Zero Trust: Automated Threat Engine
 * Analyzes real-time audit logs to detect insider threats or compromised accounts.
 */
async function analyzeThreat(tenantId, userId, action) {
  if (!tenantId || !userId) return;

  try {
    // We specifically look for destructive actions like mass deletes or exports
    if (!action.includes('delete') && !action.includes('export')) return;

    // Check how many destructive actions happened in the last 5 minutes
    const query = `
      SELECT count(*) as count 
      FROM audit_logs 
      WHERE tenant_id = $1 AND user_id = $2 
        AND action IN ('lead.deleted', 'project.deleted', 'api.delete', 'api.get.export') 
        AND created_at > NOW() - INTERVAL '5 minutes'
    `;
    const { rows } = await pool.query(query, [tenantId, userId]);
    const count = parseInt(rows[0].count, 10);

    // If 10 or more destructive actions happen within 5 minutes, trigger Automated Remediation
    if (count >= 10) {
      await triggerAutomatedRemediation(tenantId, userId, count);
    }
  } catch (error) {
    console.error('[Threat Engine] Failed to analyze threat:', error);
  }
}

/**
 * Executes Automated Remediation Protocol
 */
async function triggerAutomatedRemediation(tenantId, userId, count) {
  console.warn(`[THREAT ENGINE] CRITICAL ALERT: User ${userId} exceeded destructive limits (${count} actions/5m). Initiating Automated Remediation.`);

  try {
    // 1. Suspend the user account
    await pool.query(
      `UPDATE users SET status = 'suspended_risk' WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId]
    );

    // 2. Revoke all active sessions immediately
    await pool.query(
      `DELETE FROM sessions WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId]
    );

    // 3. Log the critical security event
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tenantId, userId, 'security.automated_remediation', 'user',
        JSON.stringify({ status: 'active' }),
        JSON.stringify({ status: 'suspended_risk', reason: 'High velocity destructive actions' })
      ]
    );

    console.warn(`[THREAT ENGINE] Automated Remediation Complete for User ${userId}. All sessions revoked.`);
  } catch (error) {
    console.error('[Threat Engine] Failed to execute remediation:', error);
  }
}

module.exports = { analyzeThreat };
