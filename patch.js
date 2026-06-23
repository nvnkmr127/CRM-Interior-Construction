const fs = require('fs');

const filePath = 'server/src/controllers/leadController.js';
let content = fs.readFileSync(filePath, 'utf-8');

const oldStr = `    // 2. Insert into projects
    const insertRes = await pool.query(\`
      INSERT INTO projects (tenant_id, name, client_name, pm_id, status, value, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'active', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    \`, [tenantId, projectName, clientName || lead.name, pm, contractValue || lead.budget_max || 0]);
    
    const newProjectId = insertRes.rows[0].id;`;

const newStr = `    // 2. Create project using the service to ensure all fields and automations are triggered
    const { createProject } = require('../services/projects/createProject');
    const newProject = await createProject({
      tenantId,
      userId,
      data: {
        lead_id: leadId,
        name: projectName,
        project_type: projectType,
        client_name: clientName || lead.name,
        client_phone: clientPhone || lead.phone,
        client_email: clientEmail || lead.email,
        pm_id: pm,
        designer_id: req.body.designer,
        contract_value: contractValue || lead.budget_max || 0,
        start_date: req.body.startDate,
        target_date: req.body.handoverDate,
        custom_fields: {
          advance_amount: req.body.advanceAmount,
          payment_terms: req.body.paymentTerms,
          contract_signed: req.body.contract_signed,
          site_address_confirmed: req.body.site_address_confirmed
        }
      }
    });
    
    const newProjectId = newProject.id;`;

if (content.includes(oldStr)) {
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log("Patch applied successfully.");
} else {
    console.log("Could not find the target string. Looking for partial match...");
    const oldStrPart = "INSERT INTO projects (tenant_id, name, client_name, pm_id, status, value, created_at, updated_at)";
    if (content.includes(oldStrPart)) {
        console.log("Found partial match, replacing via regex");
        const regex = /\/\/ 2\. Insert into projects[\s\S]*?const newProjectId = insertRes\.rows\[0\]\.id;/m;
        content = content.replace(regex, newStr);
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log("Patch applied via regex.");
    } else {
        console.log("Target string absolutely not found.");
    }
}
