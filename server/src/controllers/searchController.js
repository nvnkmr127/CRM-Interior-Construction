const logger = require('../utils/logger');
const pool = require('../db/pool');
function getTenantAndUser(req) {
  const tenantId = req.user.tenantId || req.tenantId;
  const userId = req.user.id;
  if (!tenantId || !userId) {
    throw new Error('Unauthorized');
  }
  return { tenantId, userId };
}

exports.globalSearchHandler = async function globalSearchHandler(req, res, next) {
  try {
    const { tenantId } = getTenantAndUser(req);
    const q = req.query.q || '';
    const types = req.query.types;

    if (!q || q.length < 2) {
      return res.json({ success: true, leads: [], projects: [], tasks: [], contacts: [], users: [] });
    }

    const searchTypes = types ? types.split(',') : ['leads', 'projects', 'tasks', 'contacts', 'users'];
    
    // Split search query into lowercase words for dynamic ILIKE construction
    const words = q.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return res.json({ success: true, leads: [], projects: [], tasks: [], contacts: [], users: [] });
    }

    const responseData = {
      success: true,
      leads: [],
      projects: [],
      tasks: [],
      contacts: [],
      users: []
    };

    const promises = [];

    if (searchTypes.includes('leads')) {
      let query = `
        SELECT id, name, phone, email, source,
          (SELECT name FROM lead_stages WHERE id=stage_id) as stage_name
        FROM leads
        WHERE tenant_id = $1 AND deleted_at IS NULL
      `;
      const params = [tenantId];
      words.forEach(word => {
        const paramIdx = params.length + 1;
        query += ` AND (name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR phone ILIKE $${paramIdx})`;
        params.push(`%${word}%`);
      });
      query += ` ORDER BY name ASC LIMIT 10`;

      promises.push(
        pool.query(query, params).then(res => {
          responseData.leads = res.rows.map(r => ({
            id: r.id,
            name: r.name,
            stage_name: r.stage_name || 'New Lead',
            stageName: r.stage_name || 'New Lead',
            phone: r.phone,
            email: r.email,
            source: r.source
          }));
        })
      );
    }

    if (searchTypes.includes('projects')) {
      let query = `
        SELECT id, name, client_name, status,
          (SELECT name FROM users WHERE id=pm_id) as pm_name
        FROM projects
        WHERE tenant_id = $1 AND deleted_at IS NULL
      `;
      const params = [tenantId];
      words.forEach(word => {
        const paramIdx = params.length + 1;
        query += ` AND (name ILIKE $${paramIdx} OR client_name ILIKE $${paramIdx} OR client_email ILIKE $${paramIdx} OR client_phone ILIKE $${paramIdx})`;
        params.push(`%${word}%`);
      });
      query += ` ORDER BY name ASC LIMIT 10`;

      promises.push(
        pool.query(query, params).then(res => {
          responseData.projects = res.rows.map(r => ({
            id: r.id,
            name: r.name,
            clientName: r.client_name,
            client_name: r.client_name,
            status: r.status,
            pm_name: r.pm_name
          }));
        })
      );
    }

    if (searchTypes.includes('tasks')) {
      let query = `
        SELECT t.id, t.title, t.status, t.priority,
          p.name as project_name, p.id as project_id
        FROM tasks t
        JOIN projects p ON p.id=t.project_id
        WHERE t.tenant_id = $1 AND t.deleted_at IS NULL
      `;
      const params = [tenantId];
      words.forEach(word => {
        const paramIdx = params.length + 1;
        query += ` AND (t.title ILIKE $${paramIdx} OR t.description ILIKE $${paramIdx})`;
        params.push(`%${word}%`);
      });
      query += ` ORDER BY t.title ASC LIMIT 10`;

      promises.push(
        pool.query(query, params).then(res => {
          responseData.tasks = res.rows.map(r => ({
            id: r.id,
            title: r.title,
            name: r.title,
            projectName: r.project_name,
            project_name: r.project_name,
            status: r.status,
            priority: r.priority,
            project_id: r.project_id
          }));
        })
      );
    }

    if (searchTypes.includes('contacts')) {
      let query = `
        SELECT id, lead_id, name, phone, email, role 
        FROM lead_contacts 
        WHERE tenant_id = $1
      `;
      const params = [tenantId];
      words.forEach(word => {
        const paramIdx = params.length + 1;
        query += ` AND (name ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR phone ILIKE $${paramIdx})`;
        params.push(`%${word}%`);
      });
      query += ` ORDER BY name ASC LIMIT 10`;

      promises.push(
        pool.query(query, params).then(res => {
          responseData.contacts = res.rows.map(r => ({
            id: r.id,
            lead_id: r.lead_id,
            name: r.name,
            role: r.role,
            phone: r.phone,
            email: r.email
          }));
        })
      );
    }

    if (searchTypes.includes('users')) {
      let query = `
        SELECT id, name, email,
          (SELECT name FROM roles WHERE id=role_id) as role
        FROM users 
        WHERE tenant_id = $1 AND deleted_at IS NULL
      `;
      const params = [tenantId];
      words.forEach(word => {
        const paramIdx = params.length + 1;
        query += ` AND (name ILIKE $${paramIdx} OR email ILIKE $${paramIdx})`;
        params.push(`%${word}%`);
      });
      query += ` ORDER BY name ASC LIMIT 10`;

      promises.push(
        pool.query(query, params).then(res => {
          responseData.users = res.rows.map(r => ({
            id: r.id,
            name: r.name,
            role: r.role,
            email: r.email
          }));
        })
      );
    }

    await Promise.all(promises);
    console.log('Search controller resolved data counts:', {
      leads: responseData.leads.length,
      projects: responseData.projects.length,
      tasks: responseData.tasks.length,
      contacts: responseData.contacts.length
    });
    return res.json(responseData);

  } catch (error) {
    logger.error('globalSearchHandler error:', error);
    return next(error);
  }
};
