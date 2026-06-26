const pool = require('../config/db');

class TaskDependencyRepository {
  async createDependency(tenantId, projectId, { taskId, dependsOnTaskId, dependencyType = 'finish-to-start' }) {
    const query = `
      INSERT INTO task_dependencies (tenant_id, project_id, task_id, depends_on_task_id, dependency_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [tenantId, projectId, taskId, dependsOnTaskId, dependencyType]);
    return rows[0];
  }

  async deleteDependency(tenantId, projectId, id) {
    const query = `
      DELETE FROM task_dependencies
      WHERE tenant_id = $1 AND project_id = $2 AND id = $3
      RETURNING *
    `;
    const { rows } = await pool.query(query, [tenantId, projectId, id]);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    return rows[0];
  }

  async findDependenciesByProject(tenantId, projectId) {
    const query = `
      SELECT 
        td.id,
        td.project_id,
        td.task_id,
        td.depends_on_task_id,
        td.dependency_type,
        t_dep.title as task_title,
        t_dep.status as task_status,
        t_req.title as depends_on_task_title,
        t_req.status as depends_on_task_status
      FROM task_dependencies td
      JOIN tasks t_dep ON td.task_id = t_dep.id
      JOIN tasks t_req ON td.depends_on_task_id = t_req.id
      WHERE td.tenant_id = $1 AND td.project_id = $2
        AND t_dep.deleted_at IS NULL AND t_req.deleted_at IS NULL
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);
    return rows;
  }

  async findDependenciesForTask(tenantId, taskId) {
    const query = `
      SELECT 
        td.id,
        td.project_id,
        td.task_id,
        td.depends_on_task_id,
        td.dependency_type,
        t_req.title as depends_on_task_title,
        t_req.status as depends_on_task_status
      FROM task_dependencies td
      JOIN tasks t_req ON td.depends_on_task_id = t_req.id
      WHERE td.tenant_id = $1 AND td.task_id = $2 AND t_req.deleted_at IS NULL
    `;
    const { rows } = await pool.query(query, [tenantId, taskId]);
    return rows;
  }

  async hasCircularDependency(tenantId, projectId, taskId, dependsOnTaskId) {
    // Fetch all current dependencies in this project
    const { rows } = await pool.query(
      'SELECT task_id, depends_on_task_id FROM task_dependencies WHERE tenant_id = $1 AND project_id = $2',
      [tenantId, projectId]
    );

    // Build dependency graph representation: node -> list of tasks it depends on
    const graph = {};
    for (const r of rows) {
      if (!graph[r.task_id]) graph[r.task_id] = [];
      graph[r.task_id].push(r.depends_on_task_id);
    }

    // Temporarily add the proposed dependency link
    if (!graph[taskId]) graph[taskId] = [];
    graph[taskId].push(dependsOnTaskId);

    // DFS check for cycle containing taskId
    const visited = new Set();
    const recStack = new Set();

    const isCyclic = (node) => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const neighbors = graph[node] || [];
      for (const neighbor of neighbors) {
        if (isCyclic(neighbor)) return true;
      }

      recStack.delete(node);
      return false;
    };

    return isCyclic(taskId);
  }
}

module.exports = new TaskDependencyRepository();
