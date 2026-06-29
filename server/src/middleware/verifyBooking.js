const pool = require('../config/db');
const { fail } = require('../utils/response');

async function verifyProjectBooked(req, res, next) {
  try {
    const projectId = req.params.projectId || req.params.id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!projectId || !uuidRegex.test(projectId)) {
      return next();
    }

    const { rows } = await pool.query(
      'SELECT status FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [projectId, req.tenantId]
    );

    if (rows.length > 0 && rows[0].status === 'pending_booking') {
      return fail(res, 'BOOKING_REQUIRED', 'Project booking confirmation is pending. Downstream actions are locked until booking details are submitted.', 400);
    }

    next();
  } catch (err) {
    console.error('[verifyBooking Middleware] Error:', err);
    next(err);
  }
}

module.exports = verifyProjectBooked;
