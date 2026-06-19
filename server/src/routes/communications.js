const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const pool = require('../db/pool');
const { success, fail } = require('../utils/response');
const { logActivity } = require('../services/activities/activityService');

// Get all communications for a lead
router.get('/lead/:leadId', authenticate, async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const query = `
      SELECT c.*, u.name as user_name
      FROM communications c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.tenant_id = $1 AND c.lead_id = $2
      ORDER BY c.sent_at DESC
    `;
    const result = await pool.query(query, [tenantId, leadId]);
    return success(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Add a new communication (e.g., logging a call or sending a manual email/whatsapp)
router.post('/lead/:leadId', authenticate, async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const { channel, direction, subject, body, status, metadata } = req.body;

    let finalStatus = status || 'sent';

    if (channel === 'whatsapp' && direction === 'outbound') {
      const leadRes = await pool.query('SELECT phone FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
      if (leadRes.rowCount > 0 && leadRes.rows[0].phone) {
        const { sendWhatsAppMessage } = require('../services/whatsappService');
        try {
          const waResult = await sendWhatsAppMessage(leadRes.rows[0].phone, body);
          if (!waResult.success) {
            finalStatus = 'failed';
          }
        } catch (waErr) {
          console.error('WhatsApp API Error:', waErr);
          finalStatus = 'failed';
        }
      } else {
        finalStatus = 'failed'; // No phone number
      }
    }

    const query = `
      INSERT INTO communications (tenant_id, lead_id, user_id, channel, direction, subject, body, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const result = await pool.query(query, [
      tenantId, leadId, req.user.userId, channel, direction, subject, body, finalStatus, metadata ? JSON.stringify(metadata) : '{}'
    ]);

    return success(res, result.rows[0], {}, 201);
  } catch (error) {
    next(error);
  }
});

const { draftCommunication } = require('../services/aiService');

// Draft a message using AI
router.post('/lead/:leadId/draft', authenticate, async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const { channel, instructions } = req.body;

    // fetch lead
    const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadRes.rowCount === 0) return fail(res, 'Lead not found', 404);

    const draft = await draftCommunication(leadRes.rows[0], channel, instructions);
    return success(res, { draft });
  } catch (error) {
    next(error);
  }
});

// Inbound webhook for WhatsApp bot
router.post('/webhook/inbound', async (req, res, next) => {
  try {
    const { from, message, payload_type } = req.body;
    // Note: Adjust the parsing logic based on your specific WhatsApp provider's webhook schema
    
    if (!from || !message) {
      return res.status(400).send('Invalid payload');
    }

    const cleanPhone = from.replace(/[^0-9]/g, '');
    
    // 1. Identify lead by phone number
    const leadRes = await pool.query('SELECT id, tenant_id FROM leads WHERE phone LIKE $1 LIMIT 1', [`%${cleanPhone}%`]);
    
    if (leadRes.rows.length > 0) {
      const lead = leadRes.rows[0];
      
      // 2. Log interaction
      await logActivity({
        tenantId: lead.tenant_id,
        userId: null, // System event
        leadId: lead.id,
        type: 'whatsapp',
        title: 'Received WhatsApp Message',
        notes: `Message: ${message}`,
        performedAt: new Date().toISOString()
      });

      console.log(`[WhatsApp Bot] Logged message from ${from} for lead ${lead.id}`);
    } else {
      console.log(`[WhatsApp Bot] Unrecognized sender: ${from}`);
    }

    return res.status(200).send('OK');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
