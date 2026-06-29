const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../config/db');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const createPaletteSchema = z.object({
  room_name: z.string().min(1, 'Room name is required'),
  item_name: z.string().min(1, 'Item name is required'),
  brand: z.string().optional().nullable(),
  shade_code: z.string().optional().nullable(),
  finish: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  status: z.enum(['pending_approval', 'approved', 'revision_requested']).optional(),
  sample_category: z.string().optional().nullable(),
  date_presented: z.string().optional().nullable(),
  client_decision: z.enum(['approved', 'rejected', 'deferred']).optional(),
  approved_by_signature: z.string().optional().nullable(),
  boq_item_id: z.string().uuid().optional().nullable()
});

const updatePaletteSchema = z.object({
  room_name: z.string().min(1, 'Room name is required').optional(),
  item_name: z.string().min(1, 'Item name is required').optional(),
  brand: z.string().optional().nullable(),
  shade_code: z.string().optional().nullable(),
  finish: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  status: z.enum(['pending_approval', 'approved', 'revision_requested']).optional(),
  client_feedback: z.string().optional().nullable(),
  sample_category: z.string().optional().nullable(),
  date_presented: z.string().optional().nullable(),
  client_decision: z.enum(['approved', 'rejected', 'deferred']).optional(),
  approved_by_signature: z.string().optional().nullable(),
  boq_item_id: z.string().uuid().optional().nullable()
});

// GET /api/projects/:projectId/material-palettes
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const query = `
      SELECT mp.*, qi.item_name AS boq_item_name, qi.room_or_area AS boq_room_or_area
      FROM project_material_palettes mp
      LEFT JOIN quotation_items qi ON mp.boq_item_id = qi.id
      WHERE mp.project_id = $1 AND mp.tenant_id = $2
      ORDER BY mp.room_name ASC, mp.created_at DESC
    `;

    const { rows } = await pool.query(query, [projectId, tenantId]);
    return success(res, rows);
  } catch (err) {
    console.error('[MaterialPalettes Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch material palettes.', 500);
  }
});

// GET /api/projects/:projectId/material-palettes/boq-items
router.get('/boq-items', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const query = `
      SELECT qi.id, qi.room_or_area, qi.item_name, qi.description, qi.brand, q.quotation_number
      FROM quotation_items qi
      JOIN quotations q ON qi.quotation_id = q.id
      WHERE q.project_id = $1 AND q.tenant_id = $2
      ORDER BY qi.room_or_area ASC, qi.item_name ASC
    `;

    const { rows } = await pool.query(query, [projectId, tenantId]);
    return success(res, rows);
  } catch (err) {
    console.error('[MaterialPalettes Router] BOQ items fetch error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch BOQ items.', 500);
  }
});

// POST /api/projects/:projectId/material-palettes
router.post('/', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const data = createPaletteSchema.parse(req.body);

    const clientApprovedAt = data.client_decision === 'approved' ? new Date() : null;
    const status = data.status || (data.client_decision === 'approved' ? 'approved' : data.client_decision === 'rejected' ? 'revision_requested' : 'pending_approval');

    const query = `
      INSERT INTO project_material_palettes (
        tenant_id, project_id, room_name, item_name, brand, shade_code, finish, image_url, status,
        sample_category, date_presented, client_decision, approved_by_signature, boq_item_id, client_approved_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      tenantId,
      projectId,
      data.room_name,
      data.item_name,
      data.brand || null,
      data.shade_code || null,
      data.finish || null,
      data.image_url || null,
      status,
      data.sample_category || null,
      data.date_presented || null,
      data.client_decision || 'deferred',
      data.approved_by_signature || null,
      data.boq_item_id || null,
      clientApprovedAt
    ]);

    return success(res, rows[0], {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[MaterialPalettes Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create material palette item.', 500);
  }
});

// PUT /api/projects/:projectId/material-palettes/:id
router.put('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const tenantId = req.tenantId;
    const data = updatePaletteSchema.parse(req.body);

    const { rows: existCheck } = await pool.query(
      `SELECT * FROM project_material_palettes WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [id, projectId, tenantId]
    );

    if (existCheck.length === 0) {
      return fail(res, 'NOT_FOUND', 'Material palette item not found.', 404);
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (data.room_name !== undefined) {
      updates.push(`room_name = $${idx++}`);
      values.push(data.room_name);
    }
    if (data.item_name !== undefined) {
      updates.push(`item_name = $${idx++}`);
      values.push(data.item_name);
    }
    if (data.brand !== undefined) {
      updates.push(`brand = $${idx++}`);
      values.push(data.brand);
    }
    if (data.shade_code !== undefined) {
      updates.push(`shade_code = $${idx++}`);
      values.push(data.shade_code);
    }
    if (data.finish !== undefined) {
      updates.push(`finish = $${idx++}`);
      values.push(data.finish);
    }
    if (data.image_url !== undefined) {
      updates.push(`image_url = $${idx++}`);
      values.push(data.image_url);
    }
    if (data.client_feedback !== undefined) {
      updates.push(`client_feedback = $${idx++}`);
      values.push(data.client_feedback);
    }
    if (data.sample_category !== undefined) {
      updates.push(`sample_category = $${idx++}`);
      values.push(data.sample_category);
    }
    if (data.date_presented !== undefined) {
      updates.push(`date_presented = $${idx++}`);
      values.push(data.date_presented);
    }
    if (data.approved_by_signature !== undefined) {
      updates.push(`approved_by_signature = $${idx++}`);
      values.push(data.approved_by_signature);
    }
    if (data.boq_item_id !== undefined) {
      updates.push(`boq_item_id = $${idx++}`);
      values.push(data.boq_item_id);
    }

    if (data.client_decision !== undefined) {
      updates.push(`client_decision = $${idx++}`);
      values.push(data.client_decision);
      
      if (data.client_decision === 'approved') {
        updates.push(`status = $${idx++}`);
        values.push('approved');
        updates.push(`client_approved_at = CURRENT_TIMESTAMP`);
      } else if (data.client_decision === 'rejected') {
        updates.push(`status = $${idx++}`);
        values.push('revision_requested');
        updates.push(`client_approved_at = NULL`);
      } else {
        updates.push(`status = $${idx++}`);
        values.push('pending_approval');
        updates.push(`client_approved_at = NULL`);
      }
    } else if (data.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(data.status);
      if (data.status === 'approved') {
        updates.push(`client_approved_at = CURRENT_TIMESTAMP`);
      }
    }

    if (updates.length === 0) {
      return fail(res, 'BAD_REQUEST', 'No fields to update.', 400);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id, projectId, tenantId);
    const query = `
      UPDATE project_material_palettes
      SET ${updates.join(', ')}
      WHERE id = $${idx++} AND project_id = $${idx++} AND tenant_id = $${idx++}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    return success(res, rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[MaterialPalettes Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update material palette item.', 500);
  }
});

// DELETE /api/projects/:projectId/material-palettes/:id
router.delete('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const tenantId = req.tenantId;

    const { rowCount } = await pool.query(
      `DELETE FROM project_material_palettes WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [id, projectId, tenantId]
    );

    if (rowCount === 0) {
      return fail(res, 'NOT_FOUND', 'Material palette item not found.', 404);
    }

    return success(res, { message: 'Material palette item deleted successfully.' });
  } catch (err) {
    console.error('[MaterialPalettes Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete material palette item.', 500);
  }
});

module.exports = router;
