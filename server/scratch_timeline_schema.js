const pool = require('./src/db/pool');

async function createTimelineTables() {
  try {
    // 1. project_milestones table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_milestones (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        planned_start_date DATE,
        planned_end_date DATE,
        actual_start_date DATE,
        actual_end_date DATE,
        status VARCHAR(50) DEFAULT 'pending',
        is_critical BOOLEAN DEFAULT FALSE,
        dependency_id INTEGER REFERENCES project_milestones(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('project_milestones table created or already exists.');

    // 2. project_delays table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_delays (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        delay_days INTEGER DEFAULT 0,
        financial_impact NUMERIC(12, 2) DEFAULT 0,
        description TEXT,
        reported_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('project_delays table created or already exists.');

  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    pool.end();
  }
}

createTimelineTables();
