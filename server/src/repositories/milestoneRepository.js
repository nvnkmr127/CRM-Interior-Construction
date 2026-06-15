const pool = require('../config/db');

class MilestoneRepository {
  async findMilestonesByPhase(phaseId, tenantId) {
    const { rows } = await pool.query(`
      SELECT * FROM milestones
      WHERE phase_id = $1 AND tenant_id = $2
      ORDER BY sort_order ASC, created_at ASC
    `, [phaseId, tenantId]);
    return rows;
  }

  async createMilestone(tenantId, phaseId, projectId, data) {
    const {
      name, description, due_date, status = 'pending',
      triggers_payment = false, sort_order = 0
    } = data;

    const query = `
      INSERT INTO milestones (
        tenant_id, phase_id, project_id, name, description,
        due_date, status, triggers_payment, sort_order
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING *
    `;
    const values = [
      tenantId, phaseId, projectId, name, description || null,
      due_date || null, status, triggers_payment, sort_order
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async updateMilestone(milestoneId, tenantId, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'tenant_id', 'phase_id', 'project_id', 'created_at'].includes(key)) continue;
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (fields.length === 0) {
      const { rows } = await pool.query(`SELECT * FROM milestones WHERE id = $1 AND tenant_id = $2`, [milestoneId, tenantId]);
      return rows[0];
    }

    values.push(milestoneId, tenantId);
    const query = `
      UPDATE milestones
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND tenant_id = $${idx + 1}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    return rows[0];
  }

  async completeMilestone(milestoneId, userId, tenantId) {
    // 1. Mark milestone as completed
    const query = `
      UPDATE milestones
      SET status = 'completed', completion_date = CURRENT_DATE, completed_by = $1
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const { rows } = await pool.query(query, [userId, milestoneId, tenantId]);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    
    const milestone = rows[0];

    // 2. Trigger payment cascade if enabled
    if (milestone.triggers_payment) {
      await pool.query(`
        UPDATE payment_milestones
        SET status = 'invoice_raised'
        WHERE milestone_id = $1 AND tenant_id = $2 AND status = 'scheduled'
      `, [milestoneId, tenantId]);
    }

    return milestone;
  }
}

module.exports = new MilestoneRepository();
