const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db');

// Get escalations for a project
router.get('/', async (req, res) => {
  const { projectId } = req.params;
  const tenantId = req.user.tenantId;

  try {
    const result = await pool.query(
      `SELECT pe.*, pm.name as milestone_name, pm.amount, pm.due_date, u.name as authorizer_name
       FROM payment_escalations pe
       JOIN payment_milestones pm ON pe.payment_milestone_id = pm.id
       LEFT JOIN users u ON pe.authorized_by = u.id
       WHERE pe.project_id = $1 AND pe.tenant_id = $2
       ORDER BY pe.created_at DESC`,
      [projectId, tenantId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching payment escalations:', error);
    res.status(500).json({ error: 'Failed to fetch payment escalations' });
  }
});

// Trigger a new escalation
router.post('/', async (req, res) => {
  const { projectId } = req.params;
  const tenantId = req.user.tenantId;
  const { payment_milestone_id, escalation_level, notes } = req.body;
  const authorized_by = req.user.id;

  try {
    await pool.query('BEGIN');

    // Insert escalation
    const result = await pool.query(
      `INSERT INTO payment_escalations (
         payment_milestone_id, project_id, tenant_id, escalation_level, authorized_by, client_communication_sent, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [payment_milestone_id, projectId, tenantId, escalation_level, authorized_by, true, notes]
    );

    // Apply specific actions based on escalation level
    if (escalation_level === '30_days_hold' || escalation_level === '60_days_lockout') {
      await pool.query(
        `UPDATE projects SET financial_status = 'on_hold' WHERE id = $1 AND tenant_id = $2`,
        [projectId, tenantId]
      );
    }
    
    // Auto-alert logic for '15_days_alert' or '45_days_legal' could dispatch emails/SMS here
    
    // Log the event
    await pool.query(
      `INSERT INTO communications (project_id, tenant_id, sender_id, recipient, subject, body, type, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'email', 'sent')`,
      [
        projectId, tenantId, authorized_by, 'Client', 
        `Payment Default Escalation: ${escalation_level.replace(/_/g, ' ')}`, 
        `Triggered payment default escalation level: ${escalation_level}. Notes: ${notes || 'N/A'}`
      ]
    );

    await pool.query('COMMIT');
    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error triggering payment escalation:', error);
    res.status(500).json({ error: 'Failed to trigger payment escalation' });
  }
});

// Resolve an escalation
router.patch('/:id/resolve', async (req, res) => {
  const { id, projectId } = req.params;
  const tenantId = req.user.tenantId;

  try {
    await pool.query('BEGIN');
    
    const result = await pool.query(
      `UPDATE payment_escalations
       SET status = 'resolved'
       WHERE id = $1 AND project_id = $2 AND tenant_id = $3
       RETURNING *`,
      [id, projectId, tenantId]
    );
    
    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Escalation not found' });
    }

    // Check if there are any other active escalations for this project
    const activeResult = await pool.query(
      `SELECT count(*) FROM payment_escalations WHERE project_id = $1 AND tenant_id = $2 AND status = 'active'`,
      [projectId, tenantId]
    );
    
    if (parseInt(activeResult.rows[0].count, 10) === 0) {
       // Clear financial hold if all escalations resolved
       await pool.query(
         `UPDATE projects SET financial_status = 'clear' WHERE id = $1 AND tenant_id = $2`,
         [projectId, tenantId]
       );
    }
    
    await pool.query('COMMIT');
    res.json({ data: result.rows[0] });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error resolving payment escalation:', error);
    res.status(500).json({ error: 'Failed to resolve payment escalation' });
  }
});

module.exports = router;
