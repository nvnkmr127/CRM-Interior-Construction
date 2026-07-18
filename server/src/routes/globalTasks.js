const express = require('express');
const { z } = require('zod');
const { success, fail, paginate } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const pool = require('../config/db');
const taskRepository = require('../repositories/taskRepository');
const { createTask } = require('../services/tasks/createTask');
const { updateTask } = require('../services/tasks/updateTask');

const router = express.Router();
router.use(authenticate);

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  projectId: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  milestoneId: z.string().uuid().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  priority: z.string().optional(),
  status: z.string().optional(),
  parentTaskId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  customFields: z.object({}).passthrough().optional().nullable(),
  custom_fields: z.object({}).passthrough().optional().nullable()
});

const updateTaskSchema = z.object({
  status: z.string().optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  priority: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  customFields: z.object({}).passthrough().optional().nullable(),
  custom_fields: z.object({}).passthrough().optional().nullable()
});

const commentSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty')
});

// GET /api/tasks
router.get('/', async (req, res, next) => {
  try {
    let { assigneeId, status, priority, dueWithin, page, limit, lead_id, leadId } = req.query;
    
    // For "My Tasks", assigneeId is 'me'. Replace it with the logged in user's ID.
    if (assigneeId === 'me') {
      assigneeId = req.user.id || req.user.userId;
    }

    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 50;

    const result = await taskRepository.findTasks(req.tenantId, {
      projectId: null, // Global query, ignore specific project
      assigneeId,
      status,
      priority,
      dueWithin,
      page: parsedPage,
      limit: parsedLimit,
      leadId: leadId || lead_id || null
    });

    return paginate(res, result.data, result.total, result.page, result.limit);
  } catch (err) {
    console.error('[Global Tasks Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch global tasks.', 500);
  }
});

// POST /api/tasks
router.post('/', validate(createTaskSchema), async (req, res, next) => {
  try {
    const parsed = req.body;
    
    const data = {
      title: parsed.title,
      projectId: parsed.projectId || parsed.project_id || null,
      leadId: parsed.leadId || parsed.lead_id || null,
      milestoneId: parsed.milestoneId || null,
      assigneeId: parsed.assigneeId || parsed.assigned_to || null,
      dueDate: parsed.dueDate || parsed.due_date || null,
      priority: parsed.priority || 'medium',
      status: parsed.status || 'open',
      parentTaskId: parsed.parentTaskId || null,
      description: parsed.description || null,
      tags: parsed.tags || [],
      custom_fields: parsed.customFields || parsed.custom_fields || {}
    };

    const task = await createTask({ tenantId: req.tenantId, userId: req.user.userId, data });
    return success(res, task, {}, 201);
  } catch (err) {
    if (err.status === 400) return fail(res, 'BAD_REQUEST', err.details || err.message, 400);
    console.error('[Global Tasks Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create task.', 500);
  }
});

// GET /api/tasks/:tid
router.get('/:tid', async (req, res, next) => {
  try {
    const task = await taskRepository.findTaskById(req.tenantId, req.params.tid);
    if (!task) return fail(res, 'NOT_FOUND', 'Task not found', 404);
    return success(res, task);
  } catch (err) {
    console.error('[Global Tasks Router] Get ID error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve task.', 500);
  }
});

// PATCH /api/tasks/:tid
router.patch('/:tid', validate(updateTaskSchema), async (req, res, next) => {
  try {
    const data = req.body;
    
    const mappedData = {};
    if (data.status) mappedData.status = data.status;
    if (data.assigneeId !== undefined) mappedData.assignee_id = data.assigneeId;
    if (data.assigned_to !== undefined) mappedData.assignee_id = data.assigned_to;
    if (data.dueDate !== undefined) mappedData.due_date = data.dueDate;
    if (data.due_date !== undefined) mappedData.due_date = data.due_date;
    if (data.priority) mappedData.priority = data.priority;
    if (data.title) mappedData.title = data.title;
    if (data.description !== undefined) mappedData.description = data.description;
    if (data.tags !== undefined) mappedData.tags = data.tags;
    if (data.customFields !== undefined) mappedData.custom_fields = data.customFields;
    if (data.custom_fields !== undefined) mappedData.custom_fields = data.custom_fields;

    const task = await updateTask({
      tenantId: req.tenantId,
      userId: req.user.userId,
      taskId: req.params.tid,
      data: mappedData
    });
    return success(res, task);
  } catch (err) {
    if (err.status === 400) return fail(res, 'BAD_REQUEST', err.details || err.message, 400);
    if (err.status === 404 || err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Task not found', 404);
    console.error('[Global Tasks Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update task.', 500);
  }
});

// DELETE /api/tasks/:tid
router.delete('/:tid', async (req, res, next) => {
  try {
    await taskRepository.softDeleteTask(req.tenantId, req.params.tid);
    return res.status(204).send();
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Task not found', 404);
    console.error('[Global Tasks Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete task.', 500);
  }
});

// GET /api/tasks/:tid/comments
router.get('/:tid/comments', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, u.name as user_name
      FROM task_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC
    `, [req.params.tid]);
    return success(res, rows);
  } catch (err) {
    console.error('[Global Tasks Router] List comments error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch comments.', 500);
  }
});

// POST /api/tasks/:tid/comments
router.post('/:tid/comments', validate(commentSchema), async (req, res, next) => {
  try {
    const { content } = req.body;

    const task = await taskRepository.findTaskById(req.tenantId, req.params.tid);
    if (!task) return fail(res, 'NOT_FOUND', 'Task not found', 404);

    const { rows } = await pool.query(`
      INSERT INTO task_comments (task_id, user_id, content)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.params.tid, req.user.userId, content]);

    const comment = rows[0];
    comment.user_name = req.user.name;

    return success(res, comment, {}, 201);
  } catch (err) {
    console.error('[Global Tasks Router] Create comment error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create comment.', 500);
  }
});

module.exports = router;
