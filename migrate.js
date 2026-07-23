const pool = require('./server/src/config/db');

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_offboarding (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending_manager',
        resignation_date DATE,
        last_working_day DATE,
        manager_approved_at TIMESTAMP,
        hr_approved_at TIMESTAMP,
        knowledge_transfer_done BOOLEAN DEFAULT false,
        project_transfer_done BOOLEAN DEFAULT false,
        task_transfer_done BOOLEAN DEFAULT false,
        assets_returned BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Success');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
migrate();
