const pool = require('../db/pool');

function getTenantAndUser(req) {
  const tenantId = req.user.tenantId || req.tenantId;
  const userId = req.user.id;
  if (!tenantId || !userId) {
    throw new Error('Unauthorized');
  }
  return { tenantId, userId };
}

exports.globalSearchHandler = async function globalSearchHandler(req, res) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const q = req.query.q || '';
    const types = req.query.types;

    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const searchTypes = types ? types.split(',') : ['leads', 'projects', 'tasks', 'contacts', 'users'];
    // In PostgreSQL FTS, we just pass the query directly to plainto_tsquery.
    const searchTerm = q;

    const promises = [];

    if (searchTypes.includes('leads')) {
      promises.push(
        pool.query(`
          SELECT id, name, phone, email, source,
            (SELECT name FROM lead_stages WHERE id=stage_id) as stage_name
          FROM leads
          WHERE tenant_id=$1 AND deleted_at IS NULL
          AND search_vector @@ plainto_tsquery('english', $2)
          ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
          LIMIT 5
        `, [tenantId, searchTerm]).then(res => res.rows.map(r => ({
          type: 'lead',
          id: r.id,
          title: r.name,
          subtitle: r.stage_name || 'New Lead',
          meta: { phone: r.phone, email: r.email }
        })))
      );
    }

    if (searchTypes.includes('projects')) {
      promises.push(
        pool.query(`
          SELECT id, name, client_name, status,
            (SELECT name FROM users WHERE id=pm_id) as pm_name
          FROM projects
          WHERE tenant_id=$1 AND deleted_at IS NULL
          AND search_vector @@ plainto_tsquery('english', $2)
          ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
          LIMIT 5
        `, [tenantId, searchTerm]).then(res => res.rows.map(r => ({
          type: 'project',
          id: r.id,
          title: r.name,
          subtitle: `Client: ${r.client_name} - ${r.status}`,
          meta: { status: r.status, pm_name: r.pm_name }
        })))
      );
    }

    if (searchTypes.includes('tasks')) {
      promises.push(
        pool.query(`
          SELECT t.id, t.title, t.status, t.priority,
            p.name as project_name, p.id as project_id
          FROM tasks t
          JOIN projects p ON p.id=t.project_id
          WHERE t.tenant_id=$1 AND t.deleted_at IS NULL
          AND t.search_vector @@ plainto_tsquery('english', $2)
          ORDER BY ts_rank(t.search_vector, plainto_tsquery('english', $2)) DESC
          LIMIT 5
        `, [tenantId, searchTerm]).then(res => res.rows.map(r => ({
          type: 'task',
          id: r.id,
          title: r.title,
          subtitle: `Project: ${r.project_name} - ${r.status}`,
          meta: { priority: r.priority, project_id: r.project_id }
        })))
      );
    }

    if (searchTypes.includes('leads') || searchTypes.includes('contacts')) {
      promises.push(
        pool.query(`
          SELECT id, lead_id, name, phone, email, role 
          FROM lead_contacts 
          WHERE tenant_id = $1 
          AND search_vector @@ plainto_tsquery('english', $2)
          ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
          LIMIT 5
        `, [tenantId, searchTerm]).then(res => res.rows.map(r => ({
          type: 'contact',
          id: r.id,
          title: r.name,
          subtitle: `Role: ${r.role || 'Contact'}`,
          meta: { lead_id: r.lead_id, phone: r.phone, email: r.email }
        })))
      );
    }

    if (searchTypes.includes('users')) {
      promises.push(
        pool.query(`
          SELECT id, name, email, role 
          FROM users 
          WHERE tenant_id = $1 AND deleted_at IS NULL
          AND search_vector @@ plainto_tsquery('english', $2)
          ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
          LIMIT 5
        `, [tenantId, searchTerm]).then(res => res.rows.map(r => ({
          type: 'user',
          id: r.id,
          title: r.name,
          subtitle: `Role: ${r.role}`,
          meta: { email: r.email }
        })))
      );
    }

    const resolvedArrays = await Promise.all(promises);
    
    // Flatten into a single array
    const flattenedResults = resolvedArrays.reduce((acc, curr) => acc.concat(curr), []);

    return res.json({ success: true, data: flattenedResults, query: q });

  } catch (err) {
    console.error('globalSearchHandler error:', err);
    res.status(500).json({ success: false, error: { message: 'Failed to perform search' } });
  }
};
