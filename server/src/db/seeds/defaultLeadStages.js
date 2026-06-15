const pool = require('../pool');

async function seedDefaultStages(tenantId) {
  const query = `
    INSERT INTO lead_stages (tenant_id, name, color, sort_order) VALUES
      ($1, 'New', '#6B6B6B', 1),
      ($1, 'Contacted', '#1A3A5C', 2),
      ($1, 'Qualified', '#C4956A', 3),
      ($1, 'Site Visit Scheduled', '#8B5E0A', 4),
      ($1, 'Proposal Sent', '#2D5A8E', 5),
      ($1, 'Won', '#2D6A4F', 6),
      ($1, 'Lost', '#8B2020', 7)
    ON CONFLICT DO NOTHING;
  `;
  await pool.query(query, [tenantId]);
}

module.exports = { seedDefaultStages };
