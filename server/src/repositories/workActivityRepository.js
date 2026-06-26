const pool = require('../config/db');

class WorkActivityRepository {
  async findActivities(tenantId, projectId, filters = {}) {
    const { phaseId, trade, roomName, status } = filters;
    const values = [tenantId, projectId];
    let whereClause = `pwa.tenant_id = $1 AND pwa.project_id = $2`;
    let idx = 3;

    if (phaseId) {
      whereClause += ` AND pwa.phase_id = $${idx++}`;
      values.push(phaseId);
    }
    if (trade) {
      whereClause += ` AND pwa.trade = $${idx++}`;
      values.push(trade);
    }
    if (roomName) {
      whereClause += ` AND pwa.room_name = $${idx++}`;
      values.push(roomName);
    }
    if (status) {
      whereClause += ` AND pwa.status = $${idx++}`;
      values.push(status);
    }

    const query = `
      SELECT pwa.*,
        u.name as assignee_name,
        cb.name as completed_by_name
      FROM project_work_activities pwa
      LEFT JOIN users u ON pwa.assignee_id = u.id
      LEFT JOIN users cb ON pwa.completed_by = cb.id
      WHERE ${whereClause}
      ORDER BY pwa.created_at ASC
    `;
    const { rows } = await pool.query(query, values);
    return rows;
  }

  async findActivityById(id, tenantId) {
    const query = `
      SELECT pwa.*,
        u.name as assignee_name,
        cb.name as completed_by_name
      FROM project_work_activities pwa
      LEFT JOIN users u ON pwa.assignee_id = u.id
      LEFT JOIN users cb ON pwa.completed_by = cb.id
      WHERE pwa.id = $1 AND pwa.tenant_id = $2
    `;
    const { rows } = await pool.query(query, [id, tenantId]);
    return rows[0] || null;
  }

  async createActivity(tenantId, data) {
    const {
      project_id, phase_id, room_name, trade, activity_name,
      description, assignee_id, due_date, status = 'todo', notes
    } = data;

    const query = `
      INSERT INTO project_work_activities (
        tenant_id, project_id, phase_id, room_name, trade, activity_name,
        description, assignee_id, due_date, status, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING *
    `;
    const values = [
      tenantId, project_id, phase_id || null, room_name, trade, activity_name,
      description || null, assignee_id || null, due_date || null, status, notes || null
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async updateActivity(id, tenantId, updates, userId = null) {
    const fields = [];
    const values = [];
    let idx = 1;

    // Auto-update completed_at / completed_by when status changes to completed
    if (updates.status === 'completed') {
      updates.completed_at = new Date().toISOString();
      if (userId) {
        updates.completed_by = userId;
      }
    } else if (updates.status && updates.status !== 'completed') {
      updates.completed_at = null;
      updates.completed_by = null;
    }

    updates.updated_at = new Date().toISOString();

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'project_id', 'tenant_id', 'created_at', 'completed_by_name', 'assignee_name'].includes(key)) continue;
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (fields.length === 0) {
      return this.findActivityById(id, tenantId);
    }

    values.push(id, tenantId);
    const query = `
      UPDATE project_work_activities
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND tenant_id = $${idx + 1}
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) throw new Error('NOT_FOUND');
    return rows[0];
  }

  async deleteActivity(id, tenantId) {
    const { rowCount } = await pool.query(`
      DELETE FROM project_work_activities
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);

    if (rowCount === 0) throw new Error('NOT_FOUND');
    return true;
  }

  async findTemplates(trade = null, roomType = null) {
    let query = `SELECT * FROM trade_activity_templates`;
    const values = [];
    let whereClauses = [];

    if (trade) {
      whereClauses.push(`trade = $1`);
      values.push(trade);
    }
    if (roomType) {
      whereClauses.push(`(room_type = $${values.length + 1} OR room_type = 'General')`);
      values.push(roomType);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    query += ` ORDER BY trade ASC, sort_order ASC`;
    const { rows } = await pool.query(query, values);
    return rows;
  }

  async generateActivities(tenantId, projectId, phaseId, roomName, trade) {
    // 1. Resolve roomType based on roomName
    let roomType = 'General';
    const lowerName = roomName.toLowerCase();
    if (lowerName.includes('kitchen')) {
      roomType = 'Kitchen';
    } else if (lowerName.includes('bedroom')) {
      roomType = 'Bedroom';
    } else if (lowerName.includes('bathroom') || lowerName.includes('toilet') || lowerName.includes('restroom') || lowerName.includes('washroom')) {
      roomType = 'Bathroom';
    } else if (lowerName.includes('living') || lowerName.includes('hall') || lowerName.includes('drawing')) {
      roomType = 'Living Room';
    }

    // 2. Fetch templates for this trade and roomType
    const templates = await this.findTemplates(trade, roomType);
    if (templates.length === 0) {
      return [];
    }

    // 3. Bulk insert them into project_work_activities
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = [];
      for (const tpl of templates) {
        // Check if this activity already exists in this project, room, and trade to prevent duplicates
        const dupRes = await client.query(`
          SELECT id FROM project_work_activities
          WHERE tenant_id = $1 AND project_id = $2 AND phase_id = $3
            AND room_name = $4 AND trade = $5 AND activity_name = $6
        `, [tenantId, projectId, phaseId, roomName, trade, tpl.activity_name]);

        if (dupRes.rows.length > 0) {
          continue; // skip duplicate
        }

        const res = await client.query(`
          INSERT INTO project_work_activities (
            tenant_id, project_id, phase_id, room_name, trade, activity_name, description, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'todo')
          RETURNING *
        `, [tenantId, projectId, phaseId, roomName, trade, tpl.activity_name, tpl.description]);
        
        created.push(res.rows[0]);
      }
      await client.query('COMMIT');
      return created;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

module.exports = new WorkActivityRepository();
