const fs = require('fs');

const filePath = 'server/src/controllers/leadController.js';
let content = fs.readFileSync(filePath, 'utf-8');

const regex = /const \{\s*booking_received[\s\S]*?const lead = leadRes\.rows\[0\];/m;

const newStr = `const { 
      booking_received, floor_plan, scope_finalized,
      projectName, projectType, clientName, clientPhone, clientEmail, pm, contractValue 
    } = req.body;

    if (!booking_received || !floor_plan || !scope_finalized) {
      return fail(res, 'VALIDATION_ERROR', 'All checklist items must be verified to convert.', 400);
    }
    if (!projectName || !projectType) {
      return fail(res, 'VALIDATION_ERROR', 'Project name and type are required.', 400);
    }

    // 1. Get the lead
    const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1 AND tenant_id = $2', [leadId, tenantId]);
    if (leadRes.rows.length === 0) return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    const lead = leadRes.rows[0];`;

content = content.replace(/const \{[\s\S]*?const lead = leadRes\.rows\[0\];/m, newStr);

// Wait, the previous replacement already DELETED all of that!
// Let me look at the file as it currently is to ensure I replace it correctly.
