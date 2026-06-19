const pool = require('../../db/pool');

function getFieldValue(obj, path) {
  if (!path) return undefined;
  
  // Handle standard dot notation (e.g. "custom_fields.budget")
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    // If we're accessing custom_fields and it's a JSON string, parse it first
    if (part === 'custom_fields' && typeof current[part] === 'string') {
      try {
        current[part] = JSON.parse(current[part]);
      } catch (e) {
        return undefined;
      }
    }
    
    current = current[part];
  }
  
  return current;
}

function scoreLead(leadData, scoringRules) {
  let score = 0;
  
  for (const rule of scoringRules) {
    // Only process active rules
    if (rule.is_active === false) continue;
    
    const value = getFieldValue(leadData, rule.field);
    let isMatch = false;
    
    const ruleValueStr = rule.value ? String(rule.value).toLowerCase() : '';
    const valStr = value !== null && value !== undefined ? String(value).toLowerCase() : '';
    
    const numValue = Number(value);
    const ruleNumValue = Number(rule.value);
    
    switch (rule.operator) {
      case 'eq':
        isMatch = valStr === ruleValueStr;
        break;
      case 'neq':
        isMatch = valStr !== ruleValueStr;
        break;
      case 'contains':
        isMatch = valStr.includes(ruleValueStr);
        break;
      case 'is_not_empty':
        isMatch = valStr.trim() !== '';
        break;
      case 'gt':
        if (!isNaN(numValue) && !isNaN(ruleNumValue)) {
          isMatch = numValue > ruleNumValue;
        }
        break;
      case 'lt':
        if (!isNaN(numValue) && !isNaN(ruleNumValue)) {
          isMatch = numValue < ruleNumValue;
        }
        break;
      default:
        isMatch = false;
    }
    
    if (isMatch) {
      score += (rule.weight || 0);
    }
  }
  
  // Clamp score between 0 and 100
  if (score < 0) score = 0;
  if (score > 100) score = 100;
  
  return Math.round(score);
}

async function getAndScoreLead(tenantId, leadData) {
  const query = `
    SELECT * FROM lead_scoring_rules
    WHERE tenant_id = $1 AND is_active = true
  `;
  const result = await pool.query(query, [tenantId]);
  return scoreLead(leadData, result.rows);
}

function calculateAIScore(leadData) {
  let winProb = 10;
  const breakdown = {
    "Buying Intent": 10,
    "Budget Confidence": 10,
    "Completeness": 0
  };

  if (leadData.budget_max && Number(leadData.budget_max) > 0) {
    breakdown["Budget Confidence"] += 40;
    winProb += 20;
  }
  if (leadData.loan_approved) {
    breakdown["Budget Confidence"] += 40;
    winProb += 15;
  }

  if (leadData.possession_date) {
    const today = new Date();
    const possDate = new Date(leadData.possession_date);
    const monthsAway = (possDate.getTime() - today.getTime()) / (1000 * 3600 * 24 * 30);
    if (monthsAway <= 3 && monthsAway >= 0) {
      breakdown["Buying Intent"] += 50;
      winProb += 20;
    } else {
      breakdown["Buying Intent"] += 20;
    }
  }

  const keys = ['builder_name', 'house_status', 'interior_style', 'material_preference', 'property_type', 'carpet_area_sqft'];
  let filled = 0;
  keys.forEach(k => { if (leadData[k]) filled++; });
  breakdown["Completeness"] = Math.round((filled / keys.length) * 100);
  winProb += (filled * 5);

  if (winProb > 99) winProb = 99;

  return {
    win_probability: Math.round(winProb),
    ai_score_breakdown: breakdown
  };
}

module.exports = {
  scoreLead,
  getAndScoreLead,
  calculateAIScore
};
