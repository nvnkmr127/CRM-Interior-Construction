const logger = require('../utils/logger');
const express = require('express');
const { z } = require('zod');
const { success, fail, paginate } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const dataScope = require('../middleware/dataScope');
const pool = require('../config/db');
const validate = require('../middleware/validate');
const taskRepository = require('../repositories/taskRepository');
const { stripUnauthorizedEdits, filterAllowedFields } = require('../utils/fieldMasker');
const { clearCachePrefix } = require('../utils/cache');
const { createTask } = require('../services/tasks/createTask');
const { updateTask } = require('../services/tasks/updateTask');
const { bulkCreateTasks } = require('../services/tasks/bulkCreateTask');
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/attachments/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  milestoneId: z.union([z.string(), z.number()]).optional().nullable(),
  milestone_id: z.union([z.string(), z.number()]).optional().nullable(),
  assigneeId: z.union([z.string(), z.number()]).optional().nullable(),
  assignee_id: z.union([z.string(), z.number()]).optional().nullable(),
  assigned_to: z.union([z.string(), z.number()]).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  durationDays: z.union([z.number(), z.string()]).optional().nullable(),
  duration_days: z.union([z.number(), z.string()]).optional().nullable(),
  priority: z.string().optional(),
  parentTaskId: z.union([z.string(), z.number()]).optional().nullable(),
  parent_task_id: z.union([z.string(), z.number()]).optional().nullable(),
  roomName: z.string().optional().nullable(),
  room_name: z.string().optional().nullable(),
  estimatedHours: z.union([z.number(), z.string()]).optional().nullable(),
  estimated_hours: z.union([z.number(), z.string()]).optional().nullable(),
  tags: z.array(z.string()).optional()
}).passthrough();

const updateTaskSchema = z.object({
  status: z.string().optional(),
  assigneeId: z.union([z.string(), z.number()]).optional().nullable(),
  assignee_id: z.union([z.string(), z.number()]).optional().nullable(),
  assigned_to: z.union([z.string(), z.number()]).optional().nullable(),
  assignee_name: z.string().optional().nullable(),
  assigneeName: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  durationDays: z.union([z.number(), z.string()]).optional().nullable(),
  duration_days: z.union([z.number(), z.string()]).optional().nullable(),
  priority: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  roomName: z.string().optional().nullable(),
  room_name: z.string().optional().nullable(),
  milestoneId: z.union([z.string(), z.number()]).optional().nullable(),
  milestone_id: z.union([z.string(), z.number()]).optional().nullable(),
  parentTaskId: z.union([z.string(), z.number()]).optional().nullable(),
  parent_task_id: z.union([z.string(), z.number()]).optional().nullable(),
  estimatedHours: z.union([z.number(), z.string()]).optional().nullable(),
  estimated_hours: z.union([z.number(), z.string()]).optional().nullable(),
  actualHours: z.union([z.number(), z.string()]).optional().nullable(),
  actual_hours: z.union([z.number(), z.string()]).optional().nullable(),
  progress: z.union([z.number(), z.string()]).optional().nullable(),
  projectId: z.union([z.string(), z.number()]).optional().nullable(),
  project_id: z.union([z.string(), z.number()]).optional().nullable(),
  tags: z.array(z.string()).optional(),
  updateMode: z.string().optional().nullable()
}).passthrough();

const bulkSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1),
    assigneeId: z.union([z.string(), z.number()]).optional().nullable(),
    milestoneId: z.union([z.string(), z.number()]).optional().nullable(),
    dueDate: z.string().optional().nullable(),
    priority: z.string().optional()
  }).passthrough())
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid())
});

const commentSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty')
});

// GET /api/projects/:projectId/tasks
router.get('/', authorize(['projects:read', 'tasks:read', 'tasks:view']), dataScope('tasks', 'assignee_id', 't'), async (req, res, next) => {
  try {
    const { milestoneId, assigneeId, status, priority, page, limit, allTasks, includeDeleted } = req.query;
    
    const parsedPage = parseInt(page, 10) || 1;
    const isAll = limit === 'all' || allTasks === 'true';
    const parsedLimit = isAll ? 10000 : (parseInt(limit, 10) || 20);

    const result = await taskRepository.findTasks(req.tenantId, {
      projectId: req.params.projectId,
      milestoneId,
      assigneeId,
      status,
      priority,
      page: parsedPage,
      limit: parsedLimit,
      allTasks: allTasks === 'true',
      scopeFilter: req.scopeFilter,
      includeDeleted: includeDeleted === 'true'
    });

    const maskedData = result.data.map(task => filterAllowedFields(task, req.user, 'tasks'));

    return paginate(res, maskedData, result.total, result.page, result.limit);
  } catch (error) {
    logger.error('[Tasks Router] List error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch tasks.', 500);
  }
});

// POST /api/projects/:projectId/tasks
router.post('/', authorize(['projects:manage', 'projects:write', 'tasks:create', 'tasks:manage']), validate(createTaskSchema), async (req, res, next) => {
  try {
    let data = req.body;
    data = stripUnauthorizedEdits(data, req.user, 'tasks');
    data.projectId = req.params.projectId;

    let task = await createTask({ tenantId: req.tenantId, userId: req.user.userId, data });
    await clearCachePrefix(`cache:${req.tenantId}:`).catch(() => {});
    task = filterAllowedFields(task, req.user, 'tasks');
    return success(res, task, {}, 201);
  } catch (error) {
    if (error.status === 400) return fail(res, error.code || 'BAD_REQUEST', error.details || error.message, 400);
    logger.error('[Tasks Router] Create error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create task.', 500);
  }
});

// POST /api/projects/:projectId/tasks/bulk
router.post('/bulk', authorize('projects:manage'), validate(bulkSchema), async (req, res, next) => {
  try {
    const { tasks } = req.body;
    const createdTasks = await bulkCreateTasks({
      tenantId: req.tenantId,
      userId: req.user.userId,
      projectId: req.params.projectId,
      tasks
    });
    return success(res, { created: createdTasks, count: createdTasks.length }, {}, 201);
  } catch (error) {
    if (error.status === 400) return fail(res, error.code || 'BAD_REQUEST', error.details || error.message, 400);
    logger.error('[Tasks Router] Bulk create error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to bulk create tasks.', 500);
  }
});

// PATCH /api/projects/:projectId/tasks/reorder
router.patch('/reorder', authorize('projects:manage'), validate(reorderSchema), async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    await taskRepository.reorderTasks(req.params.projectId, req.tenantId, orderedIds);
    return success(res, { message: 'Tasks reordered successfully' });
  } catch (error) {
    logger.error('[Tasks Router] Reorder error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to reorder tasks.', 500);
  }
});

// PATCH /api/projects/:projectId/tasks/bulk-update
router.patch('/bulk-update', authorize('projects:manage'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return fail(res, 'VALIDATION_ERROR', 'tasks must be an array', 400);
    }

    await client.query('BEGIN');
    for (const t of tasks) {
      const updates = {};
      if (t.startDate !== undefined) updates.start_date = t.startDate;
      if (t.dueDate !== undefined) updates.due_date = t.dueDate;
      if (t.durationDays !== undefined) updates.duration_days = t.durationDays;
      if (t.milestoneId !== undefined) updates.milestone_id = t.milestoneId;
      if (t.status !== undefined) updates.status = t.status;
      if (t.title !== undefined) updates.title = t.title;

      const fields = [];
      const values = [];
      let idx = 1;
      for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        values.push(t.id, req.tenantId, req.params.projectId);
        const query = `
          UPDATE tasks
          SET ${fields.join(', ')}
          WHERE id = $${idx} AND tenant_id = $${idx + 1} AND project_id = $${idx + 2} AND deleted_at IS NULL
        `;
        await client.query(query, values);
      }
    }
    await client.query('COMMIT');
    return success(res, { message: 'Tasks updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[Tasks Router] Bulk update error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to bulk update tasks.', 500);
  } finally {
    client.release();
  }
});

// GET /api/projects/:projectId/tasks/:tid
router.get('/:tid', authorize(['projects:read', 'tasks:read', 'tasks:view']), async (req, res, next) => {
  try {
    let task = await taskRepository.findTaskById(req.tenantId, req.params.tid, true);
    if (!task) return fail(res, 'NOT_FOUND', 'Task not found', 404);
    task = filterAllowedFields(task, req.user, 'tasks');
    return success(res, task);
  } catch (error) {
    logger.error('[Tasks Router] Get ID error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve task.', 500);
  }
});

// PATCH /api/projects/:projectId/tasks/:tid
router.patch('/:tid', authorize(['projects:manage', 'projects:write', 'projects:update', 'tasks:edit', 'tasks:manage', 'tasks:update']), validate(updateTaskSchema), async (req, res, next) => {
  try {
    let data = req.body;
    data = stripUnauthorizedEdits(data, req.user, 'tasks');
    
    const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    // Explicit map camelCase & snake_case payload into service payload keys safely
    const mappedData = {};
    if (data.status !== undefined) mappedData.status = data.status;
    
    const assigneeVal = data.assigneeId !== undefined ? data.assigneeId : (data.assignee_id !== undefined ? data.assignee_id : data.assigned_to);
    if (assigneeVal !== undefined) {
      mappedData.assignee_id = (assigneeVal && isUUID(String(assigneeVal))) ? String(assigneeVal) : null;
    }
    
    const dueDateVal = data.dueDate !== undefined ? data.dueDate : data.due_date;
    if (dueDateVal !== undefined) mappedData.due_date = dueDateVal;
    
    const startDateVal = data.startDate !== undefined ? data.startDate : data.start_date;
    if (startDateVal !== undefined) mappedData.start_date = startDateVal;
    
    const durationVal = data.durationDays !== undefined ? data.durationDays : data.duration_days;
    if (durationVal !== undefined) mappedData.duration_days = durationVal !== null && durationVal !== '' ? parseInt(durationVal, 10) : null;
    
    if (data.priority !== undefined) mappedData.priority = data.priority;
    if (data.title !== undefined) mappedData.title = data.title;
    if (data.description !== undefined) mappedData.description = data.description;
    
    const roomVal = data.roomName !== undefined ? data.roomName : data.room_name;
    if (roomVal !== undefined) mappedData.room_name = roomVal;
    
    const milestoneVal = data.milestoneId !== undefined ? data.milestoneId : data.milestone_id;
    if (milestoneVal !== undefined) {
      mappedData.milestone_id = (milestoneVal && isUUID(String(milestoneVal))) ? String(milestoneVal) : null;
    }
    
    const parentVal = data.parentTaskId !== undefined ? data.parentTaskId : data.parent_task_id;
    if (parentVal !== undefined) {
      mappedData.parent_task_id = (parentVal && isUUID(String(parentVal))) ? String(parentVal) : null;
    }
    
    const projVal = data.projectId !== undefined ? data.projectId : data.project_id;
    if (projVal !== undefined) {
      mappedData.project_id = (projVal && isUUID(String(projVal))) ? String(projVal) : null;
    }
    
    const estVal = data.estimatedHours !== undefined ? data.estimatedHours : data.estimated_hours;
    if (estVal !== undefined) mappedData.estimated_hours = estVal !== null && estVal !== '' ? parseFloat(estVal) : null;
    
    const actVal = data.actualHours !== undefined ? data.actualHours : data.actual_hours;
    if (actVal !== undefined) mappedData.actual_hours = actVal !== null && actVal !== '' ? parseFloat(actVal) : null;
    
    if (data.progress !== undefined) mappedData.progress = data.progress;
    if (data.tags !== undefined) mappedData.tags = data.tags;

    let task = await updateTask({
      tenantId: req.tenantId,
      userId: req.user.userId,
      taskId: req.params.tid,
      data: mappedData
    });
    await clearCachePrefix(`cache:${req.tenantId}:`).catch(() => {});
    task = filterAllowedFields(task, req.user, 'tasks');
    return success(res, task);
  } catch (error) {
    logger.error('[Tasks Router] Update error:', error);
    if (error.status === 400) return fail(res, error.code || 'BAD_REQUEST', error.details || error.message, 400);
    if (error.status === 404 || error.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Task not found', 404);
    return fail(res, 'INTERNAL_ERROR', error.message || 'Failed to update task.', 500);
  }
});

// DELETE /api/projects/:projectId/tasks/:tid
router.delete('/:tid', authorize(['projects:manage', 'projects:write', 'projects:update', 'tasks:delete', 'tasks:manage', 'tasks:write']), async (req, res, next) => {
  try {
    if (req.query.hard === 'true') {
      await taskRepository.hardDeleteTask(req.tenantId, req.params.tid);
    } else {
      await taskRepository.softDeleteTask(req.tenantId, req.params.tid);
    }
    await clearCachePrefix(`cache:${req.tenantId}:`).catch(() => {});
    return res.status(204).send();
  } catch (error) {
    logger.error('[Tasks Router] Delete notice:', error);
    return res.status(204).send();
  }
});

// GET /api/projects/:projectId/tasks/:tid/comments
router.get('/:tid/comments', authorize(['projects:read', 'tasks:read', 'tasks:view']), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, u.name as user_name
      FROM task_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC
    `, [req.params.tid]);
    return success(res, rows);
  } catch (error) {
    logger.error('[Tasks Router] List comments error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch comments.', 500);
  }
});

// POST /api/projects/:projectId/tasks/:tid/comments
router.post('/:tid/comments', authorize(['projects:read', 'tasks:read', 'tasks:view', 'tasks:edit', 'tasks:manage']), validate(commentSchema), async (req, res, next) => {
  try {
    const { content } = req.body;

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
  } catch (error) {
    logger.error('[Tasks Router] Create comment error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create comment.', 500);
  }
});

// GET /api/projects/:projectId/tasks/:tid/attachments
router.get('/:tid/attachments', authorize(['projects:read', 'tasks:read', 'tasks:view']), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM task_attachments 
      WHERE task_id = $1 AND tenant_id = $2 AND status = 'active'
      ORDER BY created_at DESC
    `, [req.params.tid, req.tenantId]);
    
    const formatted = rows.map(r => ({
      id: r.id,
      task_id: r.task_id,
      name: r.name,
      url: r.url,
      type: r.mime_type,
      size: r.size_bytes,
      version: r.version,
      created_at: r.created_at
    }));
    return success(res, formatted);
  } catch (error) {
    logger.error('[Tasks Router] List attachments error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch attachments.', 500);
  }
});

// POST /api/projects/:projectId/tasks/:tid/attachments
router.post('/:tid/attachments', authorize('projects:manage'), upload.array('files'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const tid = req.params.tid;
    
    if (!req.files || req.files.length === 0) {
      return fail(res, 'BAD_REQUEST', 'No files uploaded', 400);
    }
    
    const uploadedAttachments = [];
    for (const file of req.files) {
      const fileUrl = `${process.env.API_URL || 'http://localhost:3000'}/uploads/attachments/${file.filename}`;
      const { rows } = await pool.query(`
        INSERT INTO task_attachments 
        (tenant_id, task_id, name, url, mime_type, size_bytes, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
      `, [tenantId, tid, file.originalname, fileUrl, file.mimetype, file.size, req.user.userId]);
      
      const r = rows[0];
      uploadedAttachments.push({
        id: r.id,
        task_id: r.task_id,
        name: r.name,
        url: r.url,
        type: r.mime_type,
        size: r.size_bytes,
        version: r.version,
        created_at: r.created_at
      });
    }
    
    return success(res, uploadedAttachments, {}, 201);
  } catch (error) {
    logger.error('[Tasks Router] Upload attachments error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to upload attachments.', 500);
  }
});

// PATCH /api/projects/:projectId/tasks/:tid/attachments/:attachmentId
router.patch('/:tid/attachments/:attachmentId', authorize('projects:manage'), upload.single('file'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { attachmentId, tid } = req.params;
    const tenantId = req.tenantId;
    
    if (!req.file) {
      return fail(res, 'BAD_REQUEST', 'No file uploaded', 400);
    }
    
    await client.query('BEGIN');
    const oldQuery = "SELECT * FROM task_attachments WHERE id = $1 AND task_id = $2 AND tenant_id = $3 AND status = 'active' FOR UPDATE";
    const oldRes = await client.query(oldQuery, [attachmentId, tid, tenantId]);
    if (oldRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Attachment not found', 404);
    }
    
    const oldAtt = oldRes.rows[0];
    await client.query("UPDATE task_attachments SET status = 'replaced' WHERE id = $1", [attachmentId]);
    
    const fileUrl = `${process.env.API_URL || 'http://localhost:3000'}/uploads/attachments/${req.file.filename}`;
    const { rows } = await client.query(`
      INSERT INTO task_attachments 
      (tenant_id, task_id, name, url, mime_type, size_bytes, version, parent_id, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [tenantId, tid, req.file.originalname, fileUrl, req.file.mimetype, req.file.size, oldAtt.version + 1, attachmentId, req.user.userId]);
    
    await client.query('COMMIT');
    
    const r = rows[0];
    return success(res, {
      id: r.id,
      task_id: r.task_id,
      name: r.name,
      url: r.url,
      type: r.mime_type,
      size: r.size_bytes,
      version: r.version,
      created_at: r.created_at
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[Tasks Router] Replace attachment error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to replace attachment.', 500);
  } finally {
    client.release();
  }
});

// DELETE /api/projects/:projectId/tasks/:tid/attachments/:attachmentId
router.delete('/:tid/attachments/:attachmentId', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { attachmentId, tid } = req.params;
    const tenantId = req.tenantId;
    
    const { rows } = await pool.query('DELETE FROM task_attachments WHERE id = $1 AND task_id = $2 AND tenant_id = $3 RETURNING *', [attachmentId, tid, tenantId]);
    
    if (rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Attachment not found', 404);
    }
    
    return success(res, { message: 'Attachment deleted successfully' });
  } catch (error) {
    logger.error('[Tasks Router] Delete attachment error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete attachment.', 500);
  }
});

module.exports = router;
