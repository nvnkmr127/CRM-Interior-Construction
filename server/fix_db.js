const pool = require('./src/db/pool');

async function fixBooleans() {
  const queries = [
    'ALTER TABLE leads ALTER COLUMN score DROP DEFAULT',
    'ALTER TABLE leads ALTER COLUMN score TYPE INTEGER USING (CASE WHEN score THEN 1 ELSE 0 END)',
    'ALTER TABLE leads ALTER COLUMN score SET DEFAULT 0',
    
    'ALTER TABLE project_phases ALTER COLUMN sort_order DROP DEFAULT',
    'ALTER TABLE project_phases ALTER COLUMN sort_order TYPE INTEGER USING (CASE WHEN sort_order THEN 1 ELSE 0 END)',
    'ALTER TABLE project_phases ALTER COLUMN sort_order SET DEFAULT 0',
    
    'ALTER TABLE milestones ALTER COLUMN sort_order DROP DEFAULT',
    'ALTER TABLE milestones ALTER COLUMN sort_order TYPE INTEGER USING (CASE WHEN sort_order THEN 1 ELSE 0 END)',
    'ALTER TABLE milestones ALTER COLUMN sort_order SET DEFAULT 0',
    
    'ALTER TABLE tasks ALTER COLUMN sort_order DROP DEFAULT',
    'ALTER TABLE tasks ALTER COLUMN sort_order TYPE INTEGER USING (CASE WHEN sort_order THEN 1 ELSE 0 END)',
    'ALTER TABLE tasks ALTER COLUMN sort_order SET DEFAULT 0',
    
    'ALTER TABLE custom_fields_config ALTER COLUMN sort_order DROP DEFAULT',
    'ALTER TABLE custom_fields_config ALTER COLUMN sort_order TYPE INTEGER USING (CASE WHEN sort_order THEN 1 ELSE 0 END)',
    'ALTER TABLE custom_fields_config ALTER COLUMN sort_order SET DEFAULT 0',
    
    'ALTER TABLE automation_rules ALTER COLUMN run_count DROP DEFAULT',
    'ALTER TABLE automation_rules ALTER COLUMN run_count TYPE INTEGER USING (CASE WHEN run_count THEN 1 ELSE 0 END)',
    'ALTER TABLE automation_rules ALTER COLUMN run_count SET DEFAULT 0',
  ];

  for (const q of queries) {
    try {
      await pool.query(q);
      console.log('Success:', q);
    } catch (e) {
      console.error('Error on:', q, e.message);
    }
  }
  process.exit(0);
}

fixBooleans();
