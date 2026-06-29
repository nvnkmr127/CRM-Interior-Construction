const pool = require('../config/db');

class PhaseRepository {
  async findPhasesByProject(tenantId, projectId) {
    const query = `
      SELECT pp.*,
        (SELECT count(m.id)::int FROM milestones m WHERE m.phase_id = pp.id AND m.tenant_id = $1) as milestone_count,
        (
          SELECT count(t.id)::int 
          FROM tasks t 
          JOIN milestones m ON t.milestone_id = m.id 
          WHERE m.phase_id = pp.id AND t.tenant_id = $1 AND t.deleted_at IS NULL
        ) as task_count,
        COALESCE(
          (
            SELECT ROUND(COUNT(CASE WHEN pwa.status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2)
            FROM project_work_activities pwa
            WHERE pwa.phase_id = pp.id AND pwa.tenant_id = $1
          ),
          CASE WHEN pp.status = 'completed' THEN 100.00 ELSE 0.00 END
        )::numeric(5,2) as progress_percentage
      FROM project_phases pp
      WHERE pp.tenant_id = $1 AND pp.project_id = $2
      ORDER BY pp.sort_order ASC, pp.created_at ASC
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);
    return rows;
  }

  async createPhase(tenantId, projectId, data) {
    const {
      name, sort_order = 0, status = 'pending', duration_days,
      starts_at, ends_at, sign_off_required = true, sign_off_by = 'pm',
      is_execution = false
    } = data;

    const query = `
      INSERT INTO project_phases (
        tenant_id, project_id, name, sort_order, status,
        duration_days, starts_at, ends_at, sign_off_required, sign_off_by, is_execution
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING *
    `;
    const values = [
      tenantId, projectId, name, sort_order, status,
      duration_days || null, starts_at || null, ends_at || null,
      sign_off_required, sign_off_by, is_execution
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async updatePhase(phaseId, tenantId, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'project_id', 'tenant_id', 'created_at'].includes(key)) continue;
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (fields.length === 0) {
      const { rows } = await pool.query(`SELECT * FROM project_phases WHERE id = $1 AND tenant_id = $2`, [phaseId, tenantId]);
      return rows[0];
    }

    values.push(phaseId, tenantId);
    const query = `
      UPDATE project_phases
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND tenant_id = $${idx + 1}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    return rows[0];
  }

  async reorderPhases(projectId, tenantId, orderedIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < orderedIds.length; i++) {
        await client.query(`
          UPDATE project_phases SET sort_order = $1
          WHERE id = $2 AND project_id = $3 AND tenant_id = $4
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

  async signOffPhase(phaseId, userId, tenantId) {
    // 1. Mark phase completed
    const { rows } = await pool.query(`
      UPDATE project_phases 
      SET status = 'completed', signed_off_by = $1, signed_off_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING project_id
    `, [userId, phaseId, tenantId]);

    if (rows.length === 0) throw new Error('NOT_FOUND');
    const projectId = rows[0].project_id;

    // 2. Check if all phases for this project are completed
    const countRes = await pool.query(`
      SELECT count(*)::int FROM project_phases
      WHERE project_id = $1 AND tenant_id = $2 AND status != 'completed'
    `, [projectId, tenantId]);

    if (countRes.rows[0].count === 0) {
      // 3. Auto-complete the project if no pending/in_progress phases remain
      await pool.query(`
        UPDATE projects SET status = 'completed', updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
      `, [projectId, tenantId]);
    }

    return true;
  }

  async deletePhase(phaseId, tenantId) {
    const { rowCount } = await pool.query(`
      DELETE FROM project_phases
      WHERE id = $1 AND tenant_id = $2
    `, [phaseId, tenantId]);

    if (rowCount === 0) throw new Error('NOT_FOUND');
    return true;
  }
}

module.exports = new PhaseRepository();
