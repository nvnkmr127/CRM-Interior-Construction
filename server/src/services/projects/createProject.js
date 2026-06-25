const projectRepository = require('../../repositories/projectRepository');
const templateService = require('../templates/templateService');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');
const pool = require('../../config/db');

async function createProject({ tenantId, userId, data }) {
  const { 
    templateId, 
    contract_file_key, 
    contract_file_name, 
    contract_file_size, 
    contract_file_mime, 
    ...projectData 
  } = data;
  
  if ((projectData.booking_amount && Number(projectData.booking_amount) > 0) || projectData.payment_terms) {
    projectData.status = 'pending_payment';
  } else {
    projectData.status = projectData.status || 'active';
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create the base project
    const project = await projectRepository.createProject(tenantId, { 
      ...projectData, 
      created_by: userId 
    }, client);

    // Create contract document record if key is present
    if (contract_file_key) {
      await client.query(
        `INSERT INTO documents (
          tenant_id, project_id, name, doc_type, version, storage_key, file_size_bytes, mime_type, uploaded_by, status
        ) VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, 'approved')`,
        [
          tenantId,
          project.id,
          contract_file_name,
          'contract',
          contract_file_key,
          contract_file_size || null,
          contract_file_mime || null,
          userId
        ]
      );
    }

    // 1.5. If payment_terms are set, generate the structured payment milestone schedule
    if (project.payment_terms && project.contract_value && Number(project.contract_value) > 0) {
      const contractVal = Number(project.contract_value);
      const templates = {
        '10_40_40_10': [
          { name: 'Booking Advance', pct: 10 },
          { name: 'Design Sign-off', pct: 40 },
          { name: 'Production Commencement', pct: 40 },
          { name: 'Handover', pct: 10 }
        ],
        '30_30_30_10': [
          { name: 'Booking Advance', pct: 30 },
          { name: 'Material Procurement', pct: 30 },
          { name: 'Mid-Execution', pct: 30 },
          { name: 'Handover', pct: 10 }
        ],
        '50_50': [
          { name: 'Booking Advance', pct: 50 },
          { name: 'Final Handover', pct: 50 }
        ]
      };

      let milestoneDefinitions = templates[project.payment_terms];
      if (!milestoneDefinitions) {
        const parts = project.payment_terms.split('_').map(Number);
        const total = parts.reduce((a, b) => a + b, 0);
        if (total === 100) {
          milestoneDefinitions = parts.map((pct, idx) => ({
            name: idx === 0 ? 'Booking Advance' : (idx === parts.length - 1 ? 'Handover' : `Installment ${idx + 1}`),
            pct
          }));
        }
      }

      if (milestoneDefinitions) {
        // Generate milestones
        for (const definition of milestoneDefinitions) {
          const amount = (contractVal * (definition.pct / 100)).toFixed(2);
          await client.query(`
            INSERT INTO payment_milestones (tenant_id, project_id, name, amount, percentage, status)
            VALUES ($1, $2, $3, $4, $5, 'scheduled')
          `, [tenantId, project.id, definition.name, amount, definition.pct]);
        }

        // Keep booking_amount in sync with the first milestone (Booking Advance)
        const firstInstallment = milestoneDefinitions[0];
        const firstAmount = Number((contractVal * (firstInstallment.pct / 100)).toFixed(2));
        await client.query(`
          UPDATE projects
          SET booking_amount = $1
          WHERE id = $2 AND tenant_id = $3
        `, [firstAmount, project.id, tenantId]);
        project.booking_amount = firstAmount;
      }
    } else if (project.booking_amount && Number(project.booking_amount) > 0) {
      // Fallback: single Booking Advance milestone if no payment terms are specified
      const contractVal = Number(project.contract_value || project.booking_amount);
      const percentage = contractVal > 0 
        ? ((Number(project.booking_amount) / contractVal) * 100).toFixed(2)
        : 100.00;

      await client.query(`
        INSERT INTO payment_milestones (tenant_id, project_id, name, amount, percentage, status)
        VALUES ($1, $2, 'Booking Advance', $3, $4, 'scheduled')
      `, [tenantId, project.id, Number(project.booking_amount), percentage]);
    }

    // 2. Hydrate via template if requested
    if (templateId) {
      try {
        await templateService.applyTemplate(project.id, templateId, tenantId, client);
      } catch (error) {
        console.error(`Failed to apply template ${templateId} to project ${project.id}:`, error);
        throw error; // Let the transaction rollback
      }
    }

    await client.query('COMMIT');

    // 3. Log the action (after commit)
    await logAction({
      tenantId,
      userId,
      action: 'project.created',
      entity: 'project',
      entityId: project.id,
      newValue: { name: project.name, client_name: project.client_name }
    });

    // 4. Trigger automation engine
    await enqueueAutomation({
      tenantId,
      eventType: 'record.created',
      entity: 'project',
      record: project
    });

    return project;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createProject };
