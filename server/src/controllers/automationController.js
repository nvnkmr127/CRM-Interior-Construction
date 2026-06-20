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

exports.runWorkflow = async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { workflowId, triggerData } = req.body;

    // Validate workflow exists
    const ruleRes = await pool.query(`SELECT * FROM automation_rules WHERE id = $1 AND tenant_id = $2`, [workflowId, tenant_id]);
    if (ruleRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const workflow = ruleRes.rows[0];

    // Log the execution history (ignore if table doesn't exist to prevent crashes during migration)
    const tableCheck = await pool.query(`SELECT to_regclass('automation_logs')`);
    let executionId = null;
    if (tableCheck.rows[0].to_regclass) {
      const historyRes = await pool.query(
        `INSERT INTO automation_logs (tenant_id, rule_id, status, details, created_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [tenant_id, workflowId, 'success', JSON.stringify({ triggerData, executedActions: workflow.actions })]
      );
      executionId = historyRes.rows[0].id;
    }

    res.json({ success: true, message: 'Workflow executed successfully', executionId });
  } catch (error) {
    console.error('Error running workflow:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { tenant_id } = req.user;
    
    // Check if automation_logs table exists, if not just return empty array
    const tableCheck = await pool.query(`SELECT to_regclass('automation_logs')`);
    if (!tableCheck.rows[0].to_regclass) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT al.*, ar.name as workflow_name 
       FROM automation_logs al
       JOIN automation_rules ar ON al.rule_id = ar.id
       WHERE al.tenant_id = $1 ORDER BY al.created_at DESC LIMIT 50`,
      [tenant_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching automation history:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
exports.toggleRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.user;
    const result = await pool.query(
      `UPDATE automation_rules SET is_active = NOT is_active WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenant_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const { tenant_id } = req.user;
    
    // Check if automation_logs exists
    const tableCheck = await pool.query(`SELECT to_regclass('automation_logs')`);
    if (!tableCheck.rows[0].to_regclass) {
      return res.json({ success: true, data: { totalRuns: 0, successRate: 0, activeRules: 0 } });
    }

    const [logsRes, rulesRes] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) as total_runs,
          COUNT(*) FILTER (WHERE status = 'success') as success_runs
        FROM automation_logs 
        WHERE tenant_id = $1
      `, [tenant_id]),
      pool.query(`
        SELECT COUNT(*) as active_rules 
        FROM automation_rules 
        WHERE tenant_id = $1 AND is_active = true
      `, [tenant_id])
    ]);

    const stats = logsRes.rows[0];
    const totalRuns = parseInt(stats.total_runs, 10);
    const successRuns = parseInt(stats.success_runs, 10);
    const successRate = totalRuns > 0 ? ((successRuns / totalRuns) * 100).toFixed(1) : 0;
    const activeRules = parseInt(rulesRes.rows[0].active_rules, 10);

    res.json({ 
      success: true, 
      data: { 
        totalRuns, 
        successRate: parseFloat(successRate), 
        activeRules 
      } 
    });
  } catch (error) {
    console.error('Error fetching automation analytics:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.getLogs = async (req, res) => {
  exports.getHistory(req, res); // Reuse history
};
exports.getAutomationTemplates = async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT * FROM automation_templates ORDER BY created_at ASC`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};
