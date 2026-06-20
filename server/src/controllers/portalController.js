const pool = require('../db/pool');

/**
 * Customer Portal Controller
 * Publicly accessible read-only endpoints protected by a unique tracking_code.
 */

exports.getProjectStatusHandler = async (req, res, next) => {
  try {
    const { trackingCode } = req.params;

    // We locate the lead by searching for the tracking code inside custom_fields
    const leadRes = await pool.query(
      `SELECT id, name, status, stage_id, budget_max, custom_fields, created_at, updated_at
       FROM leads
       WHERE custom_fields->>'tracking_code' = $1`,
      [trackingCode]
    );

    if (leadRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Project not found or invalid tracking code' } });
    }

    const lead = leadRes.rows[0];

    // Fetch safe timeline events (only milestones, no internal notes)
    const timelineRes = await pool.query(
      `SELECT type, created_at
       FROM lead_activities
       WHERE lead_id = $1 AND type IN ('stage_change', 'meeting', 'quote_sent')
       ORDER BY created_at DESC`,
      [lead.id]
    );

    res.json({
      success: true,
      data: {
        project: {
          name: lead.name,
          status: lead.status,
          readiness: lead.custom_fields.project_readiness || {},
          started_at: lead.created_at,
          last_updated: lead.updated_at
        },
        milestones: timelineRes.rows
      }
    });
  } catch (error) {
    console.error('getProjectStatusHandler error:', error);
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
  }
};
