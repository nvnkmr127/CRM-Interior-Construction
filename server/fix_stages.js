const db = require('./src/config/db');

async function fix() {
  try {
    await db.query('BEGIN');
    
    // Get all lead stages sorted by created_at
    const { rows: stages } = await db.query('SELECT id, name, tenant_id FROM lead_stages ORDER BY created_at ASC');
    
    const map = new Map();
    for (const s of stages) {
      const key = s.tenant_id + '|' + s.name;
      if (!map.has(key)) {
        map.set(key, s.id);
      } else {
        const keep_id = map.get(key);
        console.log(`Duplicate: ${s.name}, keeping: ${keep_id}, removing: ${s.id}`);
        
        // Update leads to use the keep_id
        await db.query('UPDATE leads SET stage_id = $1 WHERE stage_id = $2', [keep_id, s.id]);
        
        // Delete the duplicate stage
        await db.query('DELETE FROM lead_stages WHERE id = $1', [s.id]);
      }
    }
    
    await db.query('COMMIT');
    console.log('Successfully removed duplicate lead stages.');
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error fixing stages:', error);
  } finally {
    process.exit(0);
  }
}

fix();
