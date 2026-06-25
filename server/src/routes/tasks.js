const express = require('express');
const { z } = require('zod');
const { success, fail, paginate } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../config/db');
const taskRepository = require('../repositories/taskRepository');
const { createTask } = require('../services/tasks/createTask');
const { updateTask } = require('../services/tasks/updateTask');
const { bulkCreateTasks } = require('../services/tasks/bulkCreateTask');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  milestoneId: z.string().uuid().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.string().optional(),
  parentTaskId: z.string().uuid().optional().nullable()
});

const updateTaskSchema = z.object({
  status: z.string().optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.string().optional(),
  title: z.string().optional()
});

const bulkSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1),
    assigneeId: z.string().uuid().optional().nullable(),
    milestoneId: z.string().uuid().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    priority: z.string().optional()
  }))
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid())
});

const commentSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty')
});

// GET /api/projects/:projectId/tasks
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { milestoneId, assigneeId, status, priority, page, limit } = req.query;
    
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 20;

    const result = await taskRepository.findTasks(req.tenantId, {
      projectId: req.params.projectId,
      milestoneId,
      assigneeId,
      status,
      priority,
      page: parsedPage,
      limit: parsedLimit
    });

    return paginate(res, result.data, result.total, result.page, result.limit);
  } catch (err) {
    console.error('[Tasks Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch tasks.', 500);
  }
});

// POST /api/projects/:projectId/tasks
router.post('/', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = createTaskSchema.parse(req.body);
    data.projectId = req.params.projectId;

    const task = await createTask({ tenantId: req.tenantId, userId: req.user.userId, data });
    return success(res, task, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.status === 400) return fail(res, 'BAD_REQUEST', err.details || err.message, 400);
    console.error('[Tasks Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create task.', 500);
  }
});

// POST /api/projects/:projectId/tasks/bulk
router.post('/bulk', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { tasks } = bulkSchema.parse(req.body);
    const createdTasks = await bulkCreateTasks({
      tenantId: req.tenantId,
      userId: req.user.userId,
      projectId: req.params.projectId,
      tasks
    });
    return success(res, { created: createdTasks, count: createdTasks.length }, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.status === 400) return fail(res, 'BAD_REQUEST', err.details || err.message, 400);
    console.error('[Tasks Router] Bulk create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to bulk create tasks.', 500);
  }
});

// PATCH /api/projects/:projectId/tasks/reorder
router.patch('/reorder', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { orderedIds } = reorderSchema.parse(req.body);
    await taskRepository.reorderTasks(req.params.projectId, req.tenantId, orderedIds);
    return success(res, { message: 'Tasks reordered successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[Tasks Router] Reorder error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to reorder tasks.', 500);
  }
});

// GET /api/projects/:projectId/tasks/:tid
router.get('/:tid', authorize('projects:read'), async (req, res, next) => {
  try {
    const task = await taskRepository.findTaskById(req.tenantId, req.params.tid);
    if (!task) return fail(res, 'NOT_FOUND', 'Task not found', 404);
    return success(res, task);
  } catch (err) {
    console.error('[Tasks Router] Get ID error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve task.', 500);
  }
});

// PATCH /api/projects/:projectId/tasks/:tid
router.patch('/:tid', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = updateTaskSchema.parse(req.body);
    
    // Explicit map camelCase payload into service payload keys safely
    const mappedData = {};
    if (data.status) mappedData.status = data.status;
    if (data.assigneeId !== undefined) mappedData.assignee_id = data.assigneeId;
    if (data.dueDate !== undefined) mappedData.due_date = data.dueDate;
    if (data.priority) mappedData.priority = data.priority;
    if (data.title) mappedData.title = data.title;

    const task = await updateTask({
      tenantId: req.tenantId,
      userId: req.user.userId,
      taskId: req.params.tid,
      data: mappedData
    });
    return success(res, task);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.status === 400) return fail(res, 'BAD_REQUEST', err.details || err.message, 400);
    if (err.status === 404 || err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Task not found', 404);
    console.error('[Tasks Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update task.', 500);
  }
});

// DELETE /api/projects/:projectId/tasks/:tid
router.delete('/:tid', authorize('projects:manage'), async (req, res, next) => {
  try {
    await taskRepository.softDeleteTask(req.tenantId, req.params.tid);
    return res.status(204).send();
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Task not found', 404);
    console.error('[Tasks Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete task.', 500);
  }
});

// GET /api/projects/:projectId/tasks/:tid/comments
router.get('/:tid/comments', authorize('projects:read'), async (req, res, next) => {
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
    console.error('[Tasks Router] List comments error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch comments.', 500);
  }
});

// POST /api/projects/:projectId/tasks/:tid/comments
router.post('/:tid/comments', authorize('projects:read'), async (req, res, next) => {
  try {
    const { content } = commentSchema.parse(req.body);

    const task = await taskRepository.findTaskById(req.tenantId, req.params.tid);
    if (!task) return fail(res, 'NOT_FOUND', 'Task not found', 404);

    const { rows } = await pool.query(`
      INSERT INTO task_comments (task_id, user_id, content)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.params.tid, req.user.userId, content]);

    // Attach username dynamically so the frontend doesn't need to refresh the comment tree immediately
    const comment = rows[0];
    comment.user_name = req.user.name;

    return success(res, comment, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[Tasks Router] Create comment error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create comment.', 500);
  }
});

module.exports = router;
