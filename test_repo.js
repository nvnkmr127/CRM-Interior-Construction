process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = require('./server/src/db/pool');
const { createLead, findLeadById } = require('./server/src/repositories/leadRepository');

async function test() {
  const tenants = await pool.query('SELECT id FROM tenants LIMIT 1');
  const tenantId = tenants.rows[0].id;

  try {
    const leadData = {
      name: 'Test Lead properties integration',
      phone: '555-000-1111',
      builder_name: 'Prestige Group',
      possession_date: '2026-10-01',
      house_status: 'Under Construction',
      property_type: 'Apartment',
      carpet_area_sqft: 1500,
      interior_style: 'Modern Minimalist',
      material_preference: 'Premium'
    };

    console.log('Creating lead...');
    const lead = await createLead(tenantId, leadData);
    console.log('Created Lead ID:', lead.id);

    console.log('Fetching lead to verify joins...');
    const fetchedLead = await findLeadById(tenantId, lead.id);
    console.log('Fetched Lead:', JSON.stringify(fetchedLead, null, 2));

  } catch(err) {
    console.error('Test failed:', err);
  } finally {
    process.exit(0);
  }
}

test();
