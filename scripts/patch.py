import os

file_path = r'd:\Digicloudify softwares\CRM-Interior-Construction\server\src\controllers\leadController.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_str = """    // 2. Insert into projects
    const insertRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, pm_id, status, value, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'active', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `, [tenantId, projectName, clientName || lead.name, pm, contractValue || lead.budget_max || 0]);
    
    const newProjectId = insertRes.rows[0].id;"""

new_str = """    // 2. Create project using the service to ensure all fields and automations are triggered
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
    
    const newProjectId = newProject.id;"""

if old_str in content:
    content = content.replace(old_str, new_str)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Patch applied successfully.")
else:
    print("Could not find the target string to replace. The file might have been changed.")
