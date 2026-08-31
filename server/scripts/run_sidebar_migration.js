const pool = require('../src/db/pool');

async function migrate() {
  try {
    console.log('Running sidebar tab configurations database migration...');
    
    // Create role-based sidebar config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sidebar_tabs_role_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_name VARCHAR(100) NOT NULL UNIQUE,
        enabled_tabs TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create plan-based sidebar config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sidebar_tabs_plan_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_name VARCHAR(100) NOT NULL UNIQUE,
        enabled_tabs TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Sidebar tab configuration tables created successfully');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

migrate();
