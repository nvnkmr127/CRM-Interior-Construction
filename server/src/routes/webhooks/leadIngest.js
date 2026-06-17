const express = require('express');
const pool = require('../../db/pool');
const { createLead } = require('../../services/leads/createLead');
// Note: assuming calculateLeadScore exists; we'll mock its logic or require it if possible.
// In reality, scoring might be called within createLead or via an event.

const router = express.Router();

/**
 * Webhook endpoint for ingesting leads from third parties.
 */
router.post('/', async (req, res, next) => {
  try {
    const payload = req.body;
    let name, phone, email, city, source;
    let mappedData = {};

    // 1. Map fields based on known payload shapes
    if (payload.full_name && payload.phone_number) {
      // Meta Ads
      name = payload.full_name;
      phone = payload.phone_number;
      email = payload.email;
      source = 'meta_ads';
    } else if (payload['First Name'] && payload['Phone Number']) {
      // Google Ads
      name = `${payload['First Name']} ${payload['Last Name'] || ''}`.trim();
      phone = payload['Phone Number'];
      email = payload['Email'];
      source = 'google_ads';
    } else if (payload.Name && payload.Mobile) {
      // 99acres or similar
      name = payload.Name;
      phone = payload.Mobile;
      email = payload.Email;
      city = payload.City;
      source = payload.Source || '99acres'; // Fallback
    } else {
      // Generic fallback
      name = payload.name || payload.fullName;
      phone = payload.phone || payload.mobile;
      email = payload.email;
      source = payload.source || 'other';
    }

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Missing required fields (name, phone)' });
    }

    mappedData = {
      name,
      phone,
      email,
      city,
      source
    };

    // Assuming a default tenant for webhook integration or it must be passed in the URL/Header
    // For this demonstration, we'll pick the first tenant if not provided
    let tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
      if (tenantRes.rows.length > 0) {
        tenantId = tenantRes.rows[0].id;
      } else {
        return res.status(400).json({ success: false, error: 'No tenant context available' });
      }
    }

    let isDuplicate = false;
    let originalLeadId = null;
    let newLeadId = null;
    let assignedTo = null;

    // 2. Duplicate Check
    const dupRes = await pool.query(
      'SELECT id, assigned_rep_id FROM leads WHERE phone = $1 AND tenant_id = $2 LIMIT 1',
      [phone, tenantId]
    );

    if (dupRes.rows.length > 0) {
      isDuplicate = true;
      originalLeadId = dupRes.rows[0].id;
      assignedTo = dupRes.rows[0].assigned_rep_id;
      
      // Insert duplicate record linking to original
      const insertDupRes = await pool.query(
        `INSERT INTO leads (tenant_id, name, phone, email, source, is_duplicate, duplicate_of_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [tenantId, name, phone, email, source, true, originalLeadId]
      );
      newLeadId = insertDupRes.rows[0].id;
    } else {
      // Not a duplicate: insert normally via service
      const newLead = await createLead({ tenantId, userId: null, data: mappedData });
      newLeadId = newLead.id;
      assignedTo = newLead.assigned_rep_id;
      
      // We assume createLead triggers scoring + assignment under the hood as per architecture
    }

    // 3. Log to automation_logs
    await pool.query(
      `INSERT INTO automation_logs (lead_id, trigger_event, action_taken, channel, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [newLeadId, 'webhook_ingest', isDuplicate ? 'logged_duplicate' : 'created_lead', source, 'success']
    );

    // 4. Return response
    return res.status(200).json({
      success: true,
      lead_id: newLeadId,
      is_duplicate: isDuplicate,
      duplicate_of_id: originalLeadId,
      assigned_to: assignedTo
    });

  } catch (error) {
    console.error('Lead Ingest Webhook Error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
