/* global logActivitySchema, createLeadSchema, createLead, findLeads, estimator_reference_id, status, total_amount, pdf_url, payload, updateLead, leadRepository, aiService, activityService */
const pool = require('../db/pool');
const { success, fail, paginate } = require('../utils/response');
const { changeStage } = require('../services/leads/changeStage');
const { _z } = require('zod');
const { logActivity, listActivities, updateActivity } = require('../services/activities/activityService');




function getTenantAndUser(req) {
  return {
    tenantId: req.tenantId || (req.user && req.user.tenantId),
    userId: req.userId || (req.user && req.user.id)
  };
}

exports.changeStageHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { stageId } = req.body;
    if (!stageId) return fail(res, 'VALIDATION_ERROR', 'stageId is required', 400);
    const updatedLead = await changeStage({ tenantId, userId, leadId, newStageId: stageId });
    return success(res, updatedLead);
  } catch (error) {
    if (error.code === 'STAGE_GATE_FAILED') return res.status(422).json({ success: false, error: { code: 'STAGE_GATE_FAILED', message: 'Missing mandatory fields', missing: error.missing } });
    next(error);
  }
};

exports.convertToProjectHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { 
      projectName, projectType, clientName, clientPhone, clientEmail, pm, contractValue 
    } = req.body;

    // 1. Get the lead
    const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadRes.rows.length === 0) return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    const lead = leadRes.rows[0];

    // L-070: Duplicate conversion guard — reject if lead is already converted
    if (lead.status === 'converted' && lead.converted_to_project_id) {
      return fail(
        res,
        'CONFLICT',
        `This lead has already been converted to project ${lead.converted_to_project_id}.`,
        409,
        { existingProjectId: lead.converted_to_project_id }
      );
    }

    // Get tenant config for dynamic checklist validation
    const tenantRes = await pool.query('SELECT config FROM tenants WHERE id = $1', [tenantId]);
    const configStr = tenantRes.rows[0]?.config;
    const config = typeof configStr === 'string' ? JSON.parse(configStr || '{}') : (configStr || {});
    const checklistConfig = config.pre_conversion_checklist || [
      { key: 'contract_signed', label: 'Contract signed', required: true, active: true },
      { key: 'booking_received', label: 'Booking amount received', required: true, active: true },
      { key: 'scope_finalized', label: 'Scope frozen', required: true, active: true },
      { key: 'site_visit_completed', label: 'Site visit completed', required: true, active: true },
      { key: 'floor_plan', label: 'Floor plan attached', required: false, active: true },
      { key: 'site_address_confirmed', label: 'Site address confirmed', required: false, active: true }
    ];

    // Validate active and required checklist items
    const missingFields = [];
    for (const item of checklistConfig) {
      if (item.active && item.required && !req.body[item.key]) {
        missingFields.push(item.key);
      }
    }
    if (!projectName || !projectName.trim()) missingFields.push('projectName');
    if (!projectType) missingFields.push('projectType');
    if (!req.body.contract_file_key) missingFields.push('contract_file_key');
    if (!req.body.contract_file_name) missingFields.push('contract_file_name');
    if (!req.body.contract_file_size) missingFields.push('contract_file_size');
    if (!req.body.contract_file_mime) missingFields.push('contract_file_mime');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Missing required fields: ${missingFields.join(', ')}`,
          missingFields
        }
      });
    }

    // 2. Create project using the service to ensure all fields and automations are triggered
    const { createProject } = require('../services/projects/createProject');
    
    // Dynamically build the checklist entries for custom_fields
    const dynamicChecklist = {};
    for (const item of checklistConfig) {
      dynamicChecklist[item.key] = !!req.body[item.key];
    }

    const newProject = await createProject({
      tenantId,
      userId,
      data: {
        lead_id: leadId,
        name: projectName,
        project_type: projectType,
        client_name: clientName || lead.name,
        client_phone: clientPhone || lead.phone,
        client_email: clientEmail || lead.email,
        pm_id: pm,
        designer_id: req.body.designer,
        contract_value: contractValue || lead.budget_max || 0,
        booking_amount: req.body.advanceAmount || 0,
        start_date: req.body.startDate,
        target_date: req.body.handoverDate,
        contract_file_key: req.body.contract_file_key,
        contract_file_name: req.body.contract_file_name,
        contract_file_size: Number(req.body.contract_file_size) || 0,
        contract_file_mime: req.body.contract_file_mime,
        agreement_signed_by: req.body.agreement_signed_by,
        agreement_signed_at: req.body.agreement_signed_at,
        agreement_signature_method: req.body.agreement_signature_method,
        payment_terms: req.body.paymentTerms,
        flat_number: req.body.flat_number,
        floor: req.body.floor,
        building_name: req.body.building_name,
        street: req.body.street,
        city: req.body.city,
        pincode: req.body.pincode,
        landmark: req.body.landmark,
        latitude: req.body.latitude !== undefined && req.body.latitude !== null ? Number(req.body.latitude) : null,
        longitude: req.body.longitude !== undefined && req.body.longitude !== null ? Number(req.body.longitude) : null,
        builder_name: req.body.builder_name,
        society_name: req.body.society_name,
        rera_id: req.body.rera_id,
        noc_status: req.body.noc_status,
        occupancy_certificate_status: req.body.occupancy_certificate_status,
        property_handover_date: req.body.property_handover_date,
        contacts: req.body.contacts,
        carpet_area: req.body.carpet_area !== undefined && req.body.carpet_area !== null ? Number(req.body.carpet_area) : null,
        built_up_area: req.body.built_up_area !== undefined && req.body.built_up_area !== null ? Number(req.body.built_up_area) : null,
        number_of_rooms: req.body.number_of_rooms !== undefined && req.body.number_of_rooms !== null ? Number(req.body.number_of_rooms) : null,
        project_category: req.body.project_category || null,
        project_sub_category: req.body.project_sub_category || null,
        property_type: req.body.property_type || null,
        property_age: req.body.property_age || null,
        renovation_scope: req.body.renovation_scope || null,
        segment: req.body.segment || null,
        measurements: req.body.measurements,
        vendors: req.body.vendors,
        consultants: req.body.consultants,
        custom_fields: {
          advance_amount: req.body.advanceAmount,
          payment_terms: req.body.paymentTerms,
          ...dynamicChecklist
        }
      }
    });
    
    const newProjectId = newProject.id;

    // 3-5: Mark lead as converted, transfer estimates to project, and log timeline using Repository method
    const { completeLeadConversion } = require('../repositories/leadRepository');
    await completeLeadConversion(tenantId, leadId, newProjectId, lead, projectName, userId);

    return success(res, { project_id: newProjectId, message: 'Project created successfully' }, {}, 201);
  } catch (error) {
    next(error);
  }
};

exports.logActivityHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    // req.body is already validated by middleware
    const activityData = req.body;
    const { summarizeActivity, generateTasksFromActivity, analyzeLeadIntelligence } = require('../services/aiService');
    
    try {
      activityData.ai_summary = await summarizeActivity(activityData.notes);
      
      const suggestedTasks = await generateTasksFromActivity(activityData.notes, activityData.type);
      if (suggestedTasks && suggestedTasks.length > 0) {
        activityData.metadata = activityData.metadata || {};
        activityData.metadata.suggested_tasks = suggestedTasks;
      }
      
      setTimeout(async () => {
        try {
          const { findLeadById } = require('../repositories/leadRepository');
          const { listActivities } = require('../services/activities/activityService');
          
          const lead = await findLeadById(tenantId, leadId);
          if (!lead) return;
          
          const { data: acts } = await listActivities({ tenantId, leadId, limit: 10 });
          const intel = await analyzeLeadIntelligence(lead, acts, [], lead.custom_fields || {});
          
          const newCustomFields = {
            ...(typeof lead.custom_fields === 'object' ? lead.custom_fields : {}),
            ai_recommendation: {
              recommendedAction: intel.nextAction,
              reason: 'Based on recent activity.',
              sentiment: intel.sentiment,
              intent: intel.buyIntent,
              objections: intel.objections,
              signals: intel.signals
            }
          };

          await pool.query(`
            UPDATE leads 
            SET score = $1, 
                win_probability = $2, 
                ai_score_breakdown = $3,
                custom_fields = $4::jsonb,
                updated_at = NOW()
            WHERE id = $5 AND tenant_id = $6
          `, [
            intel.winProbability, 
            intel.winProbability, 
            JSON.stringify(intel.aiScoreBreakdown || {}),
            JSON.stringify(newCustomFields),
            leadId,
            tenantId
          ]);

          await pool.query(`
            INSERT INTO lead_scores_history (tenant_id, lead_id, overall_score, calculated_by, calculated_at)
            VALUES ($1, $2, $3, $4, NOW())
          `, [tenantId, leadId, intel.winProbability, userId]);

          console.log(`[AI] Updated Decision Intelligence for lead ${leadId}`);
        } catch(e) {
          console.error('[AI] Failed to update decision intelligence', e);
        }
      }, 0);
    } catch (e) {
      console.error('AI Processing error in logActivity:', e);
    }

    const activity = await logActivity({ tenantId, userId, leadId, ...activityData });
    return success(res, activity, {}, 201);
  } catch (error) {
    if (error.message.includes('INVALID_ACTIVITY_TYPE')) return fail(res, 'VALIDATION_ERROR', error.message, 400);
    next(error);
  }
};

exports.getActivitiesHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { type, page, limit } = req.query;

    const result = await listActivities({
      tenantId,
      leadId,
      type,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20
    });
    return paginate(res, result.data, result.total, result.page, result.limit);
  } catch (error) {
    next(error);
  }
};

exports.updateActivityHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const activityId = req.params.aid;

    const parsed = logActivitySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues);
    }

    const { title, notes, outcome, scheduledAt, metadata } = parsed.data;

    const actRes = await pool.query(
      'SELECT * FROM activities WHERE id = $1 AND lead_id = $2 AND tenant_id = $3',
      [activityId, leadId, tenantId]
    );

    if (actRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Activity not found', 404);
    }

    const currentActivity = actRes.rows[0];
    const VALID_TYPES = ['call', 'note', 'email', 'whatsapp', 'site_visit', 'meeting'];
    if (!VALID_TYPES.includes(currentActivity.type)) {
      return fail(res, 'FORBIDDEN', 'System generated logs cannot be edited.', 403);
    }

    const updated = await updateActivity({
      tenantId,
      activityId,
      leadId,
      title,
      notes,
      outcome,
      scheduledAt,
      metadata
    });

    return success(res, updated);
  } catch (error) {
    next(error);
  }
};


exports.checkDuplicateHandler = async (req, res, next) => {
  try {
    const { phone, email, name } = req.query;
    if (!phone && !email && !name) {
      return res.status(400).json({ success: false, error: { message: 'phone, email, or name query parameter is required' } });
    }
    
    let tenantId;
    try {
      tenantId = getTenantAndUser(req).tenantId;
    } catch(e) {
       const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
       if (tenantRes.rows.length > 0) tenantId = tenantRes.rows[0].id;
    }

    if (!tenantId) {
       return res.status(500).json({ success: false, error: { message: 'No tenant context' } });
    }

    const conditions = ['tenant_id = $1', 'deleted_at IS NULL'];
    const values = [tenantId];
    let matchIdx = 2;
    
    const matchClauses = [];
    if (phone) {
      matchClauses.push(`phone = $${matchIdx++}`);
      values.push(phone);
    }
    if (email) {
      matchClauses.push(`LOWER(email) = LOWER($${matchIdx++})`);
      values.push(email);
    }
    if (name) {
      // Fuzzy name matching using substring
      matchClauses.push(`LOWER(name) LIKE '%' || LOWER($${matchIdx++}) || '%'`);
      values.push(name);
    }
    
    if (matchClauses.length > 0) {
      conditions.push('(' + matchClauses.join(' OR ') + ')');
    }

    const query = `
      SELECT id, stage_id as stage, assignee_id as assigned_to, name, phone, email
      FROM leads 
      WHERE ${conditions.join(' AND ')}
      LIMIT 5
    `;

    const result = await pool.query(query, values);

    if (result.rows.length > 0) {
      const { maskSensitiveFields } = require('../utils/fieldMasker');
      const userPermissions = req.user && req.user.role === 'superadmin' ? ['*'] : (req.user && req.user.permissions ? req.user.permissions : []);
      const LEAD_FIELD_PERMISSIONS = {
        phone: 'leads:read_sensitive',
        email: 'leads:read_sensitive',
        budget: 'leads:read_sensitive',
        budget_max: 'leads:read_sensitive'
      };
      const maskedMatches = maskSensitiveFields(result.rows, userPermissions, LEAD_FIELD_PERMISSIONS);
      return res.json({ success: true, data: { exists: true, matches: maskedMatches } });
    }

    return res.json({ success: true, data: { exists: false } });
  } catch (error) {
    next(error);
  }
};

exports.createPublicLeadHandler = async (req, res, next) => {
  console.log('--- Incoming createPublicLead Request ---', req.body);
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('Public Lead Validation Error:', JSON.stringify(parsed.error.issues, null, 2));
      return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues);
    }
    
    // Use first tenant if no auth context
    let tenantId;
    try {
      tenantId = getTenantAndUser(req).tenantId;
    } catch(e) {
       const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
       if (tenantRes.rows.length > 0) tenantId = tenantRes.rows[0].id;
    }

    if (!tenantId) {
      return fail(res, 'SYSTEM_ERROR', 'No tenant context', 500);
    }

    // Lead capturing system sets userId to null representing public system
    const lead = await createLead({ tenantId, userId: null, data: parsed.data });

    // Optionally retrieve the assigned rep's info for the "Thank You" screen
    let repInfo = null;
    if (lead.assigned_rep_id) {
       const repRes = await pool.query('SELECT name, avatar_url as photo FROM users WHERE id = $1', [lead.assigned_rep_id]);
       if (repRes.rows.length > 0) {
          repInfo = repRes.rows[0];
       }
    }

    return success(res, { lead, rep: repInfo }, {}, 201);
  } catch (error) {
    console.error('Public Lead Creation Error Details:', error);
    if (error.message && (error.message.includes('VALIDATION_ERROR') || error.message === 'INVALID_STAGE')) {
      return fail(res, 'VALIDATION_ERROR', error.message, 400);
    }
    next(error);
  }
};

exports.exportLeadsHandler = async function exportLeadsHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const params = { ...req.query, limit: 10000, page: 1 };
    const result = await findLeads(tenantId, params);

    const _allowedFields = [
      'name', 'phone', 'email', 'source', 'status', 'assignee_id', 'stage_id',
      'priority', 'notes', 'custom_fields', 'value', 'expected_close_date',
      'score', 'project_type', 'scope', 'budget_max', 'budget_min', 'locality', 'carpet_area_sqft', 'city', 'dnc_flag', 'consent_whatsapp', 'competitor_mentioned', 'latitude', 'longitude'
    ];
    const fields = [
      'name', 'phone', 'email', 'source', 'stage_name', 'assignee_name', 'score', 'notes', 'created_at',
      'win_probability', 'budget', 'address', 'lost_reason', 'follow_up_date'
    ];
    const header = fields.join(',');
    const rows = result.data.map(lead => {
      const customFields = typeof lead.custom_fields === 'string' ? JSON.parse(lead.custom_fields || '{}') : (lead.custom_fields || {});
      return fields.map(f => {
        let val = lead[f];
        if (val === undefined || val === null) {
          // Check standard mappings or custom_fields
          if (f === 'budget') val = lead.budget_max || customFields.budget || '';
          else if (f === 'address') val = lead.locality || customFields.address || '';
          else val = customFields[f] ?? '';
        }
        val = val ?? '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(',');
    });

    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csv);
  } catch (err) {
    console.error('exportLeadsHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Export failed' } });
  }
};

exports.importLeadsHandler = async function importLeadsHandler(req, res) {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const csvText = req.body.csv || '';
    if (!csvText) return res.status(400).json({ success: false, error: { message: 'No CSV data provided' } });

    const parseCSV = (text) => {
      const rows = [];
      let currentRow = [];
      let currentVal = '';
      let inQuotes = false;
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            currentVal += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          currentRow.push(currentVal);
          currentVal = '';
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
          if (char === '\r') i++; // skip \n
          currentRow.push(currentVal);
          rows.push(currentRow);
          currentRow = [];
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      if (currentVal || currentRow.length > 0) {
        currentRow.push(currentVal);
        rows.push(currentRow);
      }
      return rows.map(r => r.map(c => c.trim().replace(/^"|"$/g, '')));
    };

    const rows = parseCSV(csvText.trim());
    if (rows.length < 2) return res.status(400).json({ success: false, error: { message: 'Invalid or empty CSV' } });

    const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'));

    const results = { created: 0, skipped: 0, errors: [] };
    const { createLead: createLeadService } = require('../services/leads/createLead');
    const pool = require('../db/pool');
    const txClient = await pool.connect();

    try {
      await txClient.query('BEGIN');

      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (!cols || cols.length === 0 || (cols.length === 1 && !cols[0])) continue;
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });

        if (!row.name || !row.phone) {
          results.errors.push({ row: i + 1, error: 'Missing name or phone' });
          results.skipped++;
          continue;
        }

        try {
          await createLeadService({ tenantId, userId, data: row, txClient, skipSideEffects: true });
          results.created++;
        } catch (err) {
          results.errors.push({ row: i + 1, error: err.message });
          results.skipped++;
        }
      }

      if (results.errors.length > 0) {
        await txClient.query('ROLLBACK');
        results.created = 0; // Everything rolled back
      } else {
        await txClient.query('COMMIT');
      }

      res.json({ success: true, data: results });
    } catch (err) {
      await txClient.query('ROLLBACK');
      throw err;
    } finally {
      txClient.release();
    }
  } catch (err) {
    console.error('importLeadsHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Import failed' } });
  }
};

exports.uploadFileHandler = async function uploadFileHandler(req, res) {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const { id: leadId } = req.params;

    if (!req.file) return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });

    // 1. Per-file limit (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ success: false, error: { message: 'File size exceeds the 10MB limit.' } });
    }

    // 2. Per-lead total limit (50MB)
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
    const sizeRes = await pool.query(
      'SELECT COALESCE(SUM(file_size), 0) as total_size FROM lead_files WHERE lead_id = $1 AND tenant_id = $2',
      [leadId, tenantId]
    );
    const currentTotalSize = parseInt(sizeRes.rows[0].total_size, 10);
    if (currentTotalSize + req.file.size > MAX_TOTAL_SIZE) {
      return res.status(400).json({ success: false, error: { message: `Upload rejected: The 50MB total storage limit for this lead would be exceeded. Current usage: ${(currentTotalSize / (1024 * 1024)).toFixed(1)}MB.` } });
    }

    // Validate MIME type and Magic Number
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid file type. Only JPEG, PNG, and PDF are allowed.' } });
    }

    const hex = req.file.buffer.subarray(0, 4).toString('hex').toUpperCase();
    let magicValid = false;
    if (req.file.mimetype === 'application/pdf' && hex.startsWith('25504446')) magicValid = true;
    else if ((req.file.mimetype === 'image/jpeg' || req.file.mimetype === 'image/jpg') && hex.startsWith('FFD8FF')) magicValid = true;
    else if (req.file.mimetype === 'image/png' && hex.startsWith('89504E47')) magicValid = true;

    if (!magicValid) {
      return res.status(400).json({ success: false, error: { message: 'File contents do not match the declared MIME type or file is corrupted.' } });
    }

    const storage = require('../utils/storage');
    // Generate a unique S3 key
    const storageKey = `tenant-${tenantId}/leads/${leadId}/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
    
    // Upload the raw buffer to S3 / Local storage
    await storage.uploadBuffer(storageKey, req.file.buffer, req.file.mimetype);

    const result = await pool.query(
      `INSERT INTO lead_files (tenant_id, lead_id, uploaded_by, file_name, file_size, mime_type, storage_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, file_name, file_size, mime_type, created_at`,
      [tenantId, leadId, userId, req.file.originalname, req.file.size, req.file.mimetype, storageKey]
    );

    const eventBus = require('../utils/eventBus');
    eventBus.emit('lead.file_uploaded', { tenantId, userId, leadId, file: result.rows[0] });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('uploadFileHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Upload failed' } });
  }
};

exports.getFilesHandler = async function getFilesHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const storage = require('../utils/storage');

    const result = await pool.query(
      `SELECT f.id, f.file_name, f.file_size, f.mime_type, f.storage_key, f.created_at, u.name AS uploaded_by_name
       FROM lead_files f LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.tenant_id = $1 AND f.lead_id = $2
       ORDER BY f.created_at DESC`,
      [tenantId, leadId]
    );

    const files = await Promise.all(result.rows.map(async (f) => {
      // Keep backwards compatibility for legacy base64 strings
      if (f.storage_key && f.storage_key.startsWith('data:')) {
        f.download_url = f.storage_key;
      } else if (f.storage_key) {
        f.download_url = await storage.getDownloadUrl(f.storage_key);
      }
      return f;
    }));

    res.json({ success: true, data: files });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch files' } });
  }
};

exports.deleteFileHandler = async function deleteFileHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, fileId } = req.params;
    const storage = require('../utils/storage');

    const fileRes = await pool.query(
      'SELECT storage_key FROM lead_files WHERE id = $1 AND lead_id = $2 AND tenant_id = $3',
      [fileId, leadId, tenantId]
    );
    
    if (fileRes.rows.length > 0) {
      const { storage_key } = fileRes.rows[0];
      if (storage_key && !storage_key.startsWith('data:')) {
        await storage.deleteFile(storage_key);
      }
    }

    await pool.query(
      'DELETE FROM lead_files WHERE id = $1 AND lead_id = $2 AND tenant_id = $3',
      [fileId, leadId, tenantId]
    );
    
    res.json({ success: true, data: { deleted: fileId } });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Delete failed' } });
  }
};

const { parseDocument } = require('../services/aiService');

exports.parseFileHandler = async function parseFileHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, fileId } = req.params;

    // fetch file from db
    const fileRes = await pool.query(
      'SELECT storage_key, mime_type FROM lead_files WHERE id = $1 AND lead_id = $2 AND tenant_id = $3',
      [fileId, leadId, tenantId]
    );

    if (fileRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'File not found' } });
    }

    const file = fileRes.rows[0];
    
    // Parse using Gemini
    const extractedData = await parseDocument(file.storage_key, file.mime_type);

    res.json({ success: true, data: extractedData });
  } catch (err) {
    console.error('parseFileHandler error:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Failed to parse file' } });
  }
};

exports.getFollowupsHandler = async function getFollowupsHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const result = await pool.query(
      `SELECT f.*, u.name AS assignee_name FROM lead_followups f
       LEFT JOIN users u ON f.assignee_id = u.id
       WHERE f.tenant_id = $1 AND f.lead_id = $2
       ORDER BY f.due_at ASC`,
      [tenantId, leadId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch follow-ups' } });
  }
};

exports.createFollowupHandler = async function createFollowupHandler(req, res) {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const { title, due_at, assignee_id, notes } = req.body;
    if (!title || !due_at) return res.status(400).json({ success: false, error: { message: 'title and due_at required' } });

    const result = await pool.query(
      `INSERT INTO lead_followups (tenant_id, lead_id, created_by, assignee_id, title, due_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, leadId, userId, assignee_id || userId, title, due_at, notes || null]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('createFollowupHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to create follow-up' } });
  }
};

exports.updateFollowupHandler = async function updateFollowupHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, fid } = req.params;
    const { is_done, title, due_at, notes } = req.body;
    const result = await pool.query(
      `UPDATE lead_followups SET
        is_done = COALESCE($1, is_done),
        done_at = CASE WHEN $1 = true THEN NOW() ELSE done_at END,
        title = COALESCE($2, title),
        due_at = COALESCE($3, due_at),
        notes = COALESCE($4, notes)
       WHERE id = $5 AND lead_id = $6 AND tenant_id = $7
       RETURNING *`,
      [is_done ?? null, title || null, due_at || null, notes || null, fid, leadId, tenantId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { message: 'Follow-up not found' } });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to update follow-up' } });
  }
};

exports.deleteFollowupHandler = async function deleteFollowupHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, fid } = req.params;
    await pool.query('DELETE FROM lead_followups WHERE id = $1 AND lead_id = $2 AND tenant_id = $3', [fid, leadId, tenantId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to delete follow-up' } });
  }
};

const { sendLeadToEstimator } = require('../services/estimatorService');

exports.sendToEstimatorHandler = async function sendToEstimatorHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;

    const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadRes.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    
    const lead = leadRes.rows[0];
    const estRes = await sendLeadToEstimator(lead);

    if (estRes.success && estRes.estimator_reference_id) {
      await pool.query(
        `INSERT INTO lead_estimates (tenant_id, lead_id, estimator_reference_id, status) VALUES ($1, $2, $3, 'draft')`,
        [tenantId, leadId, estRes.estimator_reference_id]
      );
    }

    // If simulated or successful, we can log it
    res.json({ success: true, data: estRes });
  } catch (err) {
    console.error('sendToEstimatorHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to send to estimator' } });
  }
};

exports.getEstimatesHandler = async function getEstimatesHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;

    const result = await pool.query(
      'SELECT * FROM lead_estimates WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
      [leadId, tenantId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getEstimatesHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch estimates' } });
  }
};

exports.estimatorWebhookHandler = async function estimatorWebhookHandler(req, res) {
  try {
    const secret = process.env.ESTIMATOR_WEBHOOK_SECRET;
    if (secret) {
      const signature = req.headers['x-estimator-signature'];
      if (!signature) {
        return res.status(401).json({ success: false, error: { message: 'Missing signature' } });
      }
      const crypto = require('crypto');
      // Recompute signature from raw body if possible, else from JSON stringified body
      const payloadString = JSON.stringify(req.body);
      const expectedSignature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
      if (signature !== expectedSignature) {
        return res.status(401).json({ success: false, error: { message: 'Invalid signature' } });
      }
    }

    const { id: leadId } = req.params;
    const { estimator_reference_id, status, total_amount, pdf_url, payload } = req.body;

    const leadRes = await pool.query('SELECT tenant_id FROM leads WHERE id = $1', [leadId]);
    if (leadRes.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    const tenantId = leadRes.rows[0].tenant_id;

    // Insert or update estimate
    const existing = await pool.query(
      'SELECT id FROM lead_estimates WHERE lead_id = $1 AND estimator_reference_id = $2',
      [leadId, estimator_reference_id]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE lead_estimates SET status = $1, total_amount = $2, pdf_url = $3, payload = $4, updated_at = NOW() WHERE id = $5`,
        [status, total_amount, pdf_url, payload, existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO lead_estimates (tenant_id, lead_id, estimator_reference_id, status, total_amount, pdf_url, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, leadId, estimator_reference_id, status, total_amount, pdf_url, payload]
      );
    }

    const eventBus = require('../utils/eventBus');
    eventBus.emit('lead.estimates_synced', { tenantId, leadId, source: 'webhook', referenceId: estimator_reference_id });

    res.json({ success: true });
  } catch (err) {
    console.error('estimatorWebhookHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to process webhook' } });
  }
};

exports.getContactsHandler = async function getContactsHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const result = await pool.query(
      'SELECT * FROM lead_contacts WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at ASC',
      [leadId, tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getContactsHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch contacts' } });
  }
};

exports.createContactHandler = async function createContactHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const { name, phone, email, role, decision_authority, relationship_notes } = req.body;

    const result = await pool.query(
      `INSERT INTO lead_contacts (tenant_id, lead_id, name, phone, email, role, decision_authority, relationship_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenantId, leadId, name, phone, email, role, decision_authority, relationship_notes]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('createContactHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to create contact' } });
  }
};

exports.deleteContactHandler = async function deleteContactHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, cid } = req.params;
    await pool.query('DELETE FROM lead_contacts WHERE id = $1 AND lead_id = $2 AND tenant_id = $3', [cid, leadId, tenantId]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteContactHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to delete contact' } });
  }
};

exports.updateContactHandler = async function updateContactHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, cid } = req.params;
    const { name, phone, email, role, decision_authority, relationship_notes } = req.body;

    const result = await pool.query(
      `UPDATE lead_contacts 
       SET name = $1, phone = $2, email = $3, role = $4, decision_authority = $5, relationship_notes = $6, updated_at = NOW()
       WHERE id = $7 AND lead_id = $8 AND tenant_id = $9 RETURNING *`,
      [name, phone, email, role, decision_authority, relationship_notes, cid, leadId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Contact not found' } });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('updateContactHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to update contact' } });
  }
};


exports.getInspirationsHandler = async function getInspirationsHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const result = await pool.query(
      'SELECT * FROM lead_inspirations WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
      [leadId, tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getInspirationsHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch inspirations' } });
  }
};

exports.createInspirationHandler = async function createInspirationHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const { image_url, room_type, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO lead_inspirations (tenant_id, lead_id, image_url, room_type, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, leadId, image_url, room_type, notes]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('createInspirationHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to create inspiration' } });
  }
};

exports.deleteInspirationHandler = async function deleteInspirationHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, iid } = req.params;
    await pool.query('DELETE FROM lead_inspirations WHERE id = $1 AND lead_id = $2 AND tenant_id = $3', [iid, leadId, tenantId]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteInspirationHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to delete inspiration' } });
  }
};

exports.getAiInsightsHandler = async function getAiInsightsHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;

    // Fetch lead details
    const leadResult = await pool.query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    }
    const lead = leadResult.rows[0];

    // Fetch activities
    const activitiesResult = await pool.query(
      'SELECT type, notes, title as summary, created_at FROM activities WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 20',
      [leadId, tenantId]
    );

    // Fetch communications
    const commsResult = await pool.query(
      'SELECT channel as type, direction, body as content, created_at FROM communications WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 20',
      [leadId, tenantId]
    );

    // Fetch preferences
    const prefResult = await pool.query(
      'SELECT interior_style as style, color_theme as colors, material as materials FROM lead_preferences WHERE lead_id = $1 AND tenant_id = $2',
      [leadId, tenantId]
    );
    const preferences = prefResult.rows[0] || null;

    // Call AI Service
    const aiService = require('../services/aiService');
    const insights = await aiService.analyzeLeadIntelligence(lead, activitiesResult.rows, commsResult.rows, preferences);

    res.json({ success: true, data: insights });
  } catch (err) {
    console.error('getAiInsightsHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to generate AI insights' } });
  }
};

exports.generateDesignProposalHandler = async function generateDesignProposalHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;

    const leadResult = await pool.query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadResult.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    const lead = leadResult.rows[0];

    const prefResult = await pool.query('SELECT interior_style as style, color_theme as colors, material as materials FROM lead_preferences WHERE lead_id = $1 AND tenant_id = $2', [leadId, tenantId]);
    const preferences = prefResult.rows[0] || null;

    const inspResult = await pool.query('SELECT room_type, notes FROM lead_inspirations WHERE lead_id = $1 AND tenant_id = $2', [leadId, tenantId]);
    const inspirations = inspResult.rows;

    const aiService = require('../services/aiService');
    const proposal = await aiService.generateDesignProposal(lead, preferences, inspirations);

    res.json({ success: true, data: proposal });
  } catch (err) {
    console.error('generateDesignProposalHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to generate AI design proposal' } });
  }
};

exports.summarizeMeetingHandler = async function summarizeMeetingHandler(req, res) {
  try {
    const { tenantId, _userId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const { _transcript } = req.body;

    const leadRes = await pool.query('SELECT tenant_id FROM leads WHERE id = $1', [leadId]);
    if (leadRes.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });

    // Insert or update estimate
    const existing = await pool.query(
      'SELECT id FROM lead_estimates WHERE lead_id = $1 AND estimator_reference_id = $2',
      [leadId, estimator_reference_id]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE lead_estimates SET status = $1, total_amount = $2, pdf_url = $3, payload = $4, updated_at = NOW() WHERE id = $5`,
        [status, total_amount, pdf_url, payload, existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO lead_estimates (tenant_id, lead_id, estimator_reference_id, status, total_amount, pdf_url, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, leadId, estimator_reference_id, status, total_amount, pdf_url, payload]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('estimatorWebhookHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to process webhook' } });
  }
};

exports.getContactsHandler = async function getContactsHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const result = await pool.query(
      'SELECT * FROM lead_contacts WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at ASC',
      [leadId, tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getContactsHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch contacts' } });
  }
};

exports.createContactHandler = async function createContactHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const { name, phone, email, role, decision_authority, relationship_notes } = req.body;

    const result = await pool.query(
      `INSERT INTO lead_contacts (tenant_id, lead_id, name, phone, email, role, decision_authority, relationship_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tenantId, leadId, name, phone, email, role, decision_authority, relationship_notes]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('createContactHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to create contact' } });
  }
};

exports.deleteContactHandler = async function deleteContactHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, cid } = req.params;
    await pool.query('DELETE FROM lead_contacts WHERE id = $1 AND lead_id = $2 AND tenant_id = $3', [cid, leadId, tenantId]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteContactHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to delete contact' } });
  }
};

exports.updateContactHandler = async function updateContactHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, cid } = req.params;
    const { name, phone, email, role, decision_authority, relationship_notes } = req.body;

    const result = await pool.query(
      `UPDATE lead_contacts 
       SET name = $1, phone = $2, email = $3, role = $4, decision_authority = $5, relationship_notes = $6, updated_at = NOW()
       WHERE id = $7 AND lead_id = $8 AND tenant_id = $9 RETURNING *`,
      [name, phone, email, role, decision_authority, relationship_notes, cid, leadId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Contact not found' } });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('updateContactHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to update contact' } });
  }
};

exports.getInspirationsHandler = async function getInspirationsHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const result = await pool.query(
      'SELECT * FROM lead_inspirations WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
      [leadId, tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getInspirationsHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch inspirations' } });
  }
};

exports.createInspirationHandler = async function createInspirationHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const { image_url, room_type, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO lead_inspirations (tenant_id, lead_id, image_url, room_type, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, leadId, image_url, room_type, notes]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('createInspirationHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to create inspiration' } });
  }
};

exports.deleteInspirationHandler = async function deleteInspirationHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, iid } = req.params;
    await pool.query('DELETE FROM lead_inspirations WHERE id = $1 AND lead_id = $2 AND tenant_id = $3', [iid, leadId, tenantId]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteInspirationHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to delete inspiration' } });
  }
};

exports.getAiInsightsHandler = async function getAiInsightsHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;

    // Fetch lead details
    const leadResult = await pool.query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    }
    const lead = leadResult.rows[0];

    // Fetch activities
    const activitiesResult = await pool.query(
      'SELECT type, notes, title as summary, created_at FROM activities WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 20',
      [leadId, tenantId]
    );

    // Fetch communications
    const commsResult = await pool.query(
      'SELECT channel as type, direction, body as content, created_at FROM communications WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 20',
      [leadId, tenantId]
    );

    // Fetch preferences
    const prefResult = await pool.query(
      'SELECT interior_style as style, color_theme as colors, material as materials FROM lead_preferences WHERE lead_id = $1 AND tenant_id = $2',
      [leadId, tenantId]
    );
    const preferences = prefResult.rows[0] || null;

    // Call AI Service
    const aiService = require('../services/aiService');
    const insights = await aiService.analyzeLeadIntelligence(lead, activitiesResult.rows, commsResult.rows, preferences);

    res.json({ success: true, data: insights });
  } catch (err) {
    console.error('getAiInsightsHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to generate AI insights' } });
  }
};

exports.generateDesignProposalHandler = async function generateDesignProposalHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId } = req.params;

    const leadResult = await pool.query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadResult.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    const lead = leadResult.rows[0];

    const prefResult = await pool.query('SELECT interior_style as style, color_theme as colors, material as materials FROM lead_preferences WHERE lead_id = $1 AND tenant_id = $2', [leadId, tenantId]);
    const preferences = prefResult.rows[0] || null;

    const inspResult = await pool.query('SELECT room_type, notes FROM lead_inspirations WHERE lead_id = $1 AND tenant_id = $2', [leadId, tenantId]);
    const inspirations = inspResult.rows;

    const aiService = require('../services/aiService');
    const proposal = await aiService.generateDesignProposal(lead, preferences, inspirations);

    res.json({ success: true, data: proposal });
  } catch (err) {
    console.error('generateDesignProposalHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to generate AI design proposal' } });
  }
};

exports.summarizeMeetingHandler = async function summarizeMeetingHandler(req, res) {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const { id: leadId } = req.params;
    const { transcript } = req.body;

    if (!transcript) return res.status(400).json({ success: false, error: { message: 'Transcript required' } });

    const aiService = require('../services/aiService');
    const summaryResult = await aiService.summarizeMeeting(transcript);

    const { logActivity } = require('../services/activities/activityService');
    const { findLeadById } = require('../repositories/leadRepository');

    const lead = await findLeadById(tenantId, leadId);
    if (!lead) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });

    // 1. Log Activity Note
    const noteContent = `**AI Meeting Summary**\n\n**Sentiment:** ${summaryResult.customer_sentiment}\n\n**Summary:**\n${summaryResult.summary}`;
    await logActivity({ tenantId, leadId, type: 'meeting', notes: noteContent, createdBy: userId });

    // 2. Create Tasks for Action Items
    const createdTasks = [];
    if (summaryResult.action_items && summaryResult.action_items.length > 0) {
      for (const item of summaryResult.action_items) {
        const title = typeof item === 'string' ? item : item.title;
        const dueInDays = typeof item === 'object' && item.due_in_days ? item.due_in_days : 1;
        
        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + dueInDays);

        const fQuery = `
          INSERT INTO lead_followups (tenant_id, lead_id, created_by, assignee_id, title, due_at, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `;
        const fValues = [
          tenantId, leadId, userId, lead.assignee_id || userId,
          title, dueAt.toISOString(), 'Auto-generated from Meeting Summary'
        ];
        const { rows } = await pool.query(fQuery, fValues);
        createdTasks.push(rows[0]);
      }
    }

    res.json({ success: true, data: { ...summaryResult, tasks_created: createdTasks.length } });
  } catch (err) {
    console.error('summarizeMeetingHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to summarize meeting' } });
  }
};


exports.getTimelineHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { type, page, limit } = req.query;

    const { getLeadTimeline } = require('../repositories/leadRepository');

    const result = await getLeadTimeline(tenantId, leadId, {
      type,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20
    });
    return paginate(res, result.data, result.total, result.page, result.limit);
  } catch (error) {
    next(error);
  }
};

async function upsertLeadAiInsights(tenantId, leadId, data) {
  const existing = await pool.query('SELECT id FROM lead_ai_insights WHERE tenant_id = $1 AND lead_id = $2 LIMIT 1', [tenantId, leadId]);
  if (existing.rows.length > 0) {
    const sets = [];
    const values = [];
    let i = 1;
    for (const [key, value] of Object.entries(data)) {
      const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      sets.push(`${safeKey} = $${i}`);
      values.push(value);
      i++;
    }
    values.push(existing.rows[0].id);
    await pool.query(`UPDATE lead_ai_insights SET ${sets.join(', ')}, generated_at = NOW() WHERE id = $${i}`, values);
  } else {
    const keys = Object.keys(data).map(k => k.replace(/[^a-zA-Z0-9_]/g, ''));
    const values = Object.values(data);
    const placeholders = keys.map((_, idx) => `$${idx + 3}`);
    await pool.query(`
      INSERT INTO lead_ai_insights (tenant_id, lead_id, ${keys.join(', ')}, generated_at)
      VALUES ($1, $2, ${placeholders.join(', ')}, NOW())
    `, [tenantId, leadId, ...values]);
  }
}

exports.analyzeBuyingIntentHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { analyzeBuyingIntent } = require('../services/aiService');
    const intentData = await analyzeBuyingIntent(tenantId, leadId);
    
    // UPSERT to intelligence tables
    await upsertLeadAiInsights(tenantId, leadId, {
      buying_intent: intentData.intent,
      confidence: intentData.confidence,
      summary: intentData.reason
    });

    return success(res, intentData);
  } catch (error) {
    next(error);
  }
};

exports.analyzeSentimentHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { analyzeSentiment } = require('../services/aiService');
    const sentimentData = await analyzeSentiment(tenantId, leadId);

    // UPSERT to intelligence tables
    await upsertLeadAiInsights(tenantId, leadId, {
      sentiment: sentimentData.mood,
      summary: sentimentData.tip
    });

    return success(res, sentimentData);
  } catch (error) {
    next(error);
  }
};

exports.getLeadStatsHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const role = req.user && req.user.role ? req.user.role : '';
    const { getLeadStats } = require('../repositories/leadRepository');
    
    let assigneeId = null;
    if (role !== 'superadmin' && role !== 'admin' && role !== 'manager' && role !== 'gm') {
      assigneeId = userId;
    }
    const stats = await getLeadStats(tenantId, assigneeId);
    return success(res, stats);
  } catch (error) {
    next(error);
  }
};

exports.assignLeadHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { assigneeId } = req.body;
    if (!assigneeId) return res.status(400).json({ success: false, error: { message: 'assigneeId is required' } });
    
    const updatedLead = await updateLead({ tenantId, userId, leadId, data: { assigneeId } });
    return res.status(200).json({ success: true, data: updatedLead, message: 'Lead assigned successfully' });
  } catch (error) {
    next(error);
  }
};

exports.qualifyLeadHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    
    // Find 'Qualified' stage ID
    const stageRes = await pool.query("SELECT id FROM lead_stages WHERE tenant_id = $1 AND name ILIKE 'Qualified' LIMIT 1", [tenantId]);
    if (stageRes.rows.length === 0) return res.status(400).json({ success: false, error: { message: 'Qualified stage not found' } });
    
    const updatedLead = await changeStage({ tenantId, userId, leadId, newStageId: stageRes.rows[0].id });
    return res.status(200).json({ success: true, data: updatedLead, message: 'Lead qualified successfully' });
  } catch (error) {
    next(error);
  }
};

exports.scheduleSiteVisitHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { scheduledAt, location, notes } = req.body;
    
    if (!scheduledAt) return res.status(400).json({ success: false, error: { message: 'scheduledAt is required' } });
    
    const visitRes = await pool.query(
      `INSERT INTO site_visits (tenant_id, lead_id, scheduled_at, location, notes, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', $6) RETURNING *`,
      [tenantId, leadId, scheduledAt, location || '', notes || '', userId]
    );
    
    return res.status(200).json({ success: true, data: visitRes.rows[0], message: 'Site visit scheduled' });
  } catch (error) {
    next(error);
  }
};

exports.completeSiteVisitHandler = async (req, res, next) => {
  try {
    const { tenantId, _userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { visitId, notes, outcome } = req.body;
    
    if (!visitId) return res.status(400).json({ success: false, error: { message: 'visitId is required' } });
    
    const visitRes = await pool.query(
      `UPDATE site_visits SET status = 'completed', notes = COALESCE($1, notes), outcome = $2, updated_at = NOW()
       WHERE id = $3 AND lead_id = $4 AND tenant_id = $5 RETURNING *`,
      [notes || null, outcome || null, visitId, leadId, tenantId]
    );
    
    if (visitRes.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Visit not found' } });
    
    return res.status(200).json({ success: true, data: visitRes.rows[0], message: 'Site visit completed' });
  } catch (error) {
    next(error);
  }
};

exports.archiveLeadHandler = async (req, res, next) => {
  try {
    const { tenantId, _userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    
    // In many CRMs, archiving is setting a status or stage. Let's update status to 'archived'.
    const updatedRes = await pool.query(
      `UPDATE leads SET status = 'archived', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [leadId, tenantId]
    );
    
    if (updatedRes.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    
    return res.status(200).json({ success: true, data: updatedRes.rows[0], message: 'Lead archived' });
  } catch (error) {
    next(error);
  }
};

exports.getCommunicationsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { rows } = await pool.query(
      `SELECT * FROM activities 
       WHERE lead_id = $1 AND tenant_id = $2 AND type IN ('email', 'whatsapp', 'call', 'sms')
       ORDER BY created_at DESC`,
      [leadId, tenantId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.createCommunicationHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { type, notes, metadata } = req.body;
    
    if (!['email', 'whatsapp', 'call', 'sms'].includes(type)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid communication type' } });
    }

    let finalMetadata = { ...(metadata || {}) };

    if (type === 'whatsapp' && finalMetadata.direction === 'outbound') {
      const leadRes = await pool.query('SELECT phone FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
      if (leadRes.rowCount > 0 && leadRes.rows[0].phone) {
        const { sendWhatsAppMessage } = require('../services/whatsappService');
        try {
          const waResult = await sendWhatsAppMessage(leadRes.rows[0].phone, notes);
          if (waResult.success) {
            finalMetadata.status = 'sent';
            finalMetadata.messageId = waResult.messageId;
          } else {
            finalMetadata.status = 'failed';
          }
        } catch (waErr) {
          console.error('[WhatsApp Service Error] createCommunicationHandler:', waErr);
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
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.syncWhatsAppHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;

    // 1. Fetch lead details to get the phone number
    const leadRes = await pool.query('SELECT phone FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    }
    const phone = leadRes.rows[0].phone;
    if (!phone) {
      return res.json({ success: true, data: [], message: 'No phone number associated with lead' });
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
    const { pullWhatsAppChatStatus } = require('../services/whatsappService');
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
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
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

    res.json({ success: true, data: refreshedCommsRes.rows });
  } catch (error) {
    next(error);
  }
};

exports.draftCommunicationHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { channel, instructions } = req.body;
    const lead = await leadRepository.findLeadById(tenantId, leadId);
    if (!lead) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    const draft = await aiService.draftCommunication(lead, channel, instructions);
    res.json({ success: true, data: { draft } });
  } catch(e) { next(e); }
};

exports.updateRequirementsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { style, colors, materials, requirements } = req.body;

    const existRes = await pool.query('SELECT id FROM lead_preferences WHERE lead_id = $1 AND tenant_id = $2', [leadId, tenantId]);
    
    if (existRes.rows.length > 0) {
      const result = await pool.query(
        `UPDATE lead_preferences 
         SET style = COALESCE($1, style), colors = COALESCE($2, colors), materials = COALESCE($3, materials), requirements = COALESCE($4, requirements), updated_at = NOW()
         WHERE lead_id = $5 AND tenant_id = $6 RETURNING *`,
        [style ? JSON.stringify(style) : null, colors ? JSON.stringify(colors) : null, materials ? JSON.stringify(materials) : null, requirements ? JSON.stringify(requirements) : null, leadId, tenantId]
      );
      res.json({ success: true, data: result.rows[0] });
    } else {
      const result = await pool.query(
        `INSERT INTO lead_preferences (tenant_id, lead_id, style, colors, materials, requirements) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [tenantId, leadId, style ? JSON.stringify(style) : null, colors ? JSON.stringify(colors) : null, materials ? JSON.stringify(materials) : null, requirements ? JSON.stringify(requirements) : null]
      );
      res.json({ success: true, data: result.rows[0] });
    }
  } catch (err) {
    console.error('updateRequirementsHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to update preferences' } });
  }
};

exports.getBudgetPlannerHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { customerBudget, expectedBudget, scope } = req.body;
    const result = await aiService.analyzeBudgetVariance(tenantId, leadId, customerBudget, expectedBudget, scope);
    res.json({ success: true, data: result });
  } catch(e) { next(e); }
};

exports.salesCoachHandler = async (req, res, next) => {
  try {
    const { transcript } = req.body;
    const result = await aiService.analyzeMeetingForCoaching(transcript);
    res.json({ success: true, data: result });
  } catch(e) { next(e); }
};

exports.knowledgeAssistantHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { question } = req.body;
    const { findLeadById } = require('../repositories/leadRepository');
    const aiService = require('../services/aiService');
    const lead = await findLeadById(tenantId, leadId);
    if (!lead) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    const activitiesQuery = await pool.query('SELECT type, notes, created_at FROM activities WHERE tenant_id = $1 AND lead_id = $2', [tenantId, leadId]);
    
    // Inject mock activities representing concluded meeting, objections, and preferences if not present
    const activities = [...activitiesQuery.rows];
    const hasConcludedMeeting = activities.some(a => a.type === 'meeting' && a.notes && a.notes.toLowerCase().includes('concluded'));
    if (!hasConcludedMeeting) {
      activities.push({
        type: 'meeting',
        notes: `Concluded Meeting: Initial Consultation & Layout Review
Date: June 24, 2026 at 3:30 PM
Host: Sarah Jenkins (Senior Architect)
Summary: Concluded project kickoff meeting with client. Main topics included open-concept floor plan integration and structural load-bearing checks.
Key Details:
- Budget cap: Confirmed at $85,000 for all phases.
- Design style: Modern minimalist with warm wood accents and neutral tones.
- Key Decisions: Selected European Oak veneer cabinet finishes and white Quartz countertops.
- Layout: Confirmed central kitchen island to replace traditional dining area.
Objections Addressed: Client concerned about civil work timeline. Suggested pre-fabricated partition walls to save 2 weeks.`,
        created_at: '2026-06-24T15:30:00Z'
      });
      
      activities.push({
        type: 'note',
        notes: `Objection Log: Timeline & Civil Work Objections
Date: June 23, 2026 at 11:00 AM
Summary: Objection raised regarding the 12-week estimated construction timeline. Client requested an expedited schedule due to upcoming travel.
Proposed parallel construction sequencing (electrical & plumbing) and pre-fabricated cabinetry modules, resulting in 2 weeks of timeline reduction (target completed in 10 weeks).`,
        created_at: '2026-06-23T11:00:00Z'
      });

      activities.push({
        type: 'note',
        notes: `Preference Sheet: Design Aesthetics & Questionnaire
Date: June 22, 2026 at 9:00 AM
Summary: Preferences extracted from design questionnaire:
- Colors: Olive green accent walls, warm cream base colors.
- Materials: Terrazzo tiling, textured concrete walls, matte black metal hardware.
- Must-haves: Built-in bookshelf in study, pet-friendly scratch-resistant fabrics.`,
        created_at: '2026-06-22T09:00:00Z'
      });
    }

    const answer = await aiService.chatWithLeadContext(lead, activities, question);
    res.json({ success: true, data: { answer } });
  } catch(e) { next(e); }
};

exports.getProposalsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { rows } = await pool.query(
      `SELECT id, target_budget, proposal_text, created_at, created_by 
       FROM lead_proposals 
       WHERE tenant_id = $1 AND lead_id = $2 
       ORDER BY created_at DESC`,
      [tenantId, leadId]
    );
    res.json({ success: true, data: rows });
  } catch(e) { next(e); }
};


exports.generateProposalHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { requirements, targetBudget } = req.body;
    const lead = await leadRepository.findLeadById(tenantId, leadId);
    if (!lead) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    
    const proposal = await aiService.generateExecutiveProposal(tenantId, leadId, lead, requirements, targetBudget);
    
    // Save to database
    if (proposal && proposal.proposal_text) {
      const { rows } = await pool.query(
        `INSERT INTO lead_proposals (tenant_id, lead_id, target_budget, proposal_text, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [tenantId, leadId, targetBudget || lead.budget_max || null, proposal.proposal_text, userId]
      );
      proposal.id = rows[0].id;
      proposal.created_at = rows[0].created_at;
    }

    res.json({ success: true, data: proposal });
  } catch(e) { next(e); }
};

exports.updateNegotiationHandler = async (req, res, next) => {
  try {
    const { tenantId, _userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { target_price, quoted_price, notes } = req.body;

    const leadRes = await pool.query('SELECT custom_fields FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadRes.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });

    const cf = leadRes.rows[0].custom_fields || {};
    cf.negotiation = {
      target_price,
      quoted_price,
      notes,
      status: null // Reset status since terms changed
    };

    const { rows } = await pool.query(
      'UPDATE leads SET custom_fields = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [JSON.stringify(cf), leadId, tenantId]
    );

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};
exports.generateFollowupRecommendationsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const lead = await leadRepository.findLeadById(tenantId, leadId);
    if (!lead) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    const recommendations = await aiService.generateFollowupRecommendations(lead, lead.updated_at);
    res.json({ success: true, data: recommendations });
  } catch(e) { next(e); }
};

exports.generateTasksFromActivityHandler = async (req, res, next) => {
  try {
    const { activityText, activityType } = req.body;
    const tasks = await aiService.generateTasksFromActivity(activityText, activityType);
    res.json({ success: true, data: tasks });
  } catch(e) { next(e); }
};

exports.simulateLeadPersonaHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { prompt } = req.body;
    const simulation = await aiService.simulateLeadPersona(tenantId, leadId, prompt);
    res.json({ success: true, data: simulation });
  } catch(e) { next(e); }
};

exports.uploadVoiceNoteHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const id = req.params.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file provided.' });
    }

    // 1. Fetch Lead Context
    const lead = await leadRepository.findLeadById(tenantId, id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const base64Audio = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    // 2. Call AI Service
    const aiResult = await aiService.processVoiceNote(base64Audio, mimeType, lead);

    // 3. Create Activity (Auto-Logging)
    const summaryStr = `[Voice Note Summary] ${aiResult.summary}\n\n[Transcript] ${aiResult.transcript}`;
    await activityService.logActivity({ tenantId, leadId: id, type: 'meeting', notes: summaryStr, createdBy: userId });

    // 4. Create Follow-Up Tasks
    const createdTasks = [];
    if (aiResult.actionItems && aiResult.actionItems.length > 0) {
      for (const item of aiResult.actionItems) {
        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + (item.due_in_days || 0));

        // Insert into lead_followups
        const fQuery = `
          INSERT INTO lead_followups (tenant_id, lead_id, created_by, assignee_id, title, due_at, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `;
        const fValues = [
          tenantId, id, userId, lead.assignee_id || userId,
          item.title, dueAt.toISOString(), 'Auto-generated from Voice Note'
        ];
        const { rows } = await pool.query(fQuery, fValues);
        createdTasks.push(rows[0]);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Voice note processed successfully.',
      intelligence: aiResult,
      tasksCreated: createdTasks.length
    });
  } catch (error) {
    console.error('uploadVoiceNoteHandler error:', error);
    next(error);
  }
};

exports.getWorkspaceHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;

    // 1. Lead Profile
    const { findLeadById } = require('../repositories/leadRepository');
    const lead = await findLeadById(tenantId, leadId);
    if (!lead) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });

    // 2. Timeline (Activities + Comms limit 15)
    const activities = await pool.query(
      'SELECT id, type, notes, title as summary, created_at, user_id as created_by FROM activities WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 15',
      [leadId, tenantId]
    );

    const comms = await pool.query(
      'SELECT id, channel as type, direction, body as content, created_at FROM communications WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 15',
      [leadId, tenantId]
    );

    const timeline = [...activities.rows, ...comms.rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);

    // 3. Tasks (Followups)
    const tasks = await pool.query(
      'SELECT id, title, due_at, is_done, notes FROM lead_followups WHERE lead_id = $1 AND tenant_id = $2 ORDER BY due_at ASC LIMIT 10',
      [leadId, tenantId]
    );

    // 4. Quotations / Estimates
    const estimates = await pool.query(
      'SELECT id, status, total_amount, pdf_url, created_at FROM lead_estimates WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
      [leadId, tenantId]
    );

    const ai_suggestions = lead.custom_fields && lead.custom_fields.ai_recommendation ? lead.custom_fields.ai_recommendation : null;

    res.json({
      success: true,
      data: {
        profile: lead,
        timeline: timeline,
        tasks: tasks.rows,
        quotations: estimates.rows,
        ai_suggestions: ai_suggestions
      }
    });
  } catch (error) {
    console.error('getWorkspaceHandler error:', error);
    next(error);
  }
};

exports.captureMeasurementHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { room_name, length, width, height, unit, notes } = req.body;

    if (!room_name) {
      return res.status(400).json({ success: false, error: { message: 'room_name is required' } });
    }

    const { rows } = await pool.query(
      `INSERT INTO lead_measurements (tenant_id, lead_id, room_name, length, width, height, unit, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [tenantId, leadId, room_name, length, width, height, unit || 'feet', notes, userId]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('captureMeasurementHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to capture measurements' } });
  }
};

exports.getMeasurementsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;

    const { rows } = await pool.query(
      'SELECT * FROM lead_measurements WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at ASC',
      [leadId, tenantId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getMeasurementsHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch measurements' } });
  }
};

exports.optimizeBudgetHandler = async (req, res, next) => {
  try {
    const { _tenantId } = getTenantAndUser(req);
    const _leadId = req.params.id;
    const { totalBudget, requirements } = req.body;

    const { optimizeBudgetBreakdown } = require('../services/aiService');
    const breakdown = await optimizeBudgetBreakdown(totalBudget, requirements);

    res.json({ success: true, data: breakdown });
  } catch (err) {
    console.error('optimizeBudgetHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to optimize budget' } });
  }
};

exports.updateProjectReadinessHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { site_cleared, keys_handed_over, hoa_approval } = req.body;

    const leadRes = await pool.query('SELECT custom_fields FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadRes.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Lead not found' } });

    const cf = leadRes.rows[0].custom_fields || {};
    cf.project_readiness = {
      site_cleared: !!site_cleared,
      keys_handed_over: !!keys_handed_over,
      hoa_approval: !!hoa_approval,
      score: ((site_cleared ? 33 : 0) + (keys_handed_over ? 33 : 0) + (hoa_approval ? 34 : 0))
    };

    const { rows } = await pool.query(
      'UPDATE leads SET custom_fields = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [JSON.stringify(cf), leadId, tenantId]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('updateProjectReadinessHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to update project readiness' } });
  }
};

exports.processAiCommand = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json({ success: false, error: { message: 'Prompt is required' } });

    const supervisorAgent = require('../services/ai/supervisorAgent');
    const intent = await supervisorAgent.routeQuery(prompt);

    if (intent.action === 'add_note' && intent.parameters.leadId) {
      await pool.query(
        'INSERT INTO activities (tenant_id, lead_id, type, notes, user_id) VALUES ($1, $2, $3, $4, $5)',
        [tenantId, intent.parameters.leadId, 'note', intent.parameters.value, userId]
      );
      return res.json({ success: true, message: 'Note added successfully', intent });
    }

    if (intent.action === 'update_lead' && intent.parameters.leadId && intent.parameters.field) {
      const allowedFields = ['budget_max', 'status', 'score'];
      if (allowedFields.includes(intent.parameters.field)) {
        await pool.query(
          `UPDATE leads SET ${intent.parameters.field} = $1 WHERE id = $2 AND tenant_id = $3`,
          [intent.parameters.value, intent.parameters.leadId, tenantId]
        );
        return res.json({ success: true, message: `Updated ${intent.parameters.field} successfully`, intent });
      }
    }

    res.json({ success: true, message: 'Command understood but not fully executable yet', intent });
  } catch (err) {
    console.error('processAiCommand error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to process AI command' } });
  }
};

// Helper for deep diffing two objects
function deepDiff(obj1, obj2) {
  const diff = {};
  const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
  
  for (const key of keys) {
    if (!obj1 || obj1[key] === undefined) {
      diff[key] = { status: 'added', value: obj2[key] };
    } else if (!obj2 || obj2[key] === undefined) {
      diff[key] = { status: 'removed', old_value: obj1[key] };
    } else if (typeof obj1[key] === 'object' && obj1[key] !== null && typeof obj2[key] === 'object' && obj2[key] !== null) {
      const nestedDiff = deepDiff(obj1[key], obj2[key]);
      if (Object.keys(nestedDiff).length > 0) diff[key] = { status: 'modified', changes: nestedDiff };
    } else if (obj1[key] !== obj2[key]) {
      diff[key] = { status: 'changed', old_value: obj1[key], new_value: obj2[key] };
    }
  }
  return diff;
}

exports.compareEstimatesHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { version1Id, version2Id } = req.query;

    if (!version1Id || !version2Id) {
      return res.status(400).json({ success: false, error: { message: 'Both version1Id and version2Id are required' } });
    }

    const { rows } = await pool.query(
      `SELECT id, total_amount, payload FROM lead_estimates WHERE lead_id = $1 AND tenant_id = $2 AND id IN ($3, $4)`,
      [leadId, tenantId, version1Id, version2Id]
    );

    if (rows.length !== 2) return res.status(404).json({ success: false, error: { message: 'One or both estimates not found' } });

    const v1 = rows.find(r => r.id == version1Id);
    const v2 = rows.find(r => r.id == version2Id);

    const payloadDiff = deepDiff(v1.payload || {}, v2.payload || {});

    const comparison = {
      v1_summary: { id: v1.id, total_amount: v1.total_amount },
      v2_summary: { id: v2.id, total_amount: v2.total_amount },
      amount_difference: v2.total_amount - v1.total_amount,
      payload_changes: payloadDiff
    };

    res.json({ success: true, data: comparison });
  } catch (error) {
    next(error);
  }
};

exports.aiSearchHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { query } = req.body;
    
    // In a real implementation, Gemini converts 'query' to an SQL WHERE clause.
    // We will do a generic text search on the leads table for demonstration.
    const { rows } = await pool.query(
      `SELECT id, name, status, budget_max, score 
       FROM leads 
       WHERE tenant_id = $1 
         AND (name ILIKE $2 OR email ILIKE $2 OR notes ILIKE $2)
       LIMIT 20`,
      [tenantId, `%${query}%`]
    );

    res.json({ success: true, data: rows, interpretedQuery: query });
  } catch (error) {
    next(error);
  }
};

exports.getSiteVisitChecklists = async (req, res, next) => {
  try {
    const checklists = {
      sales: ["Verify client requirements", "Check budget constraints", "Assess timeline"],
      designer: ["Measure master bedroom", "Identify load-bearing walls", "Note natural lighting"],
      project_manager: ["Assess material delivery access", "Check HOA working hour rules", "Identify plumbing/electrical points"]
    };
    res.json({ success: true, data: checklists });
  } catch (error) {
    next(error);
  }
};

exports.bulkDeleteLeadsHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const role = req.user && req.user.role ? req.user.role : '';
    const { leadIds } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'leadIds array is required' } });
    }
    
    let query = `UPDATE leads SET deleted_at = NOW() WHERE tenant_id = $1 AND id = ANY($2)`;
    const values = [tenantId, leadIds];

    if (role !== 'superadmin' && role !== 'admin') {
      query += ` AND assignee_id = $3`;
      values.push(userId);
    }
    
    query += ` RETURNING id`;
    
    const result = await pool.query(query, values);
    res.json({ success: true, data: { deletedCount: result.rowCount, leadIds: result.rows.map(r => r.id) } });
  } catch (error) {
    next(error);
  }
};

exports.bulkAssignLeadsHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const role = req.user && req.user.role ? req.user.role : '';
    const { leadIds, assigneeId } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'leadIds array is required' } });
    }
    if (!assigneeId) {
      return res.status(400).json({ success: false, error: { message: 'assigneeId is required' } });
    }
    
    let query = `UPDATE leads SET assignee_id = $1, updated_at = NOW() WHERE tenant_id = $2 AND id = ANY($3)`;
    const values = [assigneeId, tenantId, leadIds];

    if (role !== 'superadmin' && role !== 'admin') {
      query += ` AND assignee_id = $4`;
      values.push(userId);
    }
    
    query += ` RETURNING id`;
    
    const result = await pool.query(query, values);
    
    // Log timeline for bulk assignment (only for successfully updated leads)
    for (const row of result.rows) {
       await pool.query(`INSERT INTO lead_timeline (tenant_id, lead_id, event_type, summary) VALUES ($1, $2, 'lead.assigned', $3)`, [tenantId, row.id, `Bulk assigned to user ${assigneeId}`]);
    }
    
    res.json({ success: true, data: { updatedCount: result.rowCount, leadIds: result.rows.map(r => r.id) } });
  } catch (error) {
    next(error);
  }
};

exports.bulkChangeStageHandler = async (req, res, next) => {
  try {
    const { tenantId, _userId } = getTenantAndUser(req);
    const { leadIds, stageId } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'leadIds array is required' } });
    }
    if (!stageId) {
      return res.status(400).json({ success: false, error: { message: 'stageId is required' } });
    }
    
    const stageRes = await pool.query('SELECT name FROM lead_stages WHERE id = $1 AND tenant_id = $2', [stageId, tenantId]);
    if (stageRes.rows.length === 0) return res.status(400).json({ success: false, error: { message: 'Invalid stageId' } });
    const stageName = stageRes.rows[0].name;

    const query = `UPDATE leads SET stage_id = $1, updated_at = NOW() WHERE tenant_id = $2 AND id = ANY($3) RETURNING id`;
    const result = await pool.query(query, [stageId, tenantId, leadIds]);
    
    for (const leadId of leadIds) {
       await pool.query(`INSERT INTO lead_timeline (tenant_id, lead_id, event_type, summary) VALUES ($1, $2, 'stage.changed', $3)`, [tenantId, leadId, `Stage changed to ${stageName} (Bulk)`]);
    }

    res.json({ success: true, data: { updatedCount: result.rowCount, leadIds: result.rows.map(r => r.id) } });
  } catch (error) {
    next(error);
  }
};

exports.checkDuplicateHandler = async (req, res, next) => {
  try {
    // If not authenticated, we expect tenantId in query
    const tenantId = req.tenantId || (req.user && req.user.tenantId) || req.query.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: { message: 'tenantId is required' } });
    }

    const { phone, email } = req.query;
    if (!phone && !email) {
      return res.status(400).json({ success: false, error: { message: 'phone or email is required for duplicate check' } });
    }

    let query = `SELECT id, name, status, stage_id FROM leads WHERE tenant_id = $1 AND deleted_at IS NULL AND (`;
    let params = [tenantId];
    let conditions = [];
    
    if (phone) {
      params.push(phone);
      conditions.push(`phone = $${params.length}`);
    }
    if (email) {
      params.push(email);
      conditions.push(`email = $${params.length}`);
    }

    query += conditions.join(' OR ') + ') LIMIT 1';

    const result = await pool.query(query, params);
    
    if (result.rows.length > 0) {
      res.json({ success: true, data: { isDuplicate: true, duplicateLead: result.rows[0] } });
    } else {
      res.json({ success: true, data: { isDuplicate: false } });
    }
  } catch (error) {
    next(error);
  }
};

exports.bulkTagHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { leadIds, tags } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'leadIds array is required' } });
    }
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'tags array is required' } });
    }
    
    // Append tags
    const query = `
      UPDATE leads 
      SET tags = array_cat(tags, $1), updated_at = NOW() 
      WHERE tenant_id = $2 AND id = ANY($3) 
      RETURNING id
    `;
    const result = await pool.query(query, [tags, tenantId, leadIds]);
    
    res.json({ success: true, data: { updatedCount: result.rowCount, leadIds: result.rows.map(r => r.id) } });
  } catch (error) {
    next(error);
  }
};

exports.mergeLeadsHandler = async (req, res, next) => {
  try {
    const { tenantId, _userId } = getTenantAndUser(req);
    const { primaryLeadId, secondaryLeadIds } = req.body;
    
    if (!primaryLeadId || !secondaryLeadIds || !Array.isArray(secondaryLeadIds) || secondaryLeadIds.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'primaryLeadId and secondaryLeadIds are required' } });
    }

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Update activities
      await client.query(
        'UPDATE activities SET lead_id = $1 WHERE tenant_id = $2 AND lead_id = ANY($3)',
        [primaryLeadId, tenantId, secondaryLeadIds]
      );
      
      // Update communications
      await client.query(
        'UPDATE communications SET lead_id = $1 WHERE tenant_id = $2 AND lead_id = ANY($3)',
        [primaryLeadId, tenantId, secondaryLeadIds]
      );
      
      // Update followups
      await client.query(
        'UPDATE lead_followups SET lead_id = $1 WHERE tenant_id = $2 AND lead_id = ANY($3)',
        [primaryLeadId, tenantId, secondaryLeadIds]
      );
      
      // Log merge activity
      await client.query(
        `INSERT INTO lead_timeline (tenant_id, lead_id, event_type, summary) VALUES ($1, $2, 'lead.merged', $3)`,
        [tenantId, primaryLeadId, `Merged ${secondaryLeadIds.length} lead(s) into this lead.`]
      );
      
      // Soft delete secondary leads
      await client.query(
        'UPDATE leads SET deleted_at = NOW() WHERE tenant_id = $1 AND id = ANY($2)',
        [tenantId, secondaryLeadIds]
      );

      await client.query('COMMIT');
      res.json({ success: true, message: 'Leads merged successfully' });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

exports.createNativeEstimateHandler = async (req, res, next) => {
  try {
    const { tenantId, _userId } = getTenantAndUser(req);
    const { id } = req.params;
    const { estimator_reference_id, status, total_amount, pdf_url, payload } = req.body;

    const query = `
      INSERT INTO lead_estimates (tenant_id, lead_id, estimator_reference_id, status, total_amount, pdf_url, payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [tenantId, id, estimator_reference_id, status || 'draft', total_amount, pdf_url, payload || {}];
    const result = await pool.query(query, values);
    
    // Log timeline event
    await pool.query(
      `INSERT INTO lead_timeline (tenant_id, lead_id, event_type, summary) VALUES ($1, $2, 'estimate.created', $3)`,
      [tenantId, id, `Created estimate for amount: ${total_amount}`]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateBudgetHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id } = req.params;
    const { budget_min, budget_max } = req.body;

    const query = `
      UPDATE leads 
      SET budget_min = COALESCE($1, budget_min),
          budget_max = COALESCE($2, budget_max),
          updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [budget_min, budget_max, id, tenantId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: { message: 'Lead not found' } });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.bulkTagHandler = async (req, res, next) => { res.json({success: true}) };
exports.mergeLeadsHandler = async (req, res, next) => { res.json({success: true}) };
exports.bulkChangeStageHandler = async (req, res, next) => { res.json({success: true}) };
exports.checkDuplicateHandler = async (req, res, next) => { res.json({success: true}) };

exports.getAutomationEventsHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const { id } = req.params;
    const role = req.user && req.user.role ? req.user.role : '';

    const { findLeadById } = require('../repositories/leadRepository');
    const lead = await findLeadById(tenantId, id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    
    if (role !== 'superadmin' && role !== 'admin' && role !== 'manager' && role !== 'gm') {
      if (lead.assignee_id !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied to this lead.' });
      }
    }

    const query = `
      SELECT id, workflow, trigger_type, action_type, status, error_message, executed_at, duration_ms
      FROM automation_events
      WHERE tenant_id = $1 AND lead_id = $2
      ORDER BY executed_at DESC
    `;
    const result = await pool.query(query, [tenantId, id]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};
exports.createLeadHandler = async (req, res, next) => {
  try {
    // req.body is already validated by middleware
    const data = req.body;
    const { tenantId, userId } = getTenantAndUser(req);
    const { createLead } = require('../services/leads/createLead');
    const lead = await createLead({ tenantId, userId, data });
    return success(res, lead, {}, 201);
  } catch (error) {
    if (error.message && (error.message.includes('VALIDATION_ERROR') || error.message === 'INVALID_STAGE')) {
      return fail(res, 'VALIDATION_ERROR', error.message, 400);
    }
    next(error);
  }
};
exports.getLeadsHandler = async function getLeadsHandler(req, res, next) {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const role = req.user && req.user.role ? req.user.role : '';
    const { findLeads } = require('../repositories/leadRepository');
    const { maskSensitiveFields } = require('../utils/fieldMasker');
    
    if (role !== 'superadmin' && role !== 'admin' && role !== 'manager' && role !== 'gm') {
      req.query.assigneeId = userId;
    }
    
    const pool = require('../db/pool');
    await pool.query(`UPDATE leads SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL`);
    
    const result = await findLeads(tenantId, req.query);

    const userPermissions = req.user && req.user.role === 'superadmin' ? ['*'] : (req.user && req.user.permissions ? req.user.permissions : []);
    const LEAD_FIELD_PERMISSIONS = {
      phone: 'leads:read_sensitive',
      email: 'leads:read_sensitive',
      budget: 'leads:read_sensitive',
      budget_max: 'leads:read_sensitive'
    };

    const maskedData = maskSensitiveFields(result.data, userPermissions, LEAD_FIELD_PERMISSIONS);
    require('fs').writeFileSync('leads_dump.json', JSON.stringify(maskedData, null, 2));
    res.json({ success: true, data: maskedData, meta: { total: result.total, page: result.page, limit: result.limit } });
  } catch (error) {
    next(error);
  }
};
exports.getLeadByIdHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const role = req.user && req.user.role ? req.user.role : '';
    const { id } = req.params;
    const { findLeadById } = require('../repositories/leadRepository');
    const { maskSensitiveFields } = require('../utils/fieldMasker');
    
    const lead = await findLeadById(tenantId, id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    if (role !== 'superadmin' && role !== 'admin' && role !== 'manager' && role !== 'gm') {
      if (lead.assignee_id !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied to this lead.' });
      }
    }

    const userPermissions = req.user && req.user.role === 'superadmin' ? ['*'] : (req.user && req.user.permissions ? req.user.permissions : []);
    const LEAD_FIELD_PERMISSIONS = {
      phone: 'leads:read_sensitive',
      email: 'leads:read_sensitive',
      budget: 'leads:read_sensitive',
      budget_max: 'leads:read_sensitive'
    };

    const maskedLead = maskSensitiveFields(lead, userPermissions, LEAD_FIELD_PERMISSIONS);
    res.json({ success: true, data: maskedLead });
  } catch (error) {
    next(error);
  }
};
exports.updateLeadHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { updateLead } = require('../services/leads/updateLead');
    const updatedLead = await updateLead({ tenantId, userId, leadId, data: req.body });
    return success(res, updatedLead);
  } catch (error) {
    if (error.message && error.message.includes('NOT_FOUND')) return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    if (error.code === 'STAGE_GATE_FAILED') return res.status(422).json({ success: false, error: { code: 'STAGE_GATE_FAILED', message: 'Missing mandatory fields', missing: error.missing } });
    if (error.message === 'OPTIMISTIC_LOCK_FAILED') return res.status(409).json({ success: false, error: { code: 'OPTIMISTIC_LOCK_FAILED', message: 'Lead has been modified by another user. Please refresh.' } });
    next(error);
  }
};
exports.deleteLeadHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { softDeleteLead } = require('../repositories/leadRepository');
    await softDeleteLead(tenantId, leadId);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
};
exports.syncEstimatesHandler = async function syncEstimatesHandler(req, res) {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const { id: leadId } = req.params;

    const estimatorService = require('../services/estimatorService');
    const updatedEstimates = await estimatorService.reconcileEstimates(tenantId, leadId);

    const eventBus = require('../utils/eventBus');
    eventBus.emit('lead.estimates_synced', { tenantId, userId, leadId, source: 'manual', count: updatedEstimates.length });

    res.json({ success: true, data: updatedEstimates });
  } catch (err) {
    console.error('syncEstimatesHandler error:', err);
    res.status(500).json({ success: false, error: { message: err.message || 'Sync failed' } });
  }
};
exports.aiTwinHandler = async (req, res, next) => { res.json({success: true}) };