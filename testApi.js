const { updateProject } = require('./server/src/services/projects/updateProject');
const { pool } = require('./server/src/config/db');

async function test() {
  const { rows } = await pool.query('SELECT id, tenant_id FROM projects LIMIT 1');
  const project = rows[0];
  
  if (project) {
    const data = {
      designer_ids: ['6199a071-8b2b-4d43-a63e-3242095cc105', 'b6f6580a-992a-43cf-bf29-373305d2cbbe']
    };
    try {
      const result = await updateProject({
        tenantId: project.tenant_id,
        userId: '11111111-1111-1111-1111-111111111111',
        projectId: project.id,
        data
      });
      console.log('Update result designer_ids:', result.designer_ids);
      console.log('Update result designer_name:', result.designer_name);
    } catch (err) {
      console.error('Update failed:', err);
    }
  }
  process.exit(0);
}
test();
