const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const { queueEmail } = require('../services/emailService');

router.use(authenticate);

// Get all email templates for tenant
router.get('/', authorize('config:read'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, template_key, subject, html_content, created_at, updated_at FROM email_templates WHERE tenant_id = $1 ORDER BY template_key ASC',
      [req.tenantId]
    );
    return success(res, rows);
  } catch (error) {
    console.error('[Email Templates] Fetch error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch templates', 500);
  }
});

// Create or update template
router.post('/', authorize('config:write'), async (req, res) => {
  const { template_key, subject, html_content } = req.body;
  if (!template_key || !subject || !html_content) {
    return fail(res, 'VALIDATION_ERROR', 'template_key, subject, and html_content are required', 400);
  }

  try {
    const query = `
      INSERT INTO email_templates (tenant_id, template_key, subject, html_content)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, template_key) 
      DO UPDATE SET subject = EXCLUDED.subject, html_content = EXCLUDED.html_content
      RETURNING *
    `;
    const { rows } = await pool.query(query, [req.tenantId, template_key, subject, html_content]);
    return success(res, rows[0]);
  } catch (error) {
    console.error('[Email Templates] Save error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to save template', 500);
  }
});

// Test email endpoint
router.post('/test', authorize('config:write'), async (req, res) => {
  const { subject, html_content, recipient_email } = req.body;
  
  if (!subject || !html_content || !recipient_email) {
    return fail(res, 'VALIDATION_ERROR', 'subject, html_content, and recipient_email are required', 400);
  }

  try {
    // Send a mock user_id since we are just testing
    await pool.query(
      `INSERT INTO email_queue (tenant_id, user_id, recipient_email, subject, template_name, template_data)
       VALUES ($1, $2, $3, $4, 'test_override', $5)`,
      [req.tenantId, req.user.userId, recipient_email, subject, JSON.stringify({ htmlOverride: html_content })]
    );
    return success(res, { message: 'Test email queued successfully' });
  } catch (error) {
    console.error('[Email Templates] Test error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to queue test email', 500);
  }
});

module.exports = router;
