const pool = require('../config/db');

class TaskRepository {
  async createTask(tenantId, data) {
    const {
      project_id, milestone_id, parent_task_id, title, description,
      assignee_id, due_date, priority = 'medium', status = 'todo',
      sort_order = 0, tags = [], custom_fields = {}, created_by
    } = data;

    const query = `
      INSERT INTO tasks (
        tenant_id, project_id, milestone_id, parent_task_id,
        title, description, assignee_id, due_date, priority, status,
        sort_order, tags, custom_fields, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) RETURNING *
    `;
    const values = [
      tenantId, project_id, milestone_id || null, parent_task_id || null,
      title, description || null, assignee_id || null, due_date || null,
      priority, status, sort_order, JSON.stringify(tags),
      custom_fields, created_by || null
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async findTaskById(tenantId, taskId) {
    const query = `
      SELECT t.*, u.first_name || ' ' || u.last_name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL
    `;
    const { rows } = await pool.query(query, [taskId, tenantId]);
    if (rows.length === 0) return null;
    
    const task = rows[0];

    // Fetch subtasks
    const subQuery = `
      SELECT t.*, u.first_name || ' ' || u.last_name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.parent_task_id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL
      ORDER BY t.sort_order ASC, t.created_at ASC
    `;
    const subRes = await pool.query(subQuery, [taskId, tenantId]);
    task.subtasks = subRes.rows;

    // Fetch comments
    const commentsQuery = `
      SELECT c.*, u.first_name || ' ' || u.last_name as user_name
      FROM task_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC
    `;
    const commentsRes = await pool.query(commentsQuery, [taskId]);
    task.comments = commentsRes.rows;

    return task;
  }

  async findTasks(tenantId, { projectId, milestoneId, assigneeId, status, priority, dueWithin, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const values = [tenantId];
    let whereClause = `t.tenant_id = $1 AND t.deleted_at IS NULL`;
    let idx = 2;

    if (projectId) {
      whereClause += ` AND t.project_id = $${idx++}`;
      values.push(projectId);
    }
    if (assigneeId) {
      whereClause += ` AND t.assignee_id = $${idx++}`;
      values.push(assigneeId);
    }
    if (status) {
      whereClause += ` AND t.status = $${idx++}`;
      values.push(status);
    }
    if (priority) {
      whereClause += ` AND t.priority = $${idx++}`;
      values.push(priority);
    }

    if (milestoneId) {
      whereClause += ` AND t.milestone_id = $${idx++}`;
      values.push(milestoneId);
    } else {
      whereClause += ` AND t.parent_task_id IS NULL`;
    }

    if (dueWithin) {
      if (dueWithin === 'overdue') {
        whereClause += ` AND t.due_date < NOW() AND t.status != 'done'`;
      } else if (dueWithin === 'today') {
        whereClause += ` AND t.due_date::date = CURRENT_DATE`;
      } else if (dueWithin === 'week') {
        whereClause += ` AND t.due_date::date >= CURRENT_DATE AND t.due_date::date <= CURRENT_DATE + interval '7 days'`;
      } else {
        const days = parseInt(dueWithin, 10);
        if (!isNaN(days)) {
          whereClause += ` AND t.due_date::date <= CURRENT_DATE + interval '${days} days' AND t.due_date IS NOT NULL`;
        }
      }
    }

    const countQuery = `SELECT count(*)::int FROM tasks t WHERE ${whereClause}`;
    const { rows: countRows } = await pool.query(countQuery, values);
    const total = countRows[0].count;

    const query = `
      SELECT t.*,
        u.first_name || ' ' || u.last_name as assignee_name,
        p.name as project_name,
        (SELECT count(id)::int FROM tasks sub WHERE sub.parent_task_id = t.id AND sub.deleted_at IS NULL) as subtask_count
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE ${whereClause}
      ORDER BY t.sort_order ASC, t.created_at DESC
      LIMIT $${idx++} OFFSET $${idx}
    `;
    values.push(limit, offset);
    const { rows } = await pool.query(query, values);

    return {
      data: rows,
      total,
      page,
      limit
    };
  }

  async updateTask(tenantId, taskId, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'tenant_id', 'created_at', 'deleted_at'].includes(key)) continue;
      fields.push(`${key} = $${idx}`);
      // JSON encode arrays/objects if tags/custom_fields are passed
      if (key === 'tags' || key === 'custom_fields') {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
      idx++;
    }

    if (fields.length === 0) return this.findTaskById(tenantId, taskId);

    fields.push(`updated_at = NOW()`);
    values.push(taskId, tenantId);

    const query = `
      UPDATE tasks
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND tenant_id = $${idx + 1} AND deleted_at IS NULL
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    return rows[0];
  }

  async reorderTasks(projectId, tenantId, orderedIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < orderedIds.length; i++) {
        await client.query(`
          UPDATE tasks SET sort_order = $1
          WHERE id = $2 AND project_id = $3 AND tenant_id = $4 AND deleted_at IS NULL
        `, [i, orderedIds[i], projectId, tenantId]);
      }
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async bulkCreateTasks(tenantId, projectId, tasksData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const createdTasks = [];
      for (const t of tasksData) {
        const { rows } = await client.query(`
          INSERT INTO tasks (
            tenant_id, project_id, milestone_id, parent_task_id,
            title, description, assignee_id, due_date, priority, status, sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `, [
          tenantId, projectId, t.milestone_id || null, t.parent_task_id || null,
          t.title, t.description || null, t.assignee_id || null, t.due_date || null,
          t.priority || 'medium', t.status || 'todo', t.sort_order || 0
        ]);
        createdTasks.push(rows[0]);
      }
      await client.query('COMMIT');
      return createdTasks;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async softDeleteTask(tenantId, taskId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Delete parent
      const { rowCount } = await client.query(`
        UPDATE tasks SET deleted_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      `, [taskId, tenantId]);

      if (rowCount === 0) throw new Error('NOT_FOUND');

      // Cascade soft delete to subtasks
      await client.query(`
        UPDATE tasks SET deleted_at = NOW()
        WHERE parent_task_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
      `, [taskId, tenantId]);

      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

module.exports = new TaskRepository();
