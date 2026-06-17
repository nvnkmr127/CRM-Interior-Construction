const express = require('express');
const { z } = require('zod');
const pool = require('../../db/pool');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { success, fail } = require('../../utils/response');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const query = `
      SELECT * FROM lead_stages
      WHERE tenant_id = $1
      ORDER BY sort_order ASC
    `;
    const result = await pool.query(query, [tenantId]);
    return success(res, result.rows);
  } catch (error) {
    next(error);
  }
});

const createStageSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  sort_order: z.number().int().optional(),
  is_won: z.boolean().optional(),
  is_lost: z.boolean().optional(),
  mandatory_fields: z.array(z.string()).optional()
});

router.post('/', authorize('config:manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const parsed = createStageSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues);
    }

    const { name, color, sort_order, is_won, is_lost, mandatory_fields } = parsed.data;

    const query = `
      INSERT INTO lead_stages (
        tenant_id, name, color, sort_order, is_won, is_lost, mandatory_fields
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      ) RETURNING *
    `;

    const values = [
      tenantId,
      name,
      color || '#6B6B6B',
      sort_order || 0,
      is_won || false,
      is_lost || false,
      JSON.stringify(mandatory_fields || [])
    ];

    const result = await pool.query(query, values);
    return success(res, result.rows[0], {}, 201);
  } catch (error) {
    next(error);
  }
});

const updateStageSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  mandatory_fields: z.array(z.string()).optional()
});

router.put('/:id', authorize('config:manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);
    
    const stageId = req.params.id;

    const parsed = updateStageSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues);
    }

    const { name, color, mandatory_fields } = parsed.data;

    let query = 'UPDATE lead_stages SET ';
    const fields = [];
    const values = [tenantId, stageId];
    let paramIndex = 3;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (color !== undefined) {
      fields.push(`color = $${paramIndex++}`);
      values.push(color);
    }
    if (mandatory_fields !== undefined) {
      fields.push(`mandatory_fields = $${paramIndex++}`);
      values.push(JSON.stringify(mandatory_fields));
    }

    if (fields.length === 0) {
      const existing = await pool.query('SELECT * FROM lead_stages WHERE tenant_id = $1 AND id = $2', [tenantId, stageId]);
      if (existing.rows.length === 0) return fail(res, 'NOT_FOUND', 'Stage not found', 404);
      return success(res, existing.rows[0]);
    }

    query += fields.join(', ');
    query += ` WHERE tenant_id = $1 AND id = $2 RETURNING *`;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Stage not found', 404);
    }

    return success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid())
});

router.patch('/reorder', authorize('config:manage'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues);
    }

    const { orderedIds } = parsed.data;

    await client.query('BEGIN');

    for (let i = 0; i < orderedIds.length; i++) {
      const stageId = orderedIds[i];
      await client.query(
        'UPDATE lead_stages SET sort_order = $1 WHERE tenant_id = $2 AND id = $3',
        [i + 1, tenantId, stageId]
      );
    }

    await client.query('COMMIT');
    
    // Fetch updated ordered list
    const result = await pool.query(
      'SELECT * FROM lead_stages WHERE tenant_id = $1 ORDER BY sort_order ASC',
      [tenantId]
    );

    return success(res, result.rows);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.delete('/:id', authorize('config:manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const stageId = req.params.id;

    // Check if any leads exist in this stage
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND stage_id = $2 AND deleted_at IS NULL',
      [tenantId, stageId]
    );
    const leadCount = parseInt(countResult.rows[0].count, 10);

    if (leadCount > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Cannot delete stage because leads are currently assigned to it.',
          count: leadCount
        },
        timestamp: new Date().toISOString()
      });
    }

    const deleteResult = await pool.query(
      'DELETE FROM lead_stages WHERE tenant_id = $1 AND id = $2 RETURNING id',
      [tenantId, stageId]
    );

    if (deleteResult.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Stage not found', 404);
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
