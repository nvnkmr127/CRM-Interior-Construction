const pool = require('../../db/pool');
const evaluateTrigger = require('./evaluateTrigger');
const executeAction = require('./executeAction');

/**
 * Processes an automation event by finding matching active rules and executing their actions.
 * @param {string} tenantId 
 * @param {string} eventType 
 * @param {Object} record - The main entity record (lead, etc.)
 * @param {Object} changes - The fields that were modified
 */
async function processEvent(tenantId, eventType, record, changes = {}) {
  try {
    // Fetch all active rules for this tenant
    // In a highly scaled system, we'd cache these or filter by eventType in the DB query
    const res = await pool.query(`
      SELECT * FROM automation_rules
      WHERE tenant_id = $1 AND is_active = true
    `, [tenantId]);

    const rules = res.rows;

    for (const ruleRow of rules) {
      let triggerDef;
      let conditionsDef;
      let actionsDef;
      
      try {
        triggerDef = JSON.parse(ruleRow.trigger);
        conditionsDef = JSON.parse(ruleRow.conditions || '[]');
        actionsDef = JSON.parse(ruleRow.actions || '[]');
      } catch(e) {
        console.error(`[RuleEvaluator] Failed to parse rule definition for rule ${ruleRow.id}`, e);
        continue;
      }

      const ruleDef = {
        id: ruleRow.id,
        trigger: triggerDef,
        conditions: conditionsDef,
        actions: actionsDef
      };

      // Ensure _entity is set for evaluation
      if (!record._entity) {
         // Try to infer from eventType or record structure, but ideally passed in
         if (eventType.includes('lead')) record._entity = 'lead';
         if (eventType.includes('project')) record._entity = 'project';
      }

      const isMatch = evaluateTrigger(ruleDef, eventType, record, changes);

      if (isMatch) {
        console.log(`[RuleEvaluator] Rule ${ruleRow.id} matched event ${eventType}`);
        
        // Update last run stats
        await pool.query(`
          UPDATE automation_rules 
          SET last_run_at = CURRENT_TIMESTAMP, run_count = COALESCE(run_count, 0) + 1 
          WHERE id = $1
        `, [ruleRow.id]);

        const context = {
          tenantId,
          userId: 'system',
          record,
          triggeredBy: ruleRow.id,
          eventType
        };

        // Execute all actions
        for (const action of ruleDef.actions) {
          // Fire and forget or await, depending on required sequence
          await executeAction(action, context);
        }
      }
    }
  } catch (error) {
    console.error(`[RuleEvaluator] Error processing event ${eventType}:`, error);
  }
}

module.exports = {
  processEvent
};
