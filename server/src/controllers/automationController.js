const pool = require('../db/pool');

exports.getRules = async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const result = await pool.query(
      `SELECT * FROM automation_rules WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenant_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getRuleById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.user;
    const result = await pool.query(
      `SELECT * FROM automation_rules WHERE id = $1 AND tenant_id = $2`,
      [id, tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching automation rule:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createRule = async (req, res) => {
  try {
    const { tenant_id, id: user_id } = req.user;
    const { name, trigger, conditions, actions, is_active } = req.body;

    const result = await pool.query(
      `INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        tenant_id,
        name,
        typeof trigger === 'string' ? trigger : JSON.stringify(trigger),
        typeof conditions === 'string' ? conditions : JSON.stringify(conditions || []),
        typeof actions === 'string' ? actions : JSON.stringify(actions || []),
        is_active !== undefined ? is_active : true,
        user_id
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating automation rule:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.user;
    const { name, trigger, conditions, actions, is_active } = req.body;

    const result = await pool.query(
      `UPDATE automation_rules 
       SET name = COALESCE($1, name),
           trigger = COALESCE($2, trigger),
           conditions = COALESCE($3, conditions),
           actions = COALESCE($4, actions),
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND tenant_id = $7 RETURNING *`,
      [
        name,
        trigger ? (typeof trigger === 'string' ? trigger : JSON.stringify(trigger)) : null,
        conditions ? (typeof conditions === 'string' ? conditions : JSON.stringify(conditions)) : null,
        actions ? (typeof actions === 'string' ? actions : JSON.stringify(actions)) : null,
        is_active,
        id,
        tenant_id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating automation rule:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.user;
    const result = await pool.query(
      `DELETE FROM automation_rules WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenant_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
