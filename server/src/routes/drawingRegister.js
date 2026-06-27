const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../config/db');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const drawingRegisterSchema = z.object({
  drawingNumber: z.string().min(1, 'Drawing number is required'),
  revisionCode: z.string().min(1, 'Revision code is required'),
  title: z.string().min(1, 'Title is required'),
  status: z.enum(['issued_for_approval', 'issued_for_construction', 'superseded', 'issued_for_info']),
  issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Issued date must be in YYYY-MM-DD format'),
  documentId: z.string().uuid().optional().nullable()
});

const updateDrawingRegisterSchema = z.object({
  drawingNumber: z.string().min(1).optional(),
  revisionCode: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  status: z.enum(['issued_for_approval', 'issued_for_construction', 'superseded', 'issued_for_info']).optional(),
  issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  documentId: z.string().uuid().optional().nullable()
});

// GET /api/projects/:projectId/drawing-register
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const query = `
      SELECT dr.*, u.name as issued_by_name, d.name as document_name, d.storage_key
      FROM drawing_register dr
      LEFT JOIN users u ON dr.issued_by = u.id
      LEFT JOIN documents d ON dr.document_id = d.id
      WHERE dr.project_id = $1 AND dr.tenant_id = $2
      ORDER BY dr.drawing_number ASC, dr.created_at DESC
    `;
    const { rows } = await pool.query(query, [projectId, tenantId]);
    return success(res, rows);
  } catch (err) {
    console.error('[DrawingRegister Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch drawing register.', 500);
  }
});

// POST /api/projects/:projectId/drawing-register
router.post('/', authorize('projects:manage'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = drawingRegisterSchema.parse(req.body);

    await client.query('BEGIN');

    // Check if combination already exists
    const { rows: existing } = await client.query(
      `SELECT id FROM drawing_register 
       WHERE project_id = $1 AND tenant_id = $2 AND drawing_number = $3 AND revision_code = $4`,
      [projectId, tenantId, data.drawingNumber, data.revisionCode]
    );

    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return fail(res, 'CONFLICT', 'Drawing revision already registered.', 409);
    }

    // If the new revision is not superseded, mark previous revisions of the same drawing number in this project as superseded
    if (data.status !== 'superseded') {
      await client.query(
        `UPDATE drawing_register 
         SET is_superseded = TRUE, status = 'superseded' 
         WHERE project_id = $1 AND tenant_id = $2 AND drawing_number = $3 AND is_superseded = FALSE`,
        [projectId, tenantId, data.drawingNumber]
      );
    }

    const isSuperseded = data.status === 'superseded';

    const insertQuery = `
      INSERT INTO drawing_register (
        tenant_id, project_id, drawing_number, revision_code, title, status, issued_date, issued_by, is_superseded, document_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *
    `;

    const { rows } = await client.query(insertQuery, [
      tenantId,
      projectId,
      data.drawingNumber,
      data.revisionCode,
      data.title,
      data.status,
      data.issuedDate,
      userId,
      isSuperseded,
      data.documentId || null
    ]);

    await client.query('COMMIT');
    return success(res, rows[0], {}, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[DrawingRegister Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to register drawing.', 500);
  } finally {
    client.release();
  }
});

// PUT /api/projects/:projectId/drawing-register/:id
router.put('/:id', authorize('projects:manage'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId, id } = req.params;
    const tenantId = req.tenantId;

    const data = updateDrawingRegisterSchema.parse(req.body);

    await client.query('BEGIN');

    // Fetch the drawing record first
    const { rows: orig } = await client.query(
      `SELECT * FROM drawing_register WHERE id = $1 AND project_id = $2 AND tenant_id = $3 FOR UPDATE`,
      [id, projectId, tenantId]
    );

    if (orig.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Drawing register entry not found.', 404);
    }

    const record = orig[0];

    // Build update fields dynamically
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.drawingNumber !== undefined) {
      fields.push(`drawing_number = $${idx++}`);
      values.push(data.drawingNumber);
    }
    if (data.revisionCode !== undefined) {
      fields.push(`revision_code = $${idx++}`);
      values.push(data.revisionCode);
    }
    if (data.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(data.title);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
      if (data.status === 'superseded') {
        fields.push(`is_superseded = $${idx++}`);
        values.push(true);
      } else if (record.status === 'superseded') {
        fields.push(`is_superseded = $${idx++}`);
        values.push(false);
      }
    }
    if (data.issuedDate !== undefined) {
      fields.push(`issued_date = $${idx++}`);
      values.push(data.issuedDate);
    }
    if (data.documentId !== undefined) {
      fields.push(`document_id = $${idx++}`);
      values.push(data.documentId);
    }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(id, projectId, tenantId);
      const updateQuery = `
        UPDATE drawing_register
        SET ${fields.join(', ')}
        WHERE id = $${idx++} AND project_id = $${idx++} AND tenant_id = $${idx++}
        RETURNING *
      `;
      const { rows: updated } = await client.query(updateQuery, values);
      
      // If drawing number or revision code changed, verify uniqueness
      if (data.drawingNumber !== undefined || data.revisionCode !== undefined) {
        const checkNum = data.drawingNumber !== undefined ? data.drawingNumber : record.drawing_number;
        const checkRev = data.revisionCode !== undefined ? data.revisionCode : record.revision_code;

        const { rows: dup } = await client.query(
          `SELECT id FROM drawing_register 
           WHERE project_id = $1 AND tenant_id = $2 AND drawing_number = $3 AND revision_code = $4 AND id != $5`,
          [projectId, tenantId, checkNum, checkRev, id]
        );
        if (dup.length > 0) {
          await client.query('ROLLBACK');
          return fail(res, 'CONFLICT', 'Drawing revision combination already exists.', 409);
        }
      }

      await client.query('COMMIT');
      return success(res, updated[0]);
    }

    await client.query('COMMIT');
    return success(res, record);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[DrawingRegister Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update drawing.', 500);
  } finally {
    client.release();
  }
});

// DELETE /api/projects/:projectId/drawing-register/:id
router.delete('/:id', authorize('projects:manage'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId, id } = req.params;
    const tenantId = req.tenantId;

    await client.query('BEGIN');

    // 1. Get the drawing number and check existence
    const { rows: exist } = await client.query(
      `SELECT drawing_number, is_superseded FROM drawing_register WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [id, projectId, tenantId]
    );

    if (exist.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Drawing register entry not found.', 404);
    }

    const deletedDrawing = exist[0];

    // 2. Delete the drawing record
    await client.query(
      `DELETE FROM drawing_register WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [id, projectId, tenantId]
    );

    // 3. If we deleted the active revision, restore the latest remaining revision
    if (!deletedDrawing.is_superseded) {
      const { rows: remaining } = await client.query(
        `SELECT id, status FROM drawing_register 
         WHERE project_id = $1 AND tenant_id = $2 AND drawing_number = $3
         ORDER BY created_at DESC LIMIT 1`,
        [projectId, tenantId, deletedDrawing.drawing_number]
      );

      if (remaining.length > 0) {
        const latestRemainingId = remaining[0].id;
        const newStatus = remaining[0].status === 'superseded' ? 'issued_for_approval' : remaining[0].status;
        
        await client.query(
          `UPDATE drawing_register 
           SET is_superseded = FALSE, status = $1, updated_at = NOW() 
           WHERE id = $2`,
          [newStatus, latestRemainingId]
        );
      }
    }

    await client.query('COMMIT');
    return success(res, null, { message: 'Drawing register entry deleted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DrawingRegister Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete drawing.', 500);
  } finally {
    client.release();
  }
});

module.exports = router;
