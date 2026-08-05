const logger = require('../../utils/logger');
const pool = require('../../db/pool');
const { sendWhatsAppMessage, pullWhatsAppChatStatus } = require('../whatsappService');
async function createCommunication({ tenantId, userId, leadId, type, notes, metadata }) {
  if (!['email', 'whatsapp', 'call', 'sms'].includes(type)) {
    const error = new Error('Invalid communication type');
    error.code = 'VALIDATION_ERROR';
    error.statusCode = 400;
    throw error;
  }

  let finalMetadata = { ...(metadata || {}) };

  if (type === 'whatsapp' && finalMetadata.direction === 'outbound') {
    const leadRes = await pool.query('SELECT phone FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadRes.rowCount > 0 && leadRes.rows[0].phone) {
      try {
        const waResult = await sendWhatsAppMessage(leadRes.rows[0].phone, notes);
        if (waResult.success) {
          finalMetadata.status = 'sent';
          finalMetadata.messageId = waResult.messageId;
        } else {
          finalMetadata.status = 'failed';
        }
      } catch (waErr) {
        logger.error('[WhatsApp Service Error] createCommunicationHandler:', waErr);
        finalMetadata.status = 'failed';
      }
    } else {
      finalMetadata.status = 'failed';
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO activities (tenant_id, lead_id, type, notes, user_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [tenantId, leadId, type, notes, userId, finalMetadata]
  );
  
  return rows[0];
}

async function syncWhatsApp({ tenantId, leadId }) {
  // 1. Fetch lead details to get the phone number
  const leadRes = await pool.query('SELECT phone FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
  if (leadRes.rowCount === 0) {
    const error = new Error('Lead not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }
  const phone = leadRes.rows[0].phone;
  if (!phone) {
    return { messages: [], message: 'No phone number associated with lead' };
  }

  // 2. Fetch existing WhatsApp activities for this lead
  const commsRes = await pool.query(
    `SELECT * FROM activities 
     WHERE lead_id = $1 AND tenant_id = $2 AND type = 'whatsapp'
     ORDER BY created_at ASC`,
    [leadId, tenantId]
  );

  const existingMessages = commsRes.rows;

  // 3. Call pullWhatsAppChatStatus to get status updates and new messages
  const syncResult = await pullWhatsAppChatStatus(phone, existingMessages);

  if (syncResult.success) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // A. Apply status updates
      for (const update of syncResult.statusUpdates) {
        await client.query(
          `UPDATE activities 
           SET metadata = jsonb_set(
             jsonb_set(metadata, '{status}', $1),
             '{reaction}', $2
           ),
           completed_at = CURRENT_TIMESTAMP
           WHERE lead_id = $3 AND tenant_id = $4 AND type = 'whatsapp' 
             AND (metadata->>'messageId' = $5 OR id::text = $5)`,
          [
            JSON.stringify(update.status),
            update.reaction ? JSON.stringify(update.reaction) : 'null',
            leadId,
            tenantId,
            update.messageId
          ]
        );
      }

      // B. Insert new inbound messages
      for (const msg of syncResult.newMessages) {
        const dupRes = await client.query(
          `SELECT id FROM activities 
           WHERE lead_id = $1 AND tenant_id = $2 AND type = 'whatsapp'
             AND metadata->>'messageId' = $3`,
          [leadId, tenantId, msg.messageId]
        );

        if (dupRes.rowCount === 0) {
          await client.query(
            `INSERT INTO activities (tenant_id, lead_id, type, notes, metadata, created_at)
             VALUES ($1, $2, 'whatsapp', $3, $4, $5)`,
            [
              tenantId,
              leadId,
              msg.body,
              JSON.stringify({
                direction: 'inbound',
                status: 'received',
                messageId: msg.messageId
              }),
              msg.timestamp || new Date()
            ]
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // 4. Return the refreshed list of communications
  const refreshedCommsRes = await pool.query(
    `SELECT * FROM activities 
     WHERE lead_id = $1 AND tenant_id = $2 AND type IN ('email', 'whatsapp', 'call', 'sms')
     ORDER BY created_at DESC`,
    [leadId, tenantId]
  );

  return { messages: refreshedCommsRes.rows };
}

module.exports = {
  createCommunication,
  syncWhatsApp
};
