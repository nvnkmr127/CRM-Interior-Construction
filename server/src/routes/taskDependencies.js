const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const authorize = require('../middleware/authorize');
const taskDependencyRepository = require('../repositories/taskDependencyRepository');
const pool = require('../config/db');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const createDependencySchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
  dependsOnTaskId: z.string().uuid('Invalid depends-on task ID'),
  dependencyType: z.enum(['finish-to-start', 'start-to-start']).optional()
});

// GET /api/projects/:projectId/task-dependencies
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const dependencies = await taskDependencyRepository.findDependenciesByProject(
      req.tenantId,
      req.params.projectId
    );
    return success(res, dependencies);
  } catch (err) {
    console.error('[TaskDependencies Router] Fetch error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch task dependencies.', 500);
  }
});

// POST /api/projects/:projectId/task-dependencies
router.post('/', authorize('projects:manage'), validate(createDependencySchema), async (req, res, next) => {
  try {
    const data  = req.body;
    
    if (data.taskId === data.dependsOnTaskId) {
      return fail(res, 'VALIDATION_ERROR', 'A task cannot depend on itself.', 400);
    }

    // Check for circular dependencies
    const hasCycle = await taskDependencyRepository.hasCircularDependency(
      req.tenantId,
      req.params.projectId,
      data.taskId,
      data.dependsOnTaskId
    );

    if (hasCycle) {
      return fail(res, 'CIRCULAR_DEPENDENCY', 'Cannot create dependency: this would introduce a circular dependency cycle.', 400);
    }

    const dependency = await taskDependencyRepository.createDependency(
      req.tenantId,
      req.params.projectId,
      data
    );

    return success(res, dependency, {}, 201);
  } catch (err) {
    
    console.error('[TaskDependencies Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create task dependency.', 500);
  }
});

// DELETE /api/projects/:projectId/task-dependencies/:id
router.delete('/:id', authorize('projects:manage'), async (req, res) => {
  try {
    await taskDependencyRepository.deleteDependency(
      req.tenantId,
      req.params.projectId,
      req.params.id
    );
    return res.status(204).send();
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Dependency not found.', 404);
    console.error('[TaskDependencies Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete task dependency.', 500);
  }
});

// PUT /api/projects/:projectId/task-dependencies/bulk
router.put('/bulk', authorize('projects:manage'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { dependencies } = req.body;
    if (!Array.isArray(dependencies)) {
      return fail(res, 'VALIDATION_ERROR', 'dependencies must be an array', 400);
    }

    // Verify no cycles
    const adj = {};
    for (const dep of dependencies) {
      if (!adj[dep.taskId]) adj[dep.taskId] = [];
      adj[dep.taskId].push(dep.dependsOnTaskId);
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
    
    // Delete all current dependencies for this project
    await client.query(
      'DELETE FROM task_dependencies WHERE tenant_id = $1 AND project_id = $2',
      [req.tenantId, req.params.projectId]
    );

    // Insert new dependencies
    for (const dep of dependencies) {
      if (dep.taskId === dep.dependsOnTaskId) continue;
      await client.query(`
        INSERT INTO task_dependencies (tenant_id, project_id, task_id, depends_on_task_id, dependency_type)
        VALUES ($1, $2, $3, $4, $5)
      `, [req.tenantId, req.params.projectId, dep.taskId, dep.dependsOnTaskId, dep.dependencyType || 'finish-to-start']);
    }

    await client.query('COMMIT');
    return success(res, { message: 'Dependencies updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[TaskDependencies Router] Bulk update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to bulk update task dependencies.', 500);
  } finally {
    client.release();
  }
});

module.exports = router;
