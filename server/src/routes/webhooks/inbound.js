const express = require('express');
const crypto = require('crypto');
const pool = require('../../db/pool');
const { createLead } = require('../../services/leads/createLead');
const { updateLead } = require('../../services/leads/updateLead');

const router = express.Router();

router.post('/:sourceKey', async (req, res, next) => {
  try {
    const { sourceKey } = req.params;

    // 1. Lookup webhook source config
    const sourceResult = await pool.query(
      'SELECT * FROM webhook_sources WHERE source_key = $1 AND is_active = true',
      [sourceKey]
    );

    if (sourceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Source not found or inactive' });
    }

    const source = sourceResult.rows[0];
    const tenantId = source.tenant_id;

    // 2. Verify signature if source.secret is set
    if (source.secret) {
      const signatureHeader = req.headers['x-hub-signature-256'];
      if (!signatureHeader) {
        return res.status(401).json({ success: false, error: 'Missing signature header' });
      }

      // We configured express.json() to save req.rawBody. Fallback to stringify if missing (though imprecise).
      const rawBodyBuf = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body), 'utf8');
      
      const hmac = crypto.createHmac('sha256', source.secret);
      hmac.update(rawBodyBuf);
      const expectedSignature = `sha256=${hmac.digest('hex')}`;

      try {
        const expectedBuf = Buffer.from(expectedSignature, 'utf8');
        const incomingBuf = Buffer.from(signatureHeader, 'utf8');
        if (expectedBuf.length !== incomingBuf.length || !crypto.timingSafeEqual(expectedBuf, incomingBuf)) {
          return res.status(401).json({ success: false, error: 'Signature mismatch' });
        }
      } catch (e) {
        return res.status(401).json({ success: false, error: 'Invalid signature format' });
      }
    }

    // 3. Parse raw JSON body
    // express.json() already parsed it into req.body
    const rawData = req.body;

    // 4. Apply field mappings
    const mappings = typeof source.field_mapping === 'string' 
      ? JSON.parse(source.field_mapping) 
      : (source.field_mapping || []);

    const leadData = {};
    const customFields = {};

    for (const mapping of mappings) {
      const { sourceField, targetField, transform } = mapping;
      
      // Resolve source value via simple dot notation
      const parts = (sourceField || '').split('.');
      let val = rawData;
      for (const p of parts) {
        if (val && val[p] !== undefined) {
          val = val[p];
        } else {
          val = undefined;
          break;
        }
      }

      if (val === undefined) continue;

      // Transform
      if (transform === 'lowercase') val = String(val).toLowerCase();
      else if (transform === 'uppercase') val = String(val).toUpperCase();
      else if (transform === 'trim') val = String(val).trim();

      // Map to target field
      if (targetField.startsWith('custom_fields.')) {
        const customKey = targetField.split('.')[1];
        customFields[customKey] = val;
      } else {
        leadData[targetField] = val;
      }
    }

    if (Object.keys(customFields).length > 0) {
      leadData.custom_fields = customFields;
    }

    // Assign source string if specified
    if (!leadData.source) {
      leadData.source = source.provider_name || 'webhook';
    }

    let leadId = null;

    // 5. Apply dedup rules
    const dedupField = source.dedup_field;
    if (dedupField && leadData[dedupField]) {
      const dedupValue = leadData[dedupField];
      
      let query;
      let values = [tenantId, dedupValue];

      if (dedupField === 'email' || dedupField === 'phone') {
        query = `SELECT id FROM leads WHERE tenant_id = $1 AND ${dedupField} = $2 AND deleted_at IS NULL LIMIT 1`;
      } else if (dedupField.startsWith('custom_fields.')) {
        const customKey = dedupField.split('.')[1];
        query = `SELECT id FROM leads WHERE tenant_id = $1 AND custom_fields->>$2 = $3 AND deleted_at IS NULL LIMIT 1`;
        values = [tenantId, customKey, String(dedupValue)];
      }

      if (query) {
        const existingResult = await pool.query(query, values);
        if (existingResult.rows.length > 0) {
          leadId = existingResult.rows[0].id;
        }
      }
    }

    // 6. Call createLead or updateLead
    const userId = null; // Webhooks are system actions

    if (leadId) {
      // Update
      await updateLead({ tenantId, userId, leadId, data: leadData });
    } else {
      // Create
      // Only require name/phone conceptually, if missing the createLead might throw
      // We'll let it throw so it's logged as an error
      const newLead = await createLead({ tenantId, userId, data: leadData });
      leadId = newLead.id;
    }

    // 7. Log to inbound_webhook_logs
    await pool.query(
      `INSERT INTO inbound_webhook_logs (
        tenant_id, source_id, payload, matched_lead_id, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, source.id, JSON.stringify(rawData), leadId, 'success', null]
    );

    // 8. Return 200
    return res.status(200).json({ received: true, leadId });

  } catch (error) {
    console.error('Webhook Error:', error);
    
    try {
      const { sourceKey } = req.params;
      const sourceResult = await pool.query('SELECT id, tenant_id FROM webhook_sources WHERE source_key = $1', [sourceKey]);
      if (sourceResult.rows.length > 0) {
        const { id: sourceId, tenant_id: tenantId } = sourceResult.rows[0];
        await pool.query(
          `INSERT INTO inbound_webhook_logs (
            tenant_id, source_id, payload, matched_lead_id, status, error_message
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [tenantId, sourceId, JSON.stringify(req.body), null, 'error', error.message]
        );
      }
    } catch (logErr) {
      // Ignore nested logging errors
    }
    
    // Return 400 for validation errors, 500 for others
    if (error.message.includes('VALIDATION_ERROR') || error.message.includes('STAGE_GATE_FAILED')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: 'Internal Webhook Error' });
  }
});

module.exports = router;
