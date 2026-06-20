const pool = require('../../db/pool');

/**
 * Pipeline Intelligence Service
 * Handles predictive metrics such as Win Probability, Risk Level, and Lead Revival.
 */

/**
 * Recalculate Win Probability & Risk Level for a specific lead.
 */
async function updateLeadIntelligence(tenantId, leadId) {
  try {
    const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadRes.rows.length === 0) return;
    const lead = leadRes.rows[0];

    const timelineRes = await pool.query(
      `SELECT created_at FROM lead_activities 
       WHERE lead_id = $1 AND tenant_id = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [leadId, tenantId]
    );
    const lastActivity = timelineRes.rows.length > 0 ? timelineRes.rows[0].created_at : lead.created_at;
    const daysSinceActivity = Math.floor((new Date() - new Date(lastActivity)) / (1000 * 60 * 60 * 24));

    // Calculate Risk
    let riskLevel = 'Low';
    if (daysSinceActivity > 14) riskLevel = 'High';
    else if (daysSinceActivity > 7) riskLevel = 'Medium';

    if (['won', 'lost', 'archived', 'converted'].includes(lead.status)) {
      riskLevel = 'Low'; // Not at risk if already closed
    }

    // Calculate Win Probability (Heuristic baseline)
    let winProbability = 20; // base
    if (lead.score > 80) winProbability += 30;
    else if (lead.score > 50) winProbability += 15;

    if (lead.budget > 0) winProbability += 10;
    if (daysSinceActivity < 3) winProbability += 20;
    if (riskLevel === 'High') winProbability -= 30;

    // Bound probability between 0 and 100
    winProbability = Math.max(0, Math.min(100, winProbability));

    if (['won', 'converted'].includes(lead.status)) winProbability = 100;
    if (['lost', 'archived'].includes(lead.status)) winProbability = 0;

    await pool.query(
      'UPDATE leads SET win_probability = $1, risk_level = $2 WHERE id = $3 AND tenant_id = $4',
      [winProbability, riskLevel, leadId, tenantId]
    );

    return { win_probability: winProbability, risk_level: riskLevel };
  } catch (error) {
    console.error('[Pipeline Intelligence] Failed to update lead intelligence:', error);
  }
}

/**
 * Identify dormant leads suitable for revival
 */
async function getRevivalCandidates(tenantId) {
  const query = `
    SELECT id, name, email, phone, score, status, updated_at
    FROM leads
    WHERE tenant_id = $1
      AND (status = 'archived' OR status = 'lost')
      AND score >= 50
      AND updated_at < NOW() - INTERVAL '30 days'
    ORDER BY score DESC
    LIMIT 20
  `;
  const res = await pool.query(query, [tenantId]);
  return res.rows;
}

/**
 * Identify all active leads that are currently at High Risk
 */
async function getAtRiskDeals(tenantId) {
  const query = `
    SELECT id, name, stage_id, score, win_probability, risk_level, updated_at
    FROM leads
    WHERE tenant_id = $1
      AND status NOT IN ('won', 'lost', 'archived', 'converted')
      AND risk_level = 'High'
    ORDER BY win_probability ASC
    LIMIT 20
  `;
  const res = await pool.query(query, [tenantId]);
  return res.rows;
}

/**
 * Autonomous Revenue Engine: Drafts follow-up emails for Medium/High risk leads.
 */
async function executeAutonomousFollowups(tenantId) {
  try {
    // Find active leads that haven't been touched in 7+ days (Medium risk)
    const query = `
      SELECT id, name, email, budget_max, custom_fields 
      FROM leads 
      WHERE tenant_id = $1 
        AND status NOT IN ('won', 'lost', 'archived')
        AND risk_level IN ('Medium', 'High')
      LIMIT 10
    `;
    const res = await pool.query(query, [tenantId]);
    
    let generatedCount = 0;
    const { generateFollowupRecommendations } = require('../../services/aiService');
    const { activityService } = require('../../services/timeline/activityService');

    for (const lead of res.rows) {
      // Use AI to generate a hyper-personalized email draft
      const recommendation = await generateFollowupRecommendations(lead, 'over 7 days ago');
      
      if (recommendation.draftMessage) {
        // Log it as an autonomous action item in the timeline
        await pool.query(
          `INSERT INTO lead_activities (tenant_id, lead_id, type, notes, created_by)
           VALUES ($1, $2, 'email', $3, NULL)`, // NULL created_by implies System/AI
          [tenantId, lead.id, `[AUTONOMOUS DRAFT]: ${recommendation.draftMessage}`]
        );
        generatedCount++;
      }
    }
    
    return { success: true, emails_drafted: generatedCount };
  } catch (error) {
    console.error('[Pipeline Intelligence] Autonomous followups error:', error);
    return { success: false, error: 'Failed to execute autonomous followups' };
  }
}

module.exports = {
  updateLeadIntelligence,
  getRevivalCandidates,
  getAtRiskDeals,
  executeAutonomousFollowups
};
