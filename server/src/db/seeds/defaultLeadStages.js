const pool = require('../pool');

async function seedDefaultStages(tenantId) {
  const query = `
    INSERT INTO lead_stages (tenant_id, name, color, sort_order) VALUES
      ($1, 'Lead Capture', '#6B6B6B', 1),
      ($1, 'AI Qualification', '#1A3A5C', 2),
      ($1, 'Lead Assignment', '#2D5A8E', 3),
      ($1, 'First Contact', '#C4956A', 4),
      ($1, 'Discovery Call', '#8B5E0A', 5),
      ($1, 'AI Budgeting', '#E8A317', 6),
      ($1, 'Site Visit Scheduling', '#1589FF', 7),
      ($1, 'Site Visit Conducted', '#0000A0', 8),
      ($1, 'Inspiration & Prefs', '#B048B5', 9),
      ($1, 'AI Design Generation', '#800080', 10),
      ($1, 'Design Presentation', '#FF00FF', 11),
      ($1, 'Quotation', '#43BFC7', 12),
      ($1, 'Negotiation', '#FF7F50', 13),
      ($1, 'Closing', '#2D6A4F', 14)
    ON CONFLICT DO NOTHING;
  `;
  await pool.query(query, [tenantId]);
}

module.exports = { seedDefaultStages };
