const express = require('express');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  const tenantId = req.tenantId;
  const q = req.query.q || '';
  const types = req.query.types;
  
  if (q.length < 2) {
    return res.status(400).json(fail('Query too short'));
  }

  const searchTypes = types ? types.split(',') : ['leads', 'projects', 'tasks'];
  const searchTerm = `%${q}%`;

  const results = { leads: [], projects: [], tasks: [], contacts: [], activities: [], query: q };
  const promises = [];

  try {
    if (searchTypes.includes('leads')) {
      promises.push(
        pool.query(`
          SELECT id, name, phone, email, source,
            (SELECT name FROM lead_stages WHERE id=stage_id) as stage_name
          FROM leads
          WHERE tenant_id=$1 AND deleted_at IS NULL
          AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)
          LIMIT 5
        `, [tenantId, searchTerm]).then(res => results.leads = res.rows)
      );
    }

    if (searchTypes.includes('projects')) {
      promises.push(
        pool.query(`
          SELECT id, name, client_name, status,
            (SELECT name FROM users WHERE id=pm_id) as pm_name
          FROM projects
          WHERE tenant_id=$1 AND deleted_at IS NULL
          AND (name ILIKE $2 OR client_name ILIKE $2)
          LIMIT 5
        `, [tenantId, searchTerm]).then(res => results.projects = res.rows)
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
          AND t.title ILIKE $2
          LIMIT 5
        `, [tenantId, searchTerm]).then(res => results.tasks = res.rows)
      );
    }

    if (searchTypes.includes('leads') || searchTypes.includes('contacts')) {
      promises.push(
        pool.query(`
          SELECT id, lead_id, name, phone, email, role 
          FROM lead_contacts 
          WHERE tenant_id = $1 
          AND (
            name ILIKE $2 OR 
            email ILIKE $2 OR 
            phone ILIKE $2
          )
          LIMIT 5
        `, [tenantId, searchTerm]).then(res => results.contacts = res.rows)
      );
    }

    if (searchTypes.includes('leads') || searchTypes.includes('activities')) {
      promises.push(
        pool.query(`
          SELECT a.id, a.lead_id, a.type, a.notes, l.name as lead_name
          FROM lead_activities a
          JOIN leads l ON a.lead_id = l.id
          WHERE a.tenant_id = $1 AND l.deleted_at IS NULL
          AND a.notes ILIKE $2
          LIMIT 5
        `, [tenantId, searchTerm]).then(res => results.activities = res.rows)
      );
    }

    await Promise.all(promises);

    return success(res, results);
  } catch (error) {
    res.status(500).json(fail('Search failed'));
  }
});

module.exports = router;
