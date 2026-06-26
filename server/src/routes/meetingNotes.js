const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../db/pool');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const actionItemSchema = z.object({
  description: z.string().min(1, 'Action item description is required'),
  owner_name: z.string().min(1, 'Action item owner is required'),
  due_date: z.string().optional().nullable(),
  status: z.string().optional().default('pending')
});

const meetingNoteSchema = z.object({
  title: z.string().min(1, 'Meeting title is required'),
  meeting_date: z.string().min(1, 'Meeting date is required'),
  attendees: z.array(z.string()).default([]),
  agenda: z.string().optional().nullable(),
  discussion_points: z.string().optional().nullable(),
  decisions: z.string().optional().nullable(),
  action_items: z.array(actionItemSchema).optional().default([])
});

// GET /api/projects/:projectId/meeting-notes
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { tenantId } = req;

    const query = `
      SELECT 
        mn.*,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', mai.id,
              'description', mai.description,
              'owner_name', mai.owner_name,
              'due_date', mai.due_date,
              'status', mai.status
            ) ORDER BY mai.due_date ASC NULLS LAST, mai.created_at ASC)
            FROM meeting_action_items mai
            WHERE mai.meeting_id = mn.id
          ),
          '[]'::json
        ) as action_items
      FROM meeting_notes mn
      WHERE mn.project_id = $1 AND mn.tenant_id = $2
      ORDER BY mn.meeting_date DESC, mn.created_at DESC
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    return success(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/meeting-notes
router.post('/', authorize('projects:manage'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { projectId } = req.params;
    const { tenantId } = req;
    const body = meetingNoteSchema.parse(req.body);

    await client.query('BEGIN');

    const noteQuery = `
      INSERT INTO meeting_notes (
        project_id, tenant_id, title, meeting_date, attendees, agenda, discussion_points, decisions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const noteRes = await client.query(noteQuery, [
      projectId,
      tenantId,
      body.title,
      body.meeting_date,
      JSON.stringify(body.attendees),
      body.agenda,
      body.discussion_points,
      body.decisions
    ]);

    const newNote = noteRes.rows[0];
    const insertedActionItems = [];

    if (body.action_items && body.action_items.length > 0) {
      for (const item of body.action_items) {
        const itemQuery = `
          INSERT INTO meeting_action_items (
            meeting_id, project_id, tenant_id, description, owner_name, due_date, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;
        const itemRes = await client.query(itemQuery, [
          newNote.id,
          projectId,
          tenantId,
          item.description,
          item.owner_name,
          item.due_date || null,
          item.status || 'pending'
        ]);
        insertedActionItems.push(itemRes.rows[0]);
      }
    }

    await client.query('COMMIT');
    newNote.action_items = insertedActionItems;
    return success(res, newNote, 201);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    }
    next(error);
  } finally {
    client.release();
  }
});

// PATCH /api/projects/:projectId/meeting-notes/:id
router.patch('/:id', authorize('projects:manage'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { projectId, id } = req.params;
    const { tenantId } = req;
    const body = meetingNoteSchema.parse(req.body);

    await client.query('BEGIN');

    const updateNoteQuery = `
      UPDATE meeting_notes 
      SET 
        title = $1, 
        meeting_date = $2, 
        attendees = $3, 
        agenda = $4, 
        discussion_points = $5, 
        decisions = $6,
        updated_at = NOW()
      WHERE id = $7 AND project_id = $8 AND tenant_id = $9
      RETURNING *
    `;
    const noteRes = await client.query(updateNoteQuery, [
      body.title,
      body.meeting_date,
      JSON.stringify(body.attendees),
      body.agenda,
      body.discussion_points,
      body.decisions,
      id,
      projectId,
      tenantId
    ]);

    if (noteRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Meeting note not found.', 404);
    }

    const updatedNote = noteRes.rows[0];

    // Delete existing action items
    await client.query('DELETE FROM meeting_action_items WHERE meeting_id = $1', [id]);

    const insertedActionItems = [];
    if (body.action_items && body.action_items.length > 0) {
      for (const item of body.action_items) {
        const itemQuery = `
          INSERT INTO meeting_action_items (
            meeting_id, project_id, tenant_id, description, owner_name, due_date, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;
        const itemRes = await client.query(itemQuery, [
          id,
          projectId,
          tenantId,
          item.description,
          item.owner_name,
          item.due_date || null,
          item.status || 'pending'
        ]);
        insertedActionItems.push(itemRes.rows[0]);
      }
    }

    await client.query('COMMIT');
    updatedNote.action_items = insertedActionItems;
    return success(res, updatedNote);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    }
    next(error);
  } finally {
    client.release();
  }
});

// DELETE /api/projects/:projectId/meeting-notes/:id
router.delete('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const { tenantId } = req;

    const result = await pool.query(
      'DELETE FROM meeting_notes WHERE id = $1 AND project_id = $2 AND tenant_id = $3 RETURNING *',
      [id, projectId, tenantId]
    );

    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Meeting note not found.', 404);
    }

    return success(res, { message: 'Meeting note deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/meeting-notes/:id/action-items/:itemId/toggle
router.post('/:id/action-items/:itemId/toggle', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId, id, itemId } = req.params;
    const { tenantId } = req;
    const { status } = req.body;

    if (status !== 'pending' && status !== 'completed') {
      return fail(res, 'VALIDATION_ERROR', 'Status must be pending or completed', 400);
    }

    const result = await pool.query(
      `UPDATE meeting_action_items 
       SET status = $1 
       WHERE id = $2 AND meeting_id = $3 AND project_id = $4 AND tenant_id = $5 
       RETURNING *`,
      [status, itemId, id, projectId, tenantId]
    );

    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Action item not found.', 404);
    }

    return success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
