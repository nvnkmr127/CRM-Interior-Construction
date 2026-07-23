const fs = require('fs');

const path = 'server/src/routes/users.js';
let content = fs.readFileSync(path, 'utf8');

const imports = `const express = require('express');
const bcrypt = require('bcryptjs');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');
const crypto = require('crypto');
const { logAction } = require('../services/auditLog');
const { queueEmail } = require('../services/emailService');
const aiEmployeeService = require('../services/aiEmployeeService');`;

content = content.replace(/const express = require\('express'\);[\s\S]*?const { queueEmail } = require\('\.\.\/services\/emailService'\);/, imports);

const aiRoutes = `
// AI Routes
router.get('/ai/insights', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role_id, status, last_login_at as "lastActive" FROM users WHERE tenant_id=$1 AND deleted_at IS NULL', [req.tenantId]);
    
    // Attach roles if needed
    const rolesReq = await pool.query('SELECT id, name FROM roles WHERE tenant_id=$1', [req.tenantId]);
    const roleMap = {};
    rolesReq.rows.forEach(r => roleMap[r.id] = r.name);
    
    const users = rows.map(u => ({ ...u, role_name: roleMap[u.role_id] || 'Unknown' }));
    
    const insights = await aiEmployeeService.detectAnomalies(users);
    res.json(success(insights));
  } catch (error) {
    res.status(500).json(fail('Failed to fetch AI insights'));
  }
});

router.post('/ai/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.json(success({ matchingIds: [] }));

    const { rows } = await pool.query('SELECT id, name, email, status, department_id, role_id FROM users WHERE tenant_id=$1 AND deleted_at IS NULL', [req.tenantId]);
    
    const rolesReq = await pool.query('SELECT id, name FROM roles WHERE tenant_id=$1', [req.tenantId]);
    const roleMap = {};
    rolesReq.rows.forEach(r => roleMap[r.id] = r.name);
    
    const deptReq = await pool.query('SELECT id, name FROM departments WHERE tenant_id=$1', [req.tenantId]);
    const deptMap = {};
    deptReq.rows.forEach(d => deptMap[d.id] = d.name);

    const users = rows.map(u => ({ 
      ...u, 
      role_name: roleMap[u.role_id],
      department_name: deptMap[u.department_id] 
    }));

    const result = await aiEmployeeService.naturalLanguageSearch(query, users);
    res.json(success(result));
  } catch (error) {
    res.status(500).json(fail('AI Search Failed'));
  }
});

router.get('/:id/ai/summary', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id=$1 AND u.tenant_id=$2', [req.params.id, req.tenantId]);
    if (rows.length === 0) return res.status(404).json(fail('User not found'));
    
    const user = rows[0];
    user.lastActive = user.last_login_at;
    
    const summary = await aiEmployeeService.generateEmployeeSummary(user);
    res.json(success({ summary }));
  } catch (error) {
    res.status(500).json(fail('Failed to generate summary'));
  }
});

router.get('/ai/onboarding', async (req, res) => {
  try {
    const { role_id, department_id } = req.query;
    let roleName = 'Employee';
    let deptName = 'General';
    
    if (role_id) {
      const r = await pool.query('SELECT name FROM roles WHERE id=$1 AND tenant_id=$2', [role_id, req.tenantId]);
      if (r.rows.length) roleName = r.rows[0].name;
    }
    if (department_id) {
      const d = await pool.query('SELECT name FROM departments WHERE id=$1 AND tenant_id=$2', [department_id, req.tenantId]);
      if (d.rows.length) deptName = d.rows[0].name;
    }

    const checklist = await aiEmployeeService.generateOnboardingChecklist(roleName, deptName);
    res.json(success({ checklist }));
  } catch (error) {
    res.status(500).json(fail('Failed to generate checklist'));
  }
});

router.get('/', async (req, res) => {
`;

content = content.replace("router.get('/', async (req, res) => {", aiRoutes);

fs.writeFileSync(path, content, 'utf8');
console.log('Routes updated');
