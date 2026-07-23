const express = require('express')
const router = express.Router()
const pool = require('../config/db')
const authenticate = require('../middleware/authenticate')
const authorize = require('../middleware/authorize')
const { success, fail } = require('../utils/response')

router.use(authenticate)

// Get all email logs for a tenant
router.get('/', authorize('users:manage'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.user_id, e.recipient_email, e.subject, e.template_name, e.status, e.error_message, e.retry_count, e.created_at, e.sent_at, u.name as user_name
       FROM email_queue e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.tenant_id = $1
       ORDER BY e.created_at DESC
       LIMIT 100`,
      [req.tenantId]
    )
    return success(res, rows)
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch email logs', 500)
  }
})

// Get email logs for a specific user
router.get('/user/:id', authorize('users:manage'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, recipient_email, subject, template_name, status, error_message, retry_count, created_at, sent_at
       FROM email_queue
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [req.tenantId, req.params.id]
    )
    return success(res, rows)
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch user email logs', 500)
  }
})

module.exports = router
