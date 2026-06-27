const pool = require('../db/pool');

class PunchListRepository {
  async createPunchList(tenantId, projectId, data, userId) {
    const { title, walkthrough_date } = data;
    const { rows } = await pool.query(
      `INSERT INTO punch_lists (tenant_id, project_id, title, walkthrough_date, created_by, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')
       RETURNING *`,
      [tenantId, projectId, title, walkthrough_date || null, userId]
    );
    return rows[0];
  }

  async getPunchLists(tenantId, projectId) {
    const { rows } = await pool.query(
      `SELECT pl.*, u.name as creator_name,
         (SELECT count(*)::int FROM punch_list_items pli WHERE pli.punch_list_id = pl.id) as total_items,
         (SELECT count(*)::int FROM punch_list_items pli WHERE pli.punch_list_id = pl.id AND pli.status = 'resolved') as resolved_items,
         (SELECT count(*)::int FROM punch_list_items pli WHERE pli.punch_list_id = pl.id AND pli.status = 'verified') as verified_items
       FROM punch_lists pl
       LEFT JOIN users u ON pl.created_by = u.id
       WHERE pl.tenant_id = $1 AND pl.project_id = $2
       ORDER BY pl.walkthrough_date DESC, pl.created_at DESC`,
      [tenantId, projectId]
    );
    return rows;
  }

  async getPunchListById(tenantId, punchListId) {
    const plRes = await pool.query(
      `SELECT pl.*, u.name as creator_name
       FROM punch_lists pl
       LEFT JOIN users u ON pl.created_by = u.id
       WHERE pl.tenant_id = $1 AND pl.id = $2`,
      [tenantId, punchListId]
    );
    
    if (plRes.rows.length === 0) return null;
    const punchList = plRes.rows[0];

    const itemsRes = await pool.query(
      `SELECT pli.*, 
         u.name as assignee_name,
         qc.name as closed_by_qc_name
       FROM punch_list_items pli
       LEFT JOIN users u ON pli.assignee_id = u.id
       LEFT JOIN users qc ON pli.closed_by_qc = qc.id
       WHERE pli.tenant_id = $1 AND pli.punch_list_id = $2
       ORDER BY pli.room_name ASC, pli.created_at ASC`,
      [tenantId, punchListId]
    );
    punchList.items = itemsRes.rows;
    return punchList;
  }

  async updatePunchList(tenantId, punchListId, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'project_id', 'tenant_id', 'created_at'].includes(key)) continue;
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (fields.length === 0) return this.getPunchListById(tenantId, punchListId);

    fields.push('updated_at = NOW()');
    values.push(punchListId, tenantId);
    
    const query = `
      UPDATE punch_lists
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND tenant_id = $${idx + 1}
      RETURNING *
    `;
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async deletePunchList(tenantId, punchListId) {
    const { rowCount } = await pool.query(
      'DELETE FROM punch_lists WHERE id = $1 AND tenant_id = $2',
      [punchListId, tenantId]
    );
    return rowCount > 0;
  }

  async createPunchListItem(tenantId, punchListId, itemData) {
    const { room_name, trade, item_description, photo_key, assignee_id } = itemData;
    
    // Auto-transition punch list status to active if it was draft
    await pool.query(
      `UPDATE punch_lists 
       SET status = 'active', updated_at = NOW() 
       WHERE id = $1 AND tenant_id = $2 AND status = 'draft'`,
      [punchListId, tenantId]
    );

    const { rows } = await pool.query(
      `INSERT INTO punch_list_items (
        punch_list_id, tenant_id, room_name, trade, item_description, photo_key, assignee_id, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
       RETURNING *`,
      [punchListId, tenantId, room_name, trade, item_description, photo_key || null, assignee_id || null]
    );
    return rows[0];
  }

  async updatePunchListItem(tenantId, itemId, updates, userId = null) {
    // 1. Fetch current item details
    const currentRes = await pool.query(
      'SELECT * FROM punch_list_items WHERE id = $1 AND tenant_id = $2',
      [itemId, tenantId]
    );
    if (currentRes.rows.length === 0) throw new Error('Item not found');
    const currentItem = currentRes.rows[0];

    const fields = [];
    const values = [];
    let idx = 1;

    // Apply status-specific changes
    if (updates.status === 'resolved') {
      if (!updates.qc_notes || !updates.qc_notes.trim()) {
        const error = new Error('QC notes required');
        error.status = 400;
        error.code = 'QC_NOTES_REQUIRED';
        throw error;
      }
      updates.closed_by_qc = userId;
      updates.closed_at = new Date().toISOString();
      updates.qc_notes = updates.qc_notes.trim();
    } else if (updates.status === 'verified') {
      updates.client_verified = true;
      updates.client_verified_at = new Date().toISOString();
    } else if (updates.status && updates.status === 'open') {
      // Reopening resets QC closures and client verification
      updates.closed_by_qc = null;
      updates.closed_at = null;
      updates.qc_notes = null;
      updates.client_verified = false;
      updates.client_verified_at = null;
    }

    for (const [key, value] of Object.entries(updates)) {
      if (['id', 'punch_list_id', 'tenant_id', 'created_at'].includes(key)) continue;
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (fields.length > 0) {
      fields.push('updated_at = NOW()');
      values.push(itemId, tenantId);
      const query = `
        UPDATE punch_list_items
        SET ${fields.join(', ')}
        WHERE id = $${idx} AND tenant_id = $${idx + 1}
        RETURNING *
      `;
      const { rows } = await pool.query(query, values);
      const updatedItem = rows[0];

      // 2. Perform rollup automation: update punch list status based on item statuses
      await this.rollupPunchListStatus(tenantId, currentItem.punch_list_id);

      return updatedItem;
    }

    return currentItem;
  }

  async rollupPunchListStatus(tenantId, punchListId) {
    const { rows: items } = await pool.query(
      'SELECT status FROM punch_list_items WHERE punch_list_id = $1 AND tenant_id = $2',
      [punchListId, tenantId]
    );

    if (items.length === 0) return;

    const total = items.length;
    const resolved = items.filter(i => i.status === 'resolved').length;
    const verified = items.filter(i => i.status === 'verified').length;

    let targetStatus = 'active';
    let signedOff = false;
    let signedOffAt = null;

    if (verified === total) {
      targetStatus = 'client_verified';
      signedOff = true;
      signedOffAt = new Date().toISOString();
    } else if (resolved + verified === total) {
      targetStatus = 'resolved';
    }

    await pool.query(
      `UPDATE punch_lists
       SET status = $1, signed_off_by_client = $2, client_signed_off_at = $3, updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5`,
      [targetStatus, signedOff, signedOffAt, punchListId, tenantId]
    );
  }

  async deletePunchListItem(tenantId, itemId) {
    const itemRes = await pool.query(
      'SELECT punch_list_id FROM punch_list_items WHERE id = $1 AND tenant_id = $2',
      [itemId, tenantId]
    );
    if (itemRes.rows.length === 0) return false;
    const punchListId = itemRes.rows[0].punch_list_id;

    const { rowCount } = await pool.query(
      'DELETE FROM punch_list_items WHERE id = $1 AND tenant_id = $2',
      [itemId, tenantId]
    );

    if (rowCount > 0) {
      await this.rollupPunchListStatus(tenantId, punchListId);
      return true;
    }
    return false;
  }
}

module.exports = new PunchListRepository();
