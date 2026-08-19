require('dotenv').config();
const pool = require('../src/config/db');

async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_offboarding (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id),
        resignation_date DATE NOT NULL,
        last_working_day DATE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending_manager',
        knowledge_transfer_done BOOLEAN DEFAULT false,
        project_transfer_done BOOLEAN DEFAULT false,
        task_transfer_done BOOLEAN DEFAULT false,
        assets_returned BOOLEAN DEFAULT false,
        manager_approved_at TIMESTAMP WITH TIME ZONE,
        hr_approved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('employee_offboarding table created.');
  } catch (error) {
    console.error('Error creating table:', error.message);
  }
  process.exit(0);
}

createTable();
