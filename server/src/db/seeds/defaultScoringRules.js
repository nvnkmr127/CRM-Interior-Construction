const pool = require('../pool');

async function seedDefaultScoringRules(tenantId) {
  const query = `
    INSERT INTO lead_scoring_rules (tenant_id, name, field, operator, value, weight) VALUES
      ($1, 'Facebook Source', 'source', 'eq', 'facebook', 5),
      ($1, 'Indimart Source', 'source', 'eq', 'indimart', 10),
      ($1, 'Referral Source', 'source', 'eq', 'referral', 20),
      ($1, 'Phone Number Provided', 'phone', 'is_not_empty', NULL, 15),
      ($1, 'Budget over 10L', 'custom_fields.budget', 'contains', '>10L', 25)
    ON CONFLICT DO NOTHING;
  `;
  await pool.query(query, [tenantId]);
}

module.exports = { seedDefaultScoringRules };
