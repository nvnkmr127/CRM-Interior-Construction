const { z } = require('zod');
const pool = require('../db/pool');
const { createLead } = require('../services/leads/createLead');
const { updateLead } = require('../services/leads/updateLead');
const { deleteLead } = require('../services/leads/deleteLead');
const { changeStage } = require('../services/leads/changeStage');
const { bulkDeleteLeads } = require('../services/leads/bulkDeleteLeads');
const { bulkAssignLeads } = require('../services/leads/bulkAssignLeads');
const { bulkChangeStage } = require('../services/leads/bulkChangeStage');
const { findLeads, findLeadById, getLeadStats } = require('../repositories/leadRepository');
const { listActivities, logActivity } = require('../services/activities/activityService');
const { success, fail, paginate } = require('../utils/response');
const AppError = require('../utils/AppError');

const createLeadSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  source: z.string().optional(),
  stageId: z.string().uuid('Invalid stage ID').optional().or(z.literal('')),
  assigneeId: z.string().uuid('Invalid assignee ID').optional().or(z.literal('')),
  notes: z.string().optional(),
  custom_fields: z.record(z.any()).optional(),
  builder_name: z.string().optional(),
  possession_date: z.string().optional(),
  house_status: z.string().optional(),
  loan_approved: z.boolean().optional(),
  interior_style: z.string().optional(),
  material_preference: z.string().optional(),
  preferred_communication: z.string().optional(),
  preferred_language: z.string().optional(),
  referral_source: z.string().optional(),
  lifestyle_preferences: z.any().optional(),
  additional_contacts: z.array(z.any()).optional(),
  win_probability: z.number().min(0).max(100).optional(),
  last_contacted_at: z.string().datetime().optional(),
  ai_score_breakdown: z.record(z.any()).optional()
});

const logActivitySchema = z.object({
  type: z.enum(['call', 'note', 'email', 'whatsapp', 'site_visit', 'meeting']),
  title: z.string().optional(),
  notes: z.string().optional(),
  outcome: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  ai_summary: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const getTenantAndUser = (req) => {
  const tenantId = req.tenantId || (req.user && req.user.tenantId);
  const userId = req.user && req.user.userId;
  if (!tenantId) {
    throw new AppError('Tenant context missing', 401, 'UNAUTHORIZED');
  }
  return { tenantId, userId };
};

exports.createLeadHandler = async (req, res, next) => {
  console.log('--- Incoming createLead Request ---', req.body);
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('Lead Validation Error:', JSON.stringify(parsed.error.issues, null, 2));
      return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues);
    }
    const { tenantId, userId } = getTenantAndUser(req);
    const lead = await createLead({ tenantId, userId, data: parsed.data });
    return success(res, lead, {}, 201);
  } catch (error) {
    console.error('Lead Creation Error Details:', error);
    if (error.message && (error.message.includes('VALIDATION_ERROR') || error.message === 'INVALID_STAGE')) {
      return fail(res, 'VALIDATION_ERROR', error.message, 400);
    }
    next(error);
  }
};

exports.getLeadsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { stageId, assigneeId, source, search, sortBy, sortDesc, page, limit } = req.query;

    const result = await findLeads(tenantId, {
      stageId,
      assigneeId,
      source,
      search,
      sortBy,
      sortDesc,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20
    });

    return paginate(res, result.data, result.total, result.page, result.limit);
  } catch (error) {
    next(error);
  }
};

exports.getLeadStatsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const stats = await getLeadStats(tenantId);
    return success(res, stats);
  } catch (error) {
    next(error);
  }
};

exports.getLeadByIdHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const leadId = req.params.id;

    const lead = await findLeadById(tenantId, leadId);
    if (!lead) {
      return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    }

    const activitiesResult = await listActivities({ tenantId, leadId, limit: 5 });
    
    // Fetch Referrals
    const referralsQuery = await pool.query(`
      SELECT id, name, stage_id, budget_max, created_at,
        (SELECT name FROM lead_stages WHERE id = stage_id) as stage_name
      FROM leads 
      WHERE referred_by_lead_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `, [leadId, tenantId]);

    return success(res, { 
      ...lead, 
      activities: activitiesResult.data,
      referrals: referralsQuery.rows 
    });
  } catch (error) {
    next(error);
  }
};

exports.updateLeadHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;

    const updatedLead = await updateLead({ tenantId, userId, leadId, data: req.body });
    return success(res, updatedLead);
  } catch (error) {
    if (error.code === 'STAGE_GATE_FAILED') {
      return res.status(400).json({
        success: false,
        error: { code: 'STAGE_GATE_FAILED', message: 'Missing mandatory fields for this stage', missing: error.missing },
        timestamp: new Date().toISOString()
      });
    }
    if (error.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    if (error.message === 'INVALID_STAGE') return fail(res, 'VALIDATION_ERROR', 'Invalid stage', 400);
    next(error);
  }
};

exports.deleteLeadHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    await deleteLead({ tenantId, userId, leadId });
    return res.status(204).send();
  } catch (error) {
    if (error.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    next(error);
  }
};

exports.bulkDeleteLeadsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { leadIds } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return fail(res, 'VALIDATION_ERROR', 'An array of leadIds is required', 400);
    }
    const deletedCount = await bulkDeleteLeads(leadIds, tenantId);
    return success(res, { count: deletedCount }, { message: `Deleted ${deletedCount} leads` });
  } catch (error) {
    next(error);
  }
};

exports.bulkAssignLeadsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { leadIds, assigneeId } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return fail(res, 'VALIDATION_ERROR', 'An array of leadIds is required', 400);
    }
    const updatedCount = await bulkAssignLeads(leadIds, assigneeId, tenantId);
    return success(res, { count: updatedCount }, { message: `Assigned ${updatedCount} leads` });
  } catch (error) {
    if (error.message === 'Invalid assignee') return fail(res, 'VALIDATION_ERROR', 'Assignee not found in this tenant', 400);
    next(error);
  }
};

exports.bulkChangeStageHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { leadIds, stageId } = req.body;
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return fail(res, 'VALIDATION_ERROR', 'An array of leadIds is required', 400);
    }
    if (!stageId) {
      return fail(res, 'VALIDATION_ERROR', 'stageId is required', 400);
    }
    const updatedCount = await bulkChangeStage(leadIds, stageId, tenantId);
    return success(res, { count: updatedCount }, { message: `Moved ${updatedCount} leads to new stage` });
  } catch (error) {
    if (error.message === 'Invalid stage') return fail(res, 'VALIDATION_ERROR', 'Stage not found in this tenant', 400);
    next(error);
  }
};

exports.changeStageHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { stageId } = req.body;
    if (!stageId) return fail(res, 'VALIDATION_ERROR', 'stageId is required', 400);

    const updatedLead = await changeStage({ tenantId, userId, leadId, newStageId: stageId });
    return success(res, updatedLead);
  } catch (error) {
    if (error.code === 'STAGE_GATE_FAILED') {
      return res.status(422).json({
        success: false,
        error: { code: 'STAGE_GATE_FAILED', message: 'Missing mandatory fields for this stage', missing: error.missing },
        timestamp: new Date().toISOString()
      });
    }
    if (error.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    if (error.message === 'INVALID_STAGE') return fail(res, 'VALIDATION_ERROR', 'Invalid stage', 400);
    next(error);
  }
};

exports.convertToProjectHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const { 
      booking_received, floor_plan, scope_finalized,
      projectName, projectType, clientName, clientPhone, clientEmail, pm, contractValue 
    } = req.body;

    if (!booking_received || !floor_plan || !scope_finalized) {
      return fail(res, 'VALIDATION_ERROR', 'All checklist items must be verified to convert.', 400);
    }
    if (!projectName || !pm || !projectType) {
      return fail(res, 'VALIDATION_ERROR', 'Project name, type and PM are required.', 400);
    }

    // 1. Get the lead
    const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadRes.rows.length === 0) return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    const lead = leadRes.rows[0];

    // 2. Insert into projects
    const insertRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, pm_id, status, value, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'active', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `, [tenantId, projectName, clientName || lead.name, pm, contractValue || lead.budget_max || 0]);
    
    const newProjectId = insertRes.rows[0].id;

    // 3. Mark lead as converted (status field) if not already won
    if (lead.status !== 'converted') {
      await pool.query(
        'UPDATE leads SET status = $1, converted_to_project_id = $2, updated_at = NOW() WHERE id = $3',
        ['converted', newProjectId, leadId]
      );
    }

    return success(res, { project_id: newProjectId, message: 'Project created successfully' }, {}, 201);
  } catch (error) {
    next(error);
  }
};

exports.logActivityHandler = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const leadId = req.params.id;
    const parsed = logActivitySchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues);

    const activity = await logActivity({ tenantId, userId, leadId, ...parsed.data });
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

exports.checkDuplicateHandler = async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return fail(res, 'VALIDATION_ERROR', 'phone query parameter is required', 400);
    }
    
    // In public contexts, if tenant context isn't strictly required or we use a default
    // We'll extract tenantId if authenticated, otherwise use the first one
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

    const result = await pool.query(
      'SELECT id, stage, assigned_rep_id as assigned_to FROM leads WHERE phone = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1',
      [phone, tenantId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return success(res, {
        exists: true,
        lead_id: row.id,
        stage: row.stage,
        assigned_to: row.assigned_to
      });
    }

    return success(res, { exists: false });
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

    const allowedFields = [
      'name', 'phone', 'email', 'source', 'status', 'assignee_id', 'stage_id',
      'priority', 'notes', 'custom_fields', 'value', 'expected_close_date',
      'score', 'project_type', 'scope', 'budget_max', 'budget_min', 'locality', 'carpet_area_sqft', 'city', 'dnc_flag', 'consent_whatsapp', 'competitor_mentioned', 'latitude', 'longitude'
    ];
    const fields = ['name', 'phone', 'email', 'source', 'stage_name', 'assignee_name', 'score', 'notes', 'created_at'];
    const header = fields.join(',');
    const rows = result.data.map(lead =>
      fields.map(f => {
        const val = lead[f] ?? '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      }).join(',')
    );

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

    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

    const results = { created: 0, skipped: 0, errors: [] };
    const { createLead: createLeadService } = require('../services/leads/createLead');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });

      if (!row.name || !row.phone) {
        results.errors.push({ row: i + 1, error: 'Missing name or phone' });
        results.skipped++;
        continue;
      }

      try {
        await createLeadService({ tenantId, userId, ...row });
        results.created++;
      } catch (err) {
        results.errors.push({ row: i + 1, error: err.message });
        results.skipped++;
      }
    }

    res.json({ success: true, data: results });
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

    const storageKey = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const result = await pool.query(
      `INSERT INTO lead_files (tenant_id, lead_id, uploaded_by, file_name, file_size, mime_type, storage_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, file_name, file_size, mime_type, created_at`,
      [tenantId, leadId, userId, req.file.originalname, req.file.size, req.file.mimetype, storageKey]
    );

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

    const result = await pool.query(
      `SELECT f.id, f.file_name, f.file_size, f.mime_type, f.storage_key, f.created_at, u.name AS uploaded_by_name
       FROM lead_files f LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.tenant_id = $1 AND f.lead_id = $2
       ORDER BY f.created_at DESC`,
      [tenantId, leadId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch files' } });
  }
};

exports.deleteFileHandler = async function deleteFileHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id: leadId, fileId } = req.params;

    await pool.query(
      'DELETE FROM lead_files WHERE id = $1 AND lead_id = $2 AND tenant_id = $3',
      [fileId, leadId, tenantId]
    );

    res.json({ success: true });
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
    // This endpoint should ideally be protected by a webhook secret
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
      'SELECT type, notes, summary, created_at FROM lead_activities WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 20',
      [leadId, tenantId]
    );

    // Fetch communications
    const commsResult = await pool.query(
      'SELECT type, direction, content, created_at FROM lead_communications WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 20',
      [leadId, tenantId]
    );

    // Fetch preferences
    const prefResult = await pool.query(
      'SELECT style, colors, materials, requirements FROM lead_preferences WHERE lead_id = $1 AND tenant_id = $2',
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

    const prefResult = await pool.query('SELECT style, colors, materials, requirements FROM lead_preferences WHERE lead_id = $1 AND tenant_id = $2', [leadId, tenantId]);
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

    // 1. Log Activity Note
    const noteContent = `**AI Meeting Summary**\n\n**Sentiment:** ${summaryResult.customer_sentiment}\n\n**Summary:**\n${summaryResult.summary}`;
    await pool.query(
      'INSERT INTO lead_activities (tenant_id, lead_id, type, notes, created_by) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, leadId, 'meeting', noteContent, userId]
    );

    // 2. Create Tasks for Action Items
    for (const item of summaryResult.action_items) {
      await pool.query(
        'INSERT INTO lead_activities (tenant_id, lead_id, type, notes, scheduled_at, created_by) VALUES ($1, $2, $3, $4, NOW() + INTERVAL \'1 day\', $5)',
        [tenantId, leadId, 'task', `[Action Item] ${item}`, userId]
      );
    }

    res.json({ success: true, data: summaryResult });
  } catch (err) {
    console.error('summarizeMeetingHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to summarize meeting' } });
  }
};
