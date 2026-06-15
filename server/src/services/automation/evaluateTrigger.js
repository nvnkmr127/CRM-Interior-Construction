/**
 * Helper to resolve dot-notation paths on an object (e.g., 'custom_fields.budget')
 */
function getDotProp(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

/**
 * Evaluates a single condition against a record value.
 */
function evaluateCondition(condition, record) {
  const { field, operator, value } = condition;
  const recordValue = getDotProp(record, field);

  switch (operator) {
    case 'eq':
      return String(recordValue) === String(value);
    case 'neq':
      return String(recordValue) !== String(value);
    case 'contains':
      if (typeof recordValue === 'string') {
        return recordValue.toLowerCase().includes(String(value).toLowerCase());
      }
      if (Array.isArray(recordValue)) {
        return recordValue.includes(value);
      }
      return false;
    case 'gt':
      return Number(recordValue) > Number(value);
    case 'lt':
      return Number(recordValue) < Number(value);
    case 'is_empty':
      return recordValue === null || recordValue === undefined || recordValue === '';
    case 'is_not_empty':
      return recordValue !== null && recordValue !== undefined && recordValue !== '';
    default:
      return false;
  }
}

/**
 * Evaluates whether an automation rule's trigger and conditions are satisfied 
 * by the given event payload and record state.
 * 
 * @param {Object} rule - The automation rule configuration
 * @param {string} eventType - The type of event (e.g., 'record.created', 'field.changed')
 * @param {Object} record - The primary entity record (lead, project, etc.)
 * @param {Object} changes - A delta object containing only the fields that were modified
 * @returns {boolean} True if the rule should fire, false otherwise
 */
function evaluateTrigger(rule, eventType, record, changes = {}) {
  const trigger = rule.trigger || {};

  // 1. Check rule.trigger.type matches eventType
  if (trigger.type !== eventType) {
    return false;
  }

  // 2. Check rule.trigger.entity matches record entity type.
  // Assumes the caller injects the entity type into the record as '_entity', 
  // or that the caller only fetches rules scoped to the correct entity.
  // We'll enforce it if it's explicitly defined on the record.
  if (record._entity && trigger.entity !== record._entity) {
    return false;
  }

  // 3. If trigger type is 'field.changed', strictly ensure that specific field was actually altered
  if (trigger.type === 'field.changed') {
    const fieldName = trigger.config?.field;
    if (!fieldName || !(fieldName in changes)) {
      return false;
    }
  }

  // 4. Evaluate rule.conditions array
  const conditions = rule.conditions || [];
  if (conditions.length === 0) {
    return true; // No conditions strictly means it always fires if the trigger matched
  }

  const andConditions = conditions.filter(c => c.logic !== 'OR');
  const orConditions = conditions.filter(c => c.logic === 'OR');

  // Group logic: all AND conditions MUST pass
  for (const cond of andConditions) {
    if (!evaluateCondition(cond, record)) {
      return false;
    }
  }

  // Group logic: at least one OR condition MUST pass (if any ORs exist)
  if (orConditions.length > 0) {
    let anyOrPassed = false;
    for (const cond of orConditions) {
      if (evaluateCondition(cond, record)) {
        anyOrPassed = true;
        break;
      }
    }
    if (!anyOrPassed) {
      return false;
    }
  }

  // 5. Return true only if all requirements are structurally satisfied
  return true;
}

module.exports = evaluateTrigger;
