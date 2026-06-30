const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const workActivityRepository = require('../repositories/workActivityRepository');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const createActivitySchema = z.object({
  phase_id: z.string().uuid().optional().nullable(),
  room_name: z.string().min(1, 'Room name is required'),
  trade: z.string().min(1, 'Trade is required'),
  activity_name: z.string().min(1, 'Activity name is required'),
  description: z.string().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  qc_checklist: z.array(z.object({
    id: z.string(),
    label: z.string(),
    required: z.boolean().optional(),
    is_checked: z.boolean().optional()
  })).optional()
});

const updateActivitySchema = z.object({
  phase_id: z.string().uuid().optional().nullable(),
  room_name: z.string().optional(),
  trade: z.string().optional(),
  activity_name: z.string().optional(),
  description: z.string().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'completed']).optional(),
  notes: z.string().optional().nullable(),
  qc_checklist: z.array(z.object({
    id: z.string(),
    label: z.string(),
    required: z.boolean().optional(),
    is_checked: z.boolean().optional()
  })).optional()
});

const generateSchema = z.object({
  phaseId: z.string().uuid().optional().nullable(),
  roomName: z.string().min(1, 'Room name is required'),
  trade: z.string().min(1, 'Trade is required')
});

// GET /api/projects/:projectId/work-activities
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const { phaseId, trade, roomName, status } = req.query;
    const activities = await workActivityRepository.findActivities(req.tenantId, req.params.projectId, {
      phaseId,
      trade,
      roomName,
      status
    });
    return success(res, activities);
  } catch (err) {
    console.error('[WorkActivities Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch work activities.', 500);
  }
});

// GET /api/projects/:projectId/work-activities/templates
router.get('/templates', authorize('projects:read'), async (req, res) => {
  try {
    const { trade, roomType } = req.query;
    const templates = await workActivityRepository.findTemplates(trade, roomType);
    return success(res, templates);
  } catch (err) {
    console.error('[WorkActivities Router] Templates list error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch templates.', 500);
  }
});

// POST /api/projects/:projectId/work-activities
router.post('/', authorize('projects:manage'), async (req, res) => {
  try {
    const data = createActivitySchema.parse(req.body);
    data.project_id = req.params.projectId;

    const activity = await workActivityRepository.createActivity(req.tenantId, data);
    return success(res, activity, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[WorkActivities Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create work activity.', 500);
  }
});

// POST /api/projects/:projectId/work-activities/generate
router.post('/generate', authorize('projects:manage'), async (req, res) => {
  try {
    const { phaseId, roomName, trade } = generateSchema.parse(req.body);
    const created = await workActivityRepository.generateActivities(
      req.tenantId,
      req.params.projectId,
      phaseId,
      roomName,
      trade
    );
    return success(res, created, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[WorkActivities Router] Generate error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to generate activities.', 500);
  }
});

// PATCH /api/projects/:projectId/work-activities/:id
router.patch('/:id', authorize('projects:manage'), async (req, res) => {
  try {
    const updates = updateActivitySchema.parse(req.body);

    if (updates.status === 'completed' && req.user?.role !== 'superadmin') {
      const perms = req.user?.permissions || [];
      if (!perms.includes('qc:approve')) {
        return fail(res, 'FORBIDDEN', 'Forbidden: only QC officers with qc:approve permission can close QC inspections.', 403);
      }
    }

    const activity = await workActivityRepository.updateActivity(
      req.params.id,
      req.tenantId,
      updates,
      req.user?.userId
    );
    return success(res, activity);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.status === 400) return fail(res, err.code || 'BAD_REQUEST', err.message, 400);
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Work activity not found.', 404);
    console.error('[WorkActivities Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update work activity.', 500);
  }
});

// DELETE /api/projects/:projectId/work-activities/:id
router.delete('/:id', authorize('projects:manage'), async (req, res) => {
  try {
    await workActivityRepository.deleteActivity(req.params.id, req.tenantId);
    return success(res, { message: 'Work activity deleted successfully' });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Work activity not found.', 404);
    console.error('[WorkActivities Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete work activity.', 500);
  }
});

// Import pool
const pool = require('../config/db');

// GET /api/projects/:projectId/work-activities/dependencies
router.get('/dependencies', authorize('projects:read'), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT wad.*,
             pwa1.activity_name as activity_name, pwa1.trade as activity_trade, pwa1.room_name as activity_room,
             pwa2.activity_name as depends_on_activity_name, pwa2.trade as depends_on_activity_trade, pwa2.room_name as depends_on_activity_room
      FROM work_activity_dependencies wad
      JOIN project_work_activities pwa1 ON wad.activity_id = pwa1.id
      JOIN project_work_activities pwa2 ON wad.depends_on_activity_id = pwa2.id
      WHERE wad.project_id = $1 AND wad.tenant_id = $2
    `, [req.params.projectId, req.tenantId]);
    return success(res, rows);
  } catch (err) {
    console.error('[WorkActivities Router] Dependencies list error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch work activity dependencies.', 500);
  }
});

async function checkCircularDependency(tenantId, projectId, activityId, dependsOnActivityId) {
  const visited = new Set();
  const queue = [dependsOnActivityId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === activityId) return true;
    if (!visited.has(current)) {
      visited.add(current);
      const { rows } = await pool.query(`
        SELECT depends_on_activity_id FROM work_activity_dependencies
        WHERE activity_id = $1 AND tenant_id = $2 AND project_id = $3
      `, [current, tenantId, projectId]);
      for (const row of rows) {
        if (!visited.has(row.depends_on_activity_id)) {
          queue.push(row.depends_on_activity_id);
        }
      }
    }
  }
  return false;
}

const createDependencySchema = z.object({
  activityId: z.string().uuid('Invalid activity ID'),
  dependsOnActivityId: z.string().uuid('Invalid depends-on activity ID'),
  dependencyType: z.enum(['finish-to-start']).optional()
});

// POST /api/projects/:projectId/work-activities/dependencies
router.post('/dependencies', authorize('projects:manage'), async (req, res) => {
  try {
    const { activityId, dependsOnActivityId, dependencyType = 'finish-to-start' } = createDependencySchema.parse(req.body);

    if (activityId === dependsOnActivityId) {
      return fail(res, 'VALIDATION_ERROR', 'An activity cannot depend on itself.', 400);
    }

    const hasCycle = await checkCircularDependency(req.tenantId, req.params.projectId, activityId, dependsOnActivityId);
    if (hasCycle) {
      return fail(res, 'CIRCULAR_DEPENDENCY', 'Cannot create dependency: this would introduce a circular dependency cycle.', 400);
    }

    const { rows } = await pool.query(`
      INSERT INTO work_activity_dependencies (tenant_id, project_id, activity_id, depends_on_activity_id, dependency_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.tenantId, req.params.projectId, activityId, dependsOnActivityId, dependencyType]);

    return success(res, rows[0], {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.code === '23505') {
      return fail(res, 'DUPLICATE_DEPENDENCY', 'This dependency already exists.', 400);
    }
    console.error('[WorkActivities Router] Create dependency error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create work activity dependency.', 500);
  }
});

// DELETE /api/projects/:projectId/work-activities/dependencies/:id
router.delete('/dependencies/:id', authorize('projects:manage'), async (req, res) => {
  try {
    const { rowCount } = await pool.query(`
      DELETE FROM work_activity_dependencies
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
    `, [req.params.id, req.params.projectId, req.tenantId]);

    if (rowCount === 0) {
      return fail(res, 'NOT_FOUND', 'Dependency not found.', 404);
    }
    return res.status(204).send();
  } catch (err) {
    console.error('[WorkActivities Router] Delete dependency error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete work activity dependency.', 500);
  }
});

// PUT /api/projects/:projectId/work-activities/dependencies/bulk
router.put('/dependencies/bulk', authorize('projects:manage'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { dependencies } = req.body;
    if (!Array.isArray(dependencies)) {
      return fail(res, 'VALIDATION_ERROR', 'dependencies must be an array', 400);
    }

    const adj = {};
    for (const dep of dependencies) {
      if (!adj[dep.activityId]) adj[dep.activityId] = [];
      adj[dep.activityId].push(dep.dependsOnActivityId);
    }
    const visited = new Set();
    const recStack = new Set();
    const hasCycle = (node) => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      recStack.add(node);
      const neighbors = adj[node] || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true;
      }
      recStack.delete(node);
      return false;
    };
    for (const node of Object.keys(adj)) {
      if (hasCycle(node)) {
        return fail(res, 'CIRCULAR_DEPENDENCY', 'Dependencies contain circular references.', 400);
      }
    }

    await client.query('BEGIN');
    await client.query(
      'DELETE FROM work_activity_dependencies WHERE tenant_id = $1 AND project_id = $2',
      [req.tenantId, req.params.projectId]
    );

    for (const dep of dependencies) {
      if (dep.activityId === dep.dependsOnActivityId) continue;
      await client.query(`
        INSERT INTO work_activity_dependencies (tenant_id, project_id, activity_id, depends_on_activity_id, dependency_type)
        VALUES ($1, $2, $3, $4, $5)
      `, [req.tenantId, req.params.projectId, dep.activityId, dep.dependsOnActivityId, dep.dependencyType || 'finish-to-start']);
    }

    await client.query('COMMIT');
    return success(res, { message: 'Work activity dependencies updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[WorkActivities Router] Bulk update dependencies error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to bulk update work activity dependencies.', 500);
  } finally {
    client.release();
  }
});

// Multer photo upload config
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const storage = require('../utils/storage');

// POST /api/projects/:projectId/work-activities/:id/photos
router.post('/:id/photos', authorize('projects:manage'), upload.single('file'), async (req, res) => {
  try {
    const { id: activityId } = req.params;
    const tenantId = req.tenantId;
    const { caption } = req.body;

    if (!req.file) {
      return fail(res, 'VALIDATION_ERROR', 'No file uploaded', 400);
    }

    const activity = await workActivityRepository.findActivityById(activityId, tenantId);
    if (!activity) {
      return fail(res, 'NOT_FOUND', 'Work activity not found.', 404);
    }

    const storageKey = `tenant-${tenantId}/work-activities/${activityId}/${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`;
    await storage.uploadBuffer(storageKey, req.file.buffer, req.file.mimetype);

    const { rows } = await pool.query(`
      INSERT INTO work_activity_photos (tenant_id, activity_id, file_url, caption, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [tenantId, activityId, storageKey, caption || '', req.user.userId]);

    const downloadUrl = await storage.getDownloadUrl(storageKey);
    const photoWithUrl = { ...rows[0], url: downloadUrl };

    return success(res, photoWithUrl, {}, 201);
  } catch (err) {
    console.error('[WorkActivities Router] Photo upload error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to upload completion evidence.', 500);
  }
});

// DELETE /api/projects/:projectId/work-activities/:id/photos/:photoId
router.delete('/:id/photos/:photoId', authorize('projects:manage'), async (req, res) => {
  try {
    const { id: activityId, photoId } = req.params;
    const tenantId = req.tenantId;

    const { rows } = await pool.query(`
      SELECT file_url FROM work_activity_photos
      WHERE id = $1 AND activity_id = $2 AND tenant_id = $3
    `, [photoId, activityId, tenantId]);

    if (rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Photo not found.', 404);
    }

    await storage.deleteFile(rows[0].file_url);

    await pool.query(`
      DELETE FROM work_activity_photos
      WHERE id = $1 AND activity_id = $2 AND tenant_id = $3
    `, [photoId, activityId, tenantId]);

    return success(res, { message: 'Photo deleted successfully' });
  } catch (err) {
    console.error('[WorkActivities Router] Photo delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete completion evidence.', 500);
  }
});

module.exports = router;
