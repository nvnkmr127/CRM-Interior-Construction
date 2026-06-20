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
  let baseScore = 10;
  const breakdown = {
    "Engagement": 10,
    "Budget Fit": 10,
    "Timeline": 10,
    "Responsiveness": 10,
    "Decision Readiness": 10,
    "Property Readiness": 10,
    "Risk Level": 10
  };

  // 1. Budget Fit
  if (leadData.budget_max && Number(leadData.budget_max) > 0) {
    breakdown["Budget Fit"] += 40;
    baseScore += 10;
  }
  if (leadData.loan_approved) {
    breakdown["Budget Fit"] += 40;
    baseScore += 10;
  }

  // 2. Timeline
  if (leadData.possession_date) {
    const today = new Date();
    const possDate = new Date(leadData.possession_date);
    const monthsAway = (possDate.getTime() - today.getTime()) / (1000 * 3600 * 24 * 30);
    if (monthsAway <= 3 && monthsAway >= 0) {
      breakdown["Timeline"] += 70;
      baseScore += 15;
    } else if (monthsAway <= 6 && monthsAway > 3) {
      breakdown["Timeline"] += 40;
      baseScore += 10;
    } else {
      breakdown["Timeline"] += 20;
    }
  }

  // 3. Property Readiness
  if (leadData.house_status === 'ready' || leadData.house_status === 'possession_taken') {
    breakdown["Property Readiness"] += 70;
    baseScore += 15;
  } else if (leadData.house_status === 'under_construction') {
    breakdown["Property Readiness"] += 30;
    baseScore += 5;
  }

  // 4. Decision Readiness & Completeness
  const decisionKeys = ['interior_style', 'material_preference', 'property_type', 'carpet_area_sqft'];
  let filled = 0;
  decisionKeys.forEach(k => { if (leadData[k]) filled++; });
  breakdown["Decision Readiness"] = 10 + Math.round((filled / decisionKeys.length) * 80);
  baseScore += (filled * 5);

  // 5. Engagement & Responsiveness (Derived from days in stage / last contact)
  if (leadData.days_in_stage !== undefined) {
    if (leadData.days_in_stage < 3) {
      breakdown["Engagement"] += 60;
      breakdown["Responsiveness"] += 60;
      baseScore += 15;
    } else if (leadData.days_in_stage < 7) {
      breakdown["Engagement"] += 30;
      breakdown["Responsiveness"] += 30;
      baseScore += 5;
    }
  } else {
    // Default assumptions if missing
    breakdown["Engagement"] += 20;
    breakdown["Responsiveness"] += 20;
  }

  // 6. Risk Level
  if (leadData.competitor_mentioned) {
    breakdown["Risk Level"] += 50; // Higher risk
    baseScore -= 10;
  }
  
  // Cap sub-scores at 100
  Object.keys(breakdown).forEach(key => {
    if (breakdown[key] > 100) breakdown[key] = 100;
  });

  if (baseScore > 99) baseScore = 99;
  if (baseScore < 1) baseScore = 1;

  return {
    win_probability: Math.round(baseScore),
    ai_score_breakdown: breakdown
  };
}

module.exports = {
  scoreLead,
  getAndScoreLead,
  calculateAIScore
};
