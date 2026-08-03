const { pool } = require('./server/src/config/db'); 
pool.query('SELECT id, name, status, created_at, tenant_id FROM projects WHERE deleted_at IS NULL').then(res => { 
  console.log(res.rows); 
  process.exit(0); 
}).catch(e => { 
  console.error(e); 
  process.exit(1); 
});
