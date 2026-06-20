const pool = require('../config/db');

class ProjectRepository {
  async createProject(tenantId, data, dbClient = pool) {
    const {
      lead_id, client_name, client_phone, client_email,
      name, project_type, pm_id, designer_id,
      contract_value, status = 'active', start_date, target_date,
      site_address, custom_fields = {}, created_by
    } = data;

    const query = `
      INSERT INTO projects (
        tenant_id, lead_id, client_name, client_phone, client_email,
        name, project_type, pm_id, designer_id,
        contract_value, status, start_date, target_date,
        site_address, custom_fields, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING *
    `;
    const values = [
      tenantId, lead_id || null, client_name, client_phone || null, client_email || null,
      name, project_type || null, pm_id || null, designer_id || null,
      contract_value || null, status, start_date || null, target_date || null,
      site_address || null, custom_fields, created_by || null
    ];

    const { rows } = await dbClient.query(query, values);
    return rows[0];
  }

  async findProjectById(tenantId, projectId) {
    const query = `
      SELECT p.*,
        pm.name as pm_name,
        d.name as designer_name
      FROM projects p
      LEFT JOIN users pm ON p.pm_id = pm.id
      LEFT JOIN users d ON p.designer_id = d.id
      WHERE p.tenant_id = $1 AND p.id = $2 AND p.deleted_at IS NULL
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);
    if (rows.length === 0) return null;

    const project = rows[0];

    // Fetch phases + task count per phase
    const phasesQuery = `
      SELECT pp.*,
        (
          SELECT count(t.id)::int 
          FROM tasks t 
          JOIN milestones m ON t.milestone_id = m.id 
          WHERE m.phase_id = pp.id AND t.tenant_id = $1 AND t.deleted_at IS NULL
        ) as task_count
      FROM project_phases pp
      WHERE pp.tenant_id = $1 AND pp.project_id = $2
      ORDER BY pp.sort_order ASC, pp.created_at ASC
    `;
    const phasesRes = await pool.query(phasesQuery, [tenantId, projectId]);
    project.phases = phasesRes.rows;

    // Fetch payment milestones
    const paymentsQuery = `
      SELECT * FROM payment_milestones
      WHERE tenant_id = $1 AND project_id = $2
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    `;
    const paymentsRes = await pool.query(paymentsQuery, [tenantId, projectId]);
    project.payment_milestones = paymentsRes.rows;

    return project;
  }

  async findProjects(tenantId, { status, pmId, designerId, search, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const values = [tenantId];
    let whereClause = `p.tenant_id = $1 AND p.deleted_at IS NULL`;
    let idx = 2;

    if (status) {
      whereClause += ` AND p.status = $${idx++}`;
      values.push(status);
    }
    if (pmId) {
      whereClause += ` AND p.pm_id = $${idx++}`;
      values.push(pmId);
    }
    if (designerId) {
      whereClause += ` AND p.designer_id = $${idx++}`;
      values.push(designerId);
    }
    if (search) {
      whereClause += ` AND (p.name ILIKE $${idx} OR p.client_name ILIKE $${idx})`;
      values.push(`%${search}%`);
      idx++;
    }

    const countQuery = `SELECT count(*)::int FROM projects p WHERE ${whereClause}`;
    const { rows: countRows } = await pool.query(countQuery, values);
    const total = countRows[0].count;

    const query = `
      SELECT p.*,
        pm.name as pm_name,
        d.name as designer_name,
        (SELECT count(id)::int FROM project_phases WHERE project_id = p.id AND tenant_id = $1) as phase_count,
        (SELECT count(id)::int FROM project_phases WHERE project_id = p.id AND tenant_id = $1 AND status = 'completed') as completed_phase_count,
        (SELECT count(id)::int FROM tasks WHERE project_id = p.id AND tenant_id = $1 AND deleted_at IS NULL) as total_tasks,
        (SELECT count(id)::int FROM tasks WHERE project_id = p.id AND tenant_id = $1 AND deleted_at IS NULL AND status = 'done') as completed_tasks
      FROM projects p
      LEFT JOIN users pm ON p.pm_id = pm.id
      LEFT JOIN users d ON p.designer_id = d.id
      WHERE ${whereClause}
      ORDER BY p.created_at DESC
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

  async updateProject(tenantId, projectId, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'tenant_id', 'created_at', 'deleted_at'].includes(key)) continue;
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (fields.length === 0) return this.findProjectById(tenantId, projectId);

    fields.push(`updated_at = NOW()`);
    values.push(tenantId, projectId);

    const query = `
      UPDATE projects
      SET ${fields.join(', ')}
      WHERE tenant_id = $${idx} AND id = $${idx + 1} AND deleted_at IS NULL
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    return rows[0];
  }

  async softDeleteProject(tenantId, projectId) {
    const query = `
      UPDATE projects
      SET deleted_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
      RETURNING id
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    return true;
  }

  async getProjectStats(tenantId, projectId) {
    const tasksQuery = `
      SELECT 
        COUNT(id)::int as total_tasks,
        COUNT(id) FILTER (WHERE status = 'done')::int as completed_tasks,
        COUNT(id) FILTER (WHERE status != 'done' AND due_date < CURRENT_DATE)::int as overdue_tasks
      FROM tasks
      WHERE tenant_id = $1 AND project_id = $2 AND deleted_at IS NULL
    `;
    const { rows: taskRows } = await pool.query(tasksQuery, [tenantId, projectId]);
    const taskStats = taskRows[0] || { total_tasks: 0, completed_tasks: 0, overdue_tasks: 0 };

    const paymentsQuery = `
      SELECT 
        COALESCE(SUM(amount), 0) as total_payment,
        COALESCE(SUM(paid_amount), 0) as collected_payment
      FROM payment_milestones
      WHERE tenant_id = $1 AND project_id = $2
    `;
    const { rows: paymentRows } = await pool.query(paymentsQuery, [tenantId, projectId]);
    const payStats = paymentRows[0] || { total_payment: 0, collected_payment: 0 };

    let taskCompletionPct = 0;
    if (taskStats.total_tasks > 0) {
      taskCompletionPct = Math.round((taskStats.completed_tasks / taskStats.total_tasks) * 100);
    }

    return {
      totalTasks: taskStats.total_tasks,
      completedTasks: taskStats.completed_tasks,
      taskCompletionPct,
      overdueTasks: taskStats.overdue_tasks,
      totalPayment: Number(payStats.total_payment),
      collectedPayment: Number(payStats.collected_payment)
    };
  }
}

module.exports = new ProjectRepository();
