const logger = require('../utils/logger');
const express = require('express');
const { z } = require('zod');
const { success, fail, paginate } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const pool = require('../config/db');
const taskRepository = require('../repositories/taskRepository');
const { createTask } = require('../services/tasks/createTask');
const { updateTask } = require('../services/tasks/updateTask');
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
    let { assigneeId, status, priority, dueWithin, page, limit, lead_id, leadId, includeDeleted } = req.query;
    
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
      leadId: leadId || lead_id || null,
      includeDeleted: includeDeleted === 'true'
    });

    return paginate(res, result.data, result.total, result.page, result.limit);
  } catch (error) {
    logger.error('[Global Tasks Router] List error:', error);
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
  } catch (error) {
    if (error.status === 400) return fail(res, 'BAD_REQUEST', error.details || error.message, 400);
    logger.error('[Global Tasks Router] Create error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create task.', 500);
  }
});

// GET /api/tasks/:tid
router.get('/:tid', async (req, res, next) => {
  try {
    const task = await taskRepository.findTaskById(req.tenantId, req.params.tid, true);
    if (!task) return fail(res, 'NOT_FOUND', 'Task not found', 404);
    return success(res, task);
  } catch (error) {
    logger.error('[Global Tasks Router] Get ID error:', error);
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
  } catch (error) {
    if (error.status === 400) return fail(res, 'BAD_REQUEST', error.details || error.message, 400);
    if (error.status === 404 || error.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Task not found', 404);
    logger.error('[Global Tasks Router] Update error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update task.', 500);
  }
});

// DELETE /api/tasks/:tid
router.delete('/:tid', async (req, res, next) => {
  try {
    if (req.query.hard === 'true') {
      await taskRepository.hardDeleteTask(req.tenantId, req.params.tid);
    } else {
      await taskRepository.softDeleteTask(req.tenantId, req.params.tid);
    }
    return res.status(204).send();
  } catch (error) {
    if (error.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Task not found', 404);
    logger.error('[Global Tasks Router] Delete error:', error);
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
  } catch (error) {
    logger.error('[Global Tasks Router] List comments error:', error);
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
  } catch (error) {
    logger.error('[Global Tasks Router] Create comment error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create comment.', 500);
  }
});

// GET /api/tasks/:tid/attachments
router.get('/:tid/attachments', async (req, res, next) => {
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
    logger.error('[Global Tasks Router] List attachments error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch attachments.', 500);
  }
});

// POST /api/tasks/:tid/attachments
router.post('/:tid/attachments', upload.array('files'), async (req, res, next) => {
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
    logger.error('[Global Tasks Router] Upload attachments error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to upload attachments.', 500);
  }
});

// PATCH /api/tasks/:tid/attachments/:attachmentId
router.patch('/:tid/attachments/:attachmentId', upload.single('file'), async (req, res, next) => {
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
    logger.error('[Global Tasks Router] Replace attachment error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to replace attachment.', 500);
  } finally {
    client.release();
  }
});

// DELETE /api/tasks/:tid/attachments/:attachmentId
router.delete('/:tid/attachments/:attachmentId', async (req, res, next) => {
  try {
    const { attachmentId, tid } = req.params;
    const tenantId = req.tenantId;
    
    const { rows } = await pool.query('DELETE FROM task_attachments WHERE id = $1 AND task_id = $2 AND tenant_id = $3 RETURNING *', [attachmentId, tid, tenantId]);
    
    if (rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Attachment not found', 404);
    }
    
    return success(res, { message: 'Attachment deleted successfully' });
  } catch (error) {
    logger.error('[Global Tasks Router] Delete attachment error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete attachment.', 500);
  }
});

module.exports = router;
