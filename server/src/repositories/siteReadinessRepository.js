const pool = require('../config/db');

class SiteReadinessRepository {
  async findChecklist(tenantId, projectId) {
    const query = `
      SELECT psr.*,
        u.name as completed_by_name
      FROM project_site_readiness psr
      LEFT JOIN users u ON psr.completed_by = u.id
      WHERE psr.tenant_id = $1 AND psr.project_id = $2
      ORDER BY psr.created_at ASC
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);

    if (rows.length === 0) {
      // Auto-seed and return
      return this.seedDefaultChecklist(tenantId, projectId);
    }

    return rows;
  }

  async seedDefaultChecklist(tenantId, projectId) {
    const defaults = [
      { key: 'civil_handover', label: 'Civil Handover Completed' },
      { key: 'electrical_rough_in', label: 'Electrical Rough-In Ready' },
      { key: 'waterproofing', label: 'Wet Area Waterproofing Done' },
      { key: 'debris_cleared', label: 'Debris Cleared & Site Cleaned' }
    ];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const seeded = [];
      for (const item of defaults) {
        // Prevent duplicate insertion errors
        const checkRes = await client.query(
          'SELECT id FROM project_site_readiness WHERE project_id = $1 AND item_key = $2',
          [projectId, item.key]
        );
        if (checkRes.rows.length === 0) {
          const res = await client.query(`
            INSERT INTO project_site_readiness (tenant_id, project_id, item_key, label, is_completed)
            VALUES ($1, $2, $3, $4, FALSE)
            RETURNING *
          `, [tenantId, projectId, item.key, item.label]);
          seeded.push(res.rows[0]);
        }
      }
      await client.query('COMMIT');

      // Query with joined user name just in case
      return this.findChecklist(tenantId, projectId);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async updateChecklistItem(id, tenantId, updates, userId = null) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (updates.is_completed === true || updates.is_completed === 'true') {
      updates.completed_at = new Date().toISOString();
      if (userId) {
        updates.completed_by = userId;
      }
    } else if (updates.is_completed === false || updates.is_completed === 'false') {
      updates.completed_at = null;
      updates.completed_by = null;
    }

    updates.updated_at = new Date().toISOString();

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'project_id', 'tenant_id', 'created_at', 'item_key', 'label', 'completed_by_name'].includes(key)) continue;
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (fields.length === 0) {
      const { rows } = await pool.query(
        'SELECT psr.*, u.name as completed_by_name FROM project_site_readiness psr LEFT JOIN users u ON psr.completed_by = u.id WHERE psr.id = $1 AND psr.tenant_id = $2',
        [id, tenantId]
      );
      return rows[0];
    }

    values.push(id, tenantId);
    const query = `
      UPDATE project_site_readiness
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND tenant_id = $${idx + 1}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    
    // Return with joined user name
    const res = await pool.query(
      'SELECT psr.*, u.name as completed_by_name FROM project_site_readiness psr LEFT JOIN users u ON psr.completed_by = u.id WHERE psr.id = $1 AND psr.tenant_id = $2',
      [id, tenantId]
    );
    return res.rows[0];
  }

  async signOffAll(tenantId, projectId, userId) {
    const completedAt = new Date().toISOString();
    const query = `
      UPDATE project_site_readiness
      SET is_completed = TRUE,
          completed_at = $1,
          completed_by = $2,
          updated_at = NOW()
      WHERE project_id = $3 AND tenant_id = $4
    `;
    await pool.query(query, [completedAt, userId, projectId, tenantId]);
    return this.findChecklist(tenantId, projectId);
  }
}

module.exports = new SiteReadinessRepository();
