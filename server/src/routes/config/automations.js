const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../../utils/response');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const pool = require('../../db/pool');
const evaluateTrigger = require('../../services/automation/evaluateTrigger');
const executeAction = require('../../services/automation/executeAction');

const router = express.Router();

router.use(authenticate, authorize('config:manage'));

router.get('/', async (req, res, next) => {
  try {
    const query = `
      SELECT id, name, trigger, conditions, actions, is_active, run_count, last_run_at, created_at 
      FROM automation_rules 
      WHERE tenant_id = $1 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [req.tenantId]);
    return success(res, result.rows);
  } catch (error) {
    next(error);
  }
});

const ruleSchema = z.object({
  name: z.string().min(1),
  trigger: z.record(z.any()),
  conditions: z.array(z.any()).optional(),
  actions: z.array(z.any()).optional()
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = ruleSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.isValidation = true;
      err.details = parsed.error.issues;
      return next(err);
    }

    const { name, trigger, conditions = [], actions = [] } = parsed.data;

    const query = `
      INSERT INTO automation_rules (tenant_id, created_by, name, trigger, conditions, actions)
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)
      RETURNING id, name, trigger, conditions, actions, is_active, run_count, last_run_at, created_at
    `;
    
    const result = await pool.query(query, [
      req.tenantId, 
      req.user.id, 
      name, 
      JSON.stringify(trigger), 
      JSON.stringify(conditions), 
      JSON.stringify(actions)
    ]);
    
    return success(res, result.rows[0], {}, 201);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const parsed = ruleSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.isValidation = true;
      err.details = parsed.error.issues;
      return next(err);
    }

    const { name, trigger, conditions = [], actions = [] } = parsed.data;

    const query = `
      UPDATE automation_rules
      SET name = $1, trigger = $2::jsonb, conditions = $3::jsonb, actions = $4::jsonb, updated_at = NOW()
      WHERE id = $5 AND tenant_id = $6
      RETURNING id, name, trigger, conditions, actions, is_active, run_count, last_run_at, created_at
    `;
    
    const result = await pool.query(query, [
      name, 
      JSON.stringify(trigger), 
      JSON.stringify(conditions), 
      JSON.stringify(actions), 
      req.params.id, 
      req.tenantId
    ]);

    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Automation rule not found', 404);
    }
    
    return success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const query = `
      DELETE FROM automation_rules
      WHERE id = $1 AND tenant_id = $2
    `;
    await pool.query(query, [req.params.id, req.tenantId]);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const query = `
      UPDATE automation_rules
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, is_active
    `;
    const result = await pool.query(query, [req.params.id, req.tenantId]);

    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Automation rule not found', 404);
    }

    return success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

const testRunSchema = z.object({
  record: z.record(z.any())
});

router.post('/:id/test-run', async (req, res, next) => {
  try {
    const parsed = testRunSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.isValidation = true;
      err.details = parsed.error.issues;
      return next(err);
    }

    const ruleRes = await pool.query(`
      SELECT * FROM automation_rules WHERE id = $1 AND tenant_id = $2
    `, [req.params.id, req.tenantId]);

    if (ruleRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Automation rule not found', 404);
    }

    const rule = ruleRes.rows[0];
    const record = parsed.data.record;

    // Simulate event by passing the expected rule trigger type directly
    const shouldFire = evaluateTrigger(rule, rule.trigger.type, record, record);

    const actionsExecuted = [];
    if (shouldFire) {
      const actions = rule.actions || [];
      for (const action of actions) {
        const context = {
          tenantId: req.tenantId,
          userId: req.user.id,
          record: record,
          triggeredBy: rule.id
        };
        await executeAction(action, context);
        actionsExecuted.push(action.type);
      }
    }

    return success(res, { triggered: shouldFire, actionsExecuted });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
