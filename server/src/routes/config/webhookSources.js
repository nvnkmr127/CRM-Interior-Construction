const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const pool = require('../../db/pool');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { success, fail } = require('../../utils/response');

const router = express.Router();

router.use(authenticate, authorize('config:manage'));

router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const query = `
      SELECT id, name, source_key, dedup_field, default_stage_id, default_assignee_id, provider_name, is_active, created_at, updated_at, field_mapping
      FROM webhook_sources
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [tenantId]);
    return success(res, result.rows);
  } catch (error) {
    next(error);
  }
});

const createSourceSchema = z.object({
  name: z.string().min(1),
  field_mapping: z.array(z.object({
    sourceField: z.string(),
    targetField: z.string(),
    transform: z.string().optional()
  })).optional(),
  dedup_field: z.string().optional(),
  default_stage_id: z.string().uuid().optional(),
  default_assignee_id: z.string().uuid().optional(),
  provider_name: z.string().optional()
});

router.post('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const parsed = createSourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues);
    }

    const { name, field_mapping, dedup_field, default_stage_id, default_assignee_id, provider_name } = parsed.data;

    const source_key = crypto.randomBytes(16).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');

    const query = `
      INSERT INTO webhook_sources (
        tenant_id, name, source_key, secret, field_mapping, dedup_field, default_stage_id, default_assignee_id, provider_name
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING *
    `;

    const values = [
      tenantId,
      name,
      source_key,
      secret,
      JSON.stringify(field_mapping || []),
      dedup_field || null,
      default_stage_id || null,
      default_assignee_id || null,
      provider_name || null
    ];

    const result = await pool.query(query, values);
    
    // Return source with source_key and secret just this once
    return success(res, result.rows[0], {}, 201);
  } catch (error) {
    next(error);
  }
});

const updateSourceSchema = z.object({
  name: z.string().min(1).optional(),
  field_mapping: z.array(z.object({
    sourceField: z.string(),
    targetField: z.string(),
    transform: z.string().optional()
  })).optional(),
  dedup_field: z.string().optional().nullable(),
  default_stage_id: z.string().uuid().optional().nullable(),
  default_assignee_id: z.string().uuid().optional().nullable(),
  provider_name: z.string().optional().nullable(),
  is_active: z.boolean().optional()
});

router.put('/:id', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const sourceId = req.params.id;

    const parsed = updateSourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues);
    }

    const data = parsed.data;

    let query = 'UPDATE webhook_sources SET updated_at = NOW(), ';
    const fields = [];
    const values = [tenantId, sourceId];
    let paramIndex = 3;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.field_mapping !== undefined) {
      fields.push(`field_mapping = $${paramIndex++}`);
      values.push(JSON.stringify(data.field_mapping));
    }
    if (data.dedup_field !== undefined) {
      fields.push(`dedup_field = $${paramIndex++}`);
      values.push(data.dedup_field);
    }
    if (data.default_stage_id !== undefined) {
      fields.push(`default_stage_id = $${paramIndex++}`);
      values.push(data.default_stage_id);
    }
    if (data.default_assignee_id !== undefined) {
      fields.push(`default_assignee_id = $${paramIndex++}`);
      values.push(data.default_assignee_id);
    }
    if (data.provider_name !== undefined) {
      fields.push(`provider_name = $${paramIndex++}`);
      values.push(data.provider_name);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    if (fields.length === 0) {
      const existing = await pool.query('SELECT id, name, source_key, dedup_field, default_stage_id, default_assignee_id, provider_name, is_active FROM webhook_sources WHERE tenant_id = $1 AND id = $2', [tenantId, sourceId]);
      if (existing.rows.length === 0) return fail(res, 'NOT_FOUND', 'Source not found', 404);
      return success(res, existing.rows[0]);
    }

    query += fields.join(', ');
    query += ` WHERE tenant_id = $1 AND id = $2 RETURNING id, name, source_key, dedup_field, default_stage_id, default_assignee_id, provider_name, is_active, field_mapping`;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Source not found', 404);
    }

    return success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const sourceId = req.params.id;

    const result = await pool.query(
      'DELETE FROM webhook_sources WHERE tenant_id = $1 AND id = $2 RETURNING id',
      [tenantId, sourceId]
    );

    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Source not found', 404);
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/:id/test', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const sourceId = req.params.id;
    const { samplePayload } = req.body;

    if (!samplePayload || typeof samplePayload !== 'object') {
      return fail(res, 'VALIDATION_ERROR', 'samplePayload must be an object', 400);
    }

    const sourceResult = await pool.query(
      'SELECT field_mapping, provider_name FROM webhook_sources WHERE tenant_id = $1 AND id = $2',
      [tenantId, sourceId]
    );

    if (sourceResult.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Source not found', 404);
    }

    const source = sourceResult.rows[0];
    const mappings = typeof source.field_mapping === 'string' 
      ? JSON.parse(source.field_mapping) 
      : (source.field_mapping || []);

    const leadData = {};
    const customFields = {};

    for (const mapping of mappings) {
      const { sourceField, targetField, transform } = mapping;
      
      const parts = (sourceField || '').split('.');
      let val = samplePayload;
      for (const p of parts) {
        if (val && val[p] !== undefined) {
          val = val[p];
        } else {
          val = undefined;
          break;
        }
      }

      if (val === undefined) continue;

      if (transform === 'lowercase') val = String(val).toLowerCase();
      else if (transform === 'uppercase') val = String(val).toUpperCase();
      else if (transform === 'trim') val = String(val).trim();

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

    if (!leadData.source) {
      leadData.source = source.provider_name || 'webhook';
    }

    return success(res, leadData);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
