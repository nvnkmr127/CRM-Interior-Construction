const pool = require('../db/pool');
const eventBus = require('../services/eventBus');

async function createLead(tenantId, data, txClient = null) {
  const { 
    name, email, phone, source, stage_id, assignee_id, score, custom_fields, notes, status, created_by,
    builder_name, possession_date, house_status, _loan_approved, interior_style, material_preference, 
    preferred_communication, preferred_language, referral_source, lifestyle_preferences, additional_contacts,
    win_probability, last_contacted_at, ai_score_breakdown,
    property_type, _scope, _locality, _budget_max, carpet_area_sqft, _dnc_flag, _consent_whatsapp, _competitor_mentioned, _lead_number
  } = data;
  
  const client = txClient || await pool.connect();
  
  try {
    if (!txClient) await client.query('BEGIN');

    // 1. Insert core lead
    // Pack unknown columns into custom_fields
    const parsedCustomFields = typeof custom_fields === 'object' ? custom_fields : JSON.parse(custom_fields || '{}');
    const finalCustomFields = {
      ...parsedCustomFields,
      preferred_communication,
      preferred_language,
      referral_source,
      lifestyle_preferences,
      additional_contacts,
      win_probability,
      last_contacted_at,
      ai_score_breakdown
    };

    const leadQuery = `
      INSERT INTO leads (
        tenant_id, name, email, phone, source, stage_id, assignee_id, score, custom_fields, notes, status, created_by, win_probability
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *
    `;
    
    const leadValues = [
      tenantId, name, email || null, phone || null, source || null, stage_id || null, assignee_id || null, score || 0,
      JSON.stringify(finalCustomFields),
      notes || null, status || 'active', created_by || null, win_probability || 0
    ];
    
    const leadResult = await client.query(leadQuery, leadValues);
    const lead = leadResult.rows[0];

    // 2. Insert properties
    const propQuery = `
      INSERT INTO lead_properties (tenant_id, lead_id, builder, possession_date, house_status, property_type, carpet_area)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await client.query(propQuery, [tenantId, lead.id, builder_name || null, possession_date || null, house_status || null, property_type || null, carpet_area_sqft || null]);

    // 3. Insert preferences
    const prefQuery = `
      INSERT INTO lead_preferences (tenant_id, lead_id, interior_style, material)
      VALUES ($1, $2, $3, $4)
    `;
    await client.query(prefQuery, [tenantId, lead.id, interior_style || null, material_preference || null]);

    if (!txClient) await client.query('COMMIT');
    
    // Attach details for frontend
    lead.builder_name = builder_name;
    lead.possession_date = possession_date;
    lead.house_status = house_status;
    lead.interior_style = interior_style;
    lead.material_preference = material_preference;
    
    return lead;
  } catch (err) {
    if (!txClient) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (!txClient) client.release();
  }
}

async function findLeadById(tenantId, leadId) {
  const query = `
    SELECT l.*,
           u.name AS assignee_name, u.avatar_url AS assignee_avatar,
           s.name AS stage_name, s.color AS stage_color,
           lp.builder AS builder_name, lp.possession_date, lp.house_status, lp.property_type, lp.carpet_area, lp.carpet_area_sqft,
           lpref.interior_style, lpref.material AS material_preference,
           lpref.family_size, lpref.usage_patterns, lpref.storage_priorities,
           lpref.brand_flexibility, lpref.brand_remarks, lpref.existing_furniture,
           lpref.budget_category_allocation,
           COALESCE(EXTRACT(DAY FROM CURRENT_TIMESTAMP - l.updated_at), 0) AS days_in_stage,
           last_wa.status AS last_whatsapp_status,
           last_wa.message AS last_whatsapp_message,
           last_wa.direction AS last_whatsapp_direction,
           last_wa.reaction AS last_whatsapp_reaction,
           last_wa.created_at AS last_whatsapp_created_at,
           next_mtg.id AS next_meeting_id,
           next_mtg.schedule AS next_meeting_schedule,
           next_mtg.title AS next_meeting_title,
           next_mtg.meeting_type AS next_meeting_type,
           next_mtg.meeting_link AS next_meeting_link,
           next_mtg.meeting_host AS next_meeting_host,
           next_mtg.duration AS next_meeting_duration,
           next_mtg.notes AS next_meeting_notes
    FROM leads l
    LEFT JOIN users u ON l.assignee_id = u.id
    LEFT JOIN lead_stages s ON l.stage_id = s.id
    LEFT JOIN lead_properties lp ON l.id = lp.lead_id
    LEFT JOIN lead_preferences lpref ON l.id = lpref.lead_id
    LEFT JOIN LATERAL (
      SELECT a.metadata->>'status' AS status,
             a.notes AS message,
             a.metadata->>'direction' AS direction,
             a.metadata->>'reaction' AS reaction,
             a.created_at
      FROM activities a
      WHERE a.lead_id = l.id AND a.type = 'whatsapp'
      ORDER BY a.created_at DESC
      LIMIT 1
    ) AS last_wa ON true
    LEFT JOIN LATERAL (
      SELECT a.id,
             a.scheduled_at AS schedule,
             a.title,
             a.metadata->>'meeting_type' AS meeting_type,
             a.metadata->>'meeting_link' AS meeting_link,
             a.metadata->>'meeting_host' AS meeting_host,
             a.metadata->>'duration' AS duration,
             a.notes
      FROM activities a
      WHERE a.lead_id = l.id 
        AND a.type = 'meeting' 
        AND a.scheduled_at IS NOT NULL 
        AND a.scheduled_at != ''
        AND a.scheduled_at::timestamp >= NOW()
        AND (a.outcome IS NULL OR a.outcome NOT IN ('concluded', 'completed'))
      ORDER BY a.scheduled_at ASC
      LIMIT 1
    ) AS next_mtg ON true
    WHERE l.tenant_id = $1 AND l.id = $2 AND l.deleted_at IS NULL
  `;
  
  const result = await pool.query(query, [tenantId, leadId]);
  return result.rows[0] || null;
}

async function findLeads(tenantId, { stageId, assigneeId, search, source, sortBy, sortDesc, page = 1, limit = 20, createdFrom, createdTo, scoreMin, scoreMax, intent, cursor }) {
  let query = `
    SELECT l.*,
           u.name AS assignee_name, u.avatar_url AS assignee_avatar,
           s.name AS stage_name, s.color AS stage_color,
           lp.builder AS builder_name, lp.possession_date, lp.house_status,
           lpref.interior_style, lpref.material AS material_preference,
           lpref.family_size, lpref.usage_patterns, lpref.storage_priorities,
           lpref.brand_flexibility, lpref.brand_remarks, lpref.existing_furniture,
           lpref.budget_category_allocation,
           ai.buying_intent, ai.sentiment,
           COALESCE(EXTRACT(DAY FROM CURRENT_TIMESTAMP - l.updated_at), 0) AS days_in_stage,
           0 AS follow_up_overdue_days,
           last_wa.status AS last_whatsapp_status,
           last_wa.message AS last_whatsapp_message,
           last_wa.direction AS last_whatsapp_direction,
           last_wa.reaction AS last_whatsapp_reaction,
           last_wa.created_at AS last_whatsapp_created_at,
           next_mtg.id AS next_meeting_id,
           next_mtg.schedule AS next_meeting_schedule,
           next_mtg.title AS next_meeting_title,
           next_mtg.meeting_type AS next_meeting_type,
           next_mtg.meeting_link AS next_meeting_link,
           next_mtg.meeting_host AS next_meeting_host,
           next_mtg.duration AS next_meeting_duration,
           next_mtg.notes AS next_meeting_notes
    FROM leads l
    LEFT JOIN users u ON l.assignee_id = u.id
    LEFT JOIN lead_stages s ON l.stage_id = s.id
    LEFT JOIN lead_properties lp ON l.id = lp.lead_id
    LEFT JOIN lead_preferences lpref ON l.id = lpref.lead_id
    LEFT JOIN lead_ai_insights ai ON l.id = ai.lead_id
    LEFT JOIN LATERAL (
      SELECT a.metadata->>'status' AS status,
             a.notes AS message,
             a.metadata->>'direction' AS direction,
             a.metadata->>'reaction' AS reaction,
             a.created_at
      FROM activities a
      WHERE a.lead_id = l.id AND a.type = 'whatsapp'
      ORDER BY a.created_at DESC
      LIMIT 1
    ) AS last_wa ON true
    LEFT JOIN LATERAL (
      SELECT a.id,
             a.scheduled_at AS schedule,
             a.title,
             a.metadata->>'meeting_type' AS meeting_type,
             a.metadata->>'meeting_link' AS meeting_link,
             a.metadata->>'meeting_host' AS meeting_host,
             a.metadata->>'duration' AS duration,
             a.notes
      FROM activities a
      WHERE a.lead_id = l.id 
        AND a.type = 'meeting' 
        AND a.scheduled_at IS NOT NULL 
        AND a.scheduled_at != ''
        AND a.scheduled_at::timestamp >= NOW()
        AND (a.outcome IS NULL OR a.outcome NOT IN ('concluded', 'completed'))
      ORDER BY a.scheduled_at ASC
      LIMIT 1
    ) AS next_mtg ON true
    WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
  `;
  
  const values = [tenantId];
  let paramIndex = 2;
  
  if (stageId) {
    query += ` AND l.stage_id = $${paramIndex++}`;
    values.push(stageId);
  }
  
  if (assigneeId) {
    query += ` AND l.assignee_id = $${paramIndex++}`;
    values.push(assigneeId);
  }
  
  if (source) {
    query += ` AND l.source = $${paramIndex++}`;
    values.push(source);
  }
  
  if (search) {
    query += ` AND (l.name ILIKE $${paramIndex} OR l.email ILIKE $${paramIndex} OR l.phone ILIKE $${paramIndex})`;
    values.push(`%${search}%`);
    paramIndex++;
  }

  if (createdFrom) {
    query += ` AND l.created_at >= $${paramIndex++}`;
    values.push(createdFrom);
  }
  if (createdTo) {
    query += ` AND l.created_at <= $${paramIndex++}`;
    values.push(createdTo);
  }
  if (scoreMin !== undefined && scoreMin !== null && scoreMin !== '') {
    query += ` AND l.score >= $${paramIndex++}`;
    values.push(parseInt(scoreMin, 10));
  }
  if (scoreMax !== undefined && scoreMax !== null && scoreMax !== '') {
    query += ` AND l.score <= $${paramIndex++}`;
    values.push(parseInt(scoreMax, 10));
  }
  if (intent && intent !== 'all') {
    query += ` AND ai.buying_intent = $${paramIndex++}`;
    values.push(intent);
  }

  const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_q`;
  const countResult = await pool.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count, 10);
  
  let orderField = 'l.created_at';
  if (sortBy === 'score') orderField = 'l.score';
  else if (sortBy === 'name') orderField = 'l.name';
  
  let orderDirection = sortDesc === 'false' || sortDesc === false ? 'ASC' : 'DESC';
  if (orderField === 'l.created_at') {
    orderDirection = 'DESC'; // ALWAYS newest first
  }

  if (cursor) {
    // Basic cursor implementation: assuming sort order is descending ID (or ascending ID)
    // For a robust implementation, cursor should encode the sort column value and the ID.
    // Here we use a simple id-based cursor.
    if (orderDirection === 'ASC') {
      query += ` AND l.id > $${paramIndex++}`;
    } else {
      query += ` AND l.id < $${paramIndex++}`;
    }
    values.push(cursor);
  }

  const offset = (page - 1) * limit;
  if (cursor) {
    query += ` ORDER BY ${orderField} ${orderDirection}, l.id ${orderDirection} LIMIT $${paramIndex}`;
    values.push(limit);
  } else {
    query += ` ORDER BY ${orderField} ${orderDirection}, l.id ${orderDirection} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);
  }
  
  const result = await pool.query(query, values);
  
  return {
    data: result.rows,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    nextCursor: result.rows.length > 0 ? result.rows[result.rows.length - 1].id : null
  };
}

async function updateLead(tenantId, leadId, updates) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Separate lead fields from property/preference fields
    const propertyFields = ['builder_name', 'possession_date', 'house_status', 'property_type', 'carpet_area_sqft'];
    const preferenceFields = [
      'interior_style', 'material_preference', 'family_size', 'usage_patterns',
      'storage_priorities', 'brand_flexibility', 'brand_remarks', 'existing_furniture',
      'budget_category_allocation'
    ];
    
    const leadUpdates = {};
    const propUpdates = {};
    const prefUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (propertyFields.includes(key)) {
        if (key === 'builder_name') propUpdates['builder'] = value;
        else if (key === 'carpet_area_sqft') propUpdates['carpet_area'] = value;
        else propUpdates[key] = value;
      } else if (preferenceFields.includes(key)) {
        if (key === 'material_preference') prefUpdates['material'] = value;
        else if (key === 'budget_category_allocation' && typeof value === 'object' && value !== null) prefUpdates[key] = JSON.stringify(value);
        else prefUpdates[key] = value;
      } else {
        leadUpdates[key] = value;
      }
    }
    
    // 1. Update Core Lead Table
    if (Object.keys(leadUpdates).length > 0) {
      const fields = [];
      const values = [];
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(leadUpdates)) {
        if (key === 'id' || key === 'tenant_id' || key === 'created_at' || key === 'updated_at' || key === 'deleted_at') {
          continue;
        }
        fields.push(`${key} = $${paramIndex++}`);
        if (['custom_fields', 'lifestyle_preferences', 'additional_contacts', 'ai_score_breakdown'].includes(key) && typeof value === 'object') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
      
      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        
        const query = `
          UPDATE leads
          SET ${fields.join(', ')}
          WHERE tenant_id = $${paramIndex++} AND id = $${paramIndex} AND deleted_at IS NULL
        `;
        values.push(tenantId, leadId);
        await client.query(query, values);
      }

      if (leadUpdates.stage_id !== undefined) {
         // Insert into timeline
         await client.query(`
           INSERT INTO lead_timeline (tenant_id, lead_id, event_type, summary)
           VALUES ($1, $2, 'stage.changed', $3)
         `, [tenantId, leadId, `Stage changed to ${leadUpdates.stage_id}`]);
      }
    }

    // 2. Update Properties
    if (Object.keys(propUpdates).length > 0) {
      const propKeys = Object.keys(propUpdates).map(k => k.replace(/[^a-zA-Z0-9_]/g, ''));
      const propSet = propKeys.map((key, idx) => `${key} = $${idx + 3}`).join(', ');
      const propValues = Object.values(propUpdates);
      
      // Upsert: Create if it doesn't exist
      const propInsertCols = ['tenant_id', 'lead_id', ...propKeys].join(', ');
      const propInsertVals = ['$1', '$2', ...Object.values(propUpdates).map((_, idx) => `$${idx + 3}`)].join(', ');
      
      // Unfortunately we can't easily ON CONFLICT DO UPDATE here if lead_id isn't marked UNIQUE. Let's just do standard UPSERT pattern manually.
      const existingProp = await client.query('SELECT id FROM lead_properties WHERE lead_id = $1 AND tenant_id = $2', [leadId, tenantId]);
      if (existingProp.rows.length > 0) {
         await client.query(`UPDATE lead_properties SET ${propSet}, updated_at = NOW() WHERE lead_id = $1 AND tenant_id = $2`, [leadId, tenantId, ...propValues]);
      } else {
         await client.query(`INSERT INTO lead_properties (${propInsertCols}) VALUES (${propInsertVals})`, [tenantId, leadId, ...propValues]);
      }
    }

    // 3. Update Preferences
    if (Object.keys(prefUpdates).length > 0) {
      const prefKeys = Object.keys(prefUpdates).map(k => k.replace(/[^a-zA-Z0-9_]/g, ''));
      const prefSet = prefKeys.map((key, idx) => `${key} = $${idx + 3}`).join(', ');
      const prefValues = Object.values(prefUpdates);
      
      const existingPref = await client.query('SELECT id FROM lead_preferences WHERE lead_id = $1 AND tenant_id = $2', [leadId, tenantId]);
      if (existingPref.rows.length > 0) {
         await client.query(`UPDATE lead_preferences SET ${prefSet}, updated_at = NOW() WHERE lead_id = $1 AND tenant_id = $2`, [leadId, tenantId, ...prefValues]);
      } else {
         const prefInsertCols = ['tenant_id', 'lead_id', ...prefKeys].join(', ');
         const prefInsertVals = ['$1', '$2', ...Object.values(prefUpdates).map((_, idx) => `$${idx + 3}`)].join(', ');
         await client.query(`INSERT INTO lead_preferences (${prefInsertCols}) VALUES (${prefInsertVals})`, [tenantId, leadId, ...prefValues]);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  
  return findLeadById(tenantId, leadId);
}

async function softDeleteLead(tenantId, leadId) {
  const query = `
    UPDATE leads
    SET deleted_at = NOW()
    WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
  `;
  await pool.query(query, [tenantId, leadId]);
}

async function convertLeadToProject(tenantId, leadId, projectId) {
  const query = `
    UPDATE leads
    SET converted_to_project_id = $1, status = 'converted', updated_at = NOW()
    WHERE tenant_id = $2 AND id = $3 AND deleted_at IS NULL
  `;
  await pool.query(query, [projectId, tenantId, leadId]);
}

async function completeLeadConversion(tenantId, leadId, newProjectId, lead, projectName, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const convertedStageRes = await client.query(
      `SELECT id FROM lead_stages WHERE tenant_id = $1 AND (is_won = true) ORDER BY sort_order DESC LIMIT 1`,
      [tenantId]
    );
    const convertedStageId = convertedStageRes.rows.length > 0 ? convertedStageRes.rows[0].id : lead.stage_id;

    await client.query(
      `UPDATE leads 
       SET status = 'converted', 
           converted_to_project_id = $1, 
           stage_id = $2,
           stage_updated_at = NOW(),
           updated_at = NOW() 
       WHERE id = $3`,
      [newProjectId, convertedStageId, leadId]
    );

    const estimatesRes = await client.query(
      `SELECT * FROM lead_estimates WHERE tenant_id = $1 AND lead_id = $2 ORDER BY created_at ASC`,
      [tenantId, leadId]
    );
    if (estimatesRes.rows.length > 0) {
      for (const est of estimatesRes.rows) {
        await client.query(
          `UPDATE lead_estimates SET project_id = $1, updated_at = NOW() WHERE id = $2`,
          [newProjectId, est.id]
        );
        const existingQuote = await client.query(
          `SELECT id FROM quotations WHERE tenant_id = $1 AND lead_id = $2 AND project_id = $3 LIMIT 1`,
          [tenantId, leadId, newProjectId]
        );
        if (existingQuote.rows.length === 0) {
          const qNum = est.estimator_reference_id || `QT-${Date.now().toString().slice(-6)}`;
          const insertQuoteRes = await client.query(
            `INSERT INTO quotations (tenant_id, lead_id, project_id, total_amount, subtotal, status, created_by, notes, quotation_number)
             VALUES ($1, $2, $3, $4, $4, 'draft', $5, $6, $7)
             RETURNING id`,
            [tenantId, leadId, newProjectId, est.total_amount || 0, userId, `Migrated from lead estimate on conversion. Estimator Ref: ${est.estimator_reference_id || 'N/A'}`, qNum]
          );
          const quotationId = insertQuoteRes.rows[0].id;

          const payload = est.payload || {};
          if (Array.isArray(payload.rooms)) {
            let sortOrder = 0;
            for (const room of payload.rooms) {
              if (Array.isArray(room.items)) {
                for (const item of room.items) {
                  await client.query(
                    `INSERT INTO quotation_items 
                     (tenant_id, quotation_id, room_or_area, item_name, description, quantity, unit_price, sort_order, item_key)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, gen_random_uuid())`,
                    [
                      tenantId,
                      quotationId,
                      room.name || 'General',
                      (item.description || 'BOQ Item').substring(0, 255),
                      item.description || '',
                      parseFloat(item.qty || 1),
                      parseFloat(item.rate || 0),
                      sortOrder++
                    ]
                  );
                }
              }
            }
          }
        }
      }
    }

    await client.query(
      `INSERT INTO lead_timeline (tenant_id, lead_id, event_type, summary) VALUES ($1, $2, 'lead.converted', $3)`,
      [tenantId, leadId, `Lead converted to project "${projectName}" (ID: ${newProjectId}). ${estimatesRes.rows.length} estimate(s) transferred.`]
    );

    await eventBus.emit('lead.converted', {
      leadId,
      projectId: newProjectId,
      userId,
      tenantId,
      message: `Lead converted to project "${projectName}" (ID: ${newProjectId}). ${estimatesRes.rows.length} estimate(s) transferred.`
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getLeadStats(tenantId, assigneeId = null) {
  let query = `
    SELECT
      COUNT(*) AS total_leads,
      COUNT(*) FILTER (
        WHERE s.is_won = true 
        AND (l.updated_at >= date_trunc('month', CURRENT_DATE) OR l.created_at >= date_trunc('month', CURRENT_DATE))
      ) AS won_this_month,
      COUNT(*) FILTER (WHERE s.is_won = true) AS total_won,
      AVG(NULLIF(l.score, 0)) AS avg_score
    FROM leads l
    LEFT JOIN lead_stages s ON l.stage_id = s.id
    WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
  `;
  const values = [tenantId];
  if (assigneeId) {
    query += ` AND l.assignee_id = $2`;
    values.push(assigneeId);
  }
  const result = await pool.query(query, values);
  const row = result.rows[0];
  
  const totalLeads = parseInt(row.total_leads, 10) || 0;
  const totalWon = parseInt(row.total_won, 10) || 0;
  const avgScore = Math.round(parseFloat(row.avg_score)) || 0;
  const convPct = totalLeads > 0 ? Math.round((totalWon / totalLeads) * 100) : 0;

  return {
    total: totalLeads,
    wonThisMonth: parseInt(row.won_this_month, 10) || 0,
    avgScore,
    convPct
  };
}

async function getLeadTimeline(tenantId, leadId, { type, page = 1, limit = 20 } = {}) {
  let timelineQuery = `
    SELECT lt.id::text, lt.event_type, lt.summary, lt.created_at, u.name AS user_name, u.avatar_url AS user_avatar
    FROM lead_timeline lt
    LEFT JOIN users u ON lt.user_id = u.id
    WHERE lt.tenant_id = $1 AND lt.lead_id = $2
  `;
  
  let automationQuery = `
    SELECT ae.id::text, 'automation.' || ae.workflow AS event_type, 'Executed action: ' || ae.action_type || ' (' || ae.status || ')' AS summary, ae.created_at, 'System Automation' AS user_name, NULL AS user_avatar
    FROM automation_events ae
    WHERE ae.tenant_id = $1 AND ae.lead_id = $2
  `;

  const values = [tenantId, leadId];
  let paramIndex = 3;

  if (type && type !== 'all') {
    if (type === 'system') {
      timelineQuery += ` AND lt.event_type NOT LIKE 'activity.%'`;
      // automation events are always system
    } else {
      timelineQuery += ` AND lt.event_type = $${paramIndex}`;
      automationQuery += ` AND ('automation.' || ae.workflow) = $${paramIndex}`;
      values.push(`activity.${type}`);
      paramIndex++;
    }
  } else if (type === 'system') {
    timelineQuery += ` AND lt.event_type NOT LIKE 'activity.%'`;
  }

  let query = `SELECT * FROM (${timelineQuery} UNION ALL ${automationQuery}) as combined`;

  const countQuery = `SELECT COUNT(*) FROM (${query}) as t`;
  const countResult = await pool.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (page - 1) * limit;
  query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  values.push(limit, offset);

  const result = await pool.query(query, values);

  // Map fields to match what frontend ActivityTimeline expects
  const mappedData = result.rows.map(row => {
    let activityType = row.event_type;
    let isSystem = true;
    
    // Parse 'activity.site_visit' to 'site_visit'
    if (activityType.startsWith('activity.')) {
      activityType = activityType.split('.')[1];
      isSystem = false;
    }
    
    return {
      id: row.id,
      type: activityType,
      title: row.event_type,
      notes: row.summary,
      user_name: row.user_name,
      user_avatar: row.user_avatar,
      created_at: row.created_at,
      isSystem: isSystem
    };
  });

  return {
    data: mappedData,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10)
  };
}

async function getPipelineSummary(tenantId) {
  const result = await pool.query('SELECT * FROM pipeline_summary WHERE tenant_id = $1', [tenantId]);
  return result.rows;
}

async function refreshPipelineSummary() {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY pipeline_summary');
  } catch (err) {
    console.error('Failed to refresh pipeline_summary', err);
  }
}

module.exports = {
  createLead,
  findLeadById,
  findLeads,
  updateLead,
  softDeleteLead,
  convertLeadToProject,
  completeLeadConversion,
  getLeadStats,
  getLeadTimeline,
  refreshPipelineSummary,
  getPipelineSummary
};
