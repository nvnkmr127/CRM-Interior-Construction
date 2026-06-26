const projectRepository = require('../../repositories/projectRepository');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');
const pool = require('../../config/db');

async function updateProject({ tenantId, userId, projectId, data }) {
  // 1. Fetch current project
  const currentProject = await projectRepository.findProjectById(tenantId, projectId);
  if (!currentProject) {
    const error = new Error('NOT_FOUND');
    error.status = 404;
    throw error;
  }

  // Enforce booking amount gate if project is transitioning to active
  if (data.status === 'active' && currentProject.status !== 'active' && Number(currentProject.booking_amount) > 0) {
    const paymentCheck = await pool.query(
      "SELECT id FROM payment_milestones WHERE project_id = $1 AND tenant_id = $2 AND name = 'Booking Advance' AND status = 'paid' LIMIT 1",
      [projectId, tenantId]
    );
    if (paymentCheck.rows.length === 0) {
      const error = new Error('BOOKING_PAYMENT_REQUIRED');
      error.message = 'Cannot activate project: Booking advance payment has not been received.';
      error.status = 400;
      throw error;
    }
  }

  const { contacts, measurements, vendors, consultants, ...projectData } = data;
  const client = await pool.connect();
  let updatedProject;

  try {
    await client.query('BEGIN');

    // 2. Execute update
    updatedProject = await projectRepository.updateProject(tenantId, projectId, projectData, client);

    // Sync project contacts if passed
    if (contacts !== undefined) {
      await client.query('DELETE FROM project_contacts WHERE tenant_id = $1 AND project_id = $2', [tenantId, projectId]);
      if (Array.isArray(contacts) && contacts.length > 0) {
        for (const contact of contacts) {
          if (!contact.name) continue;
          await client.query(`
            INSERT INTO project_contacts (
              tenant_id, project_id, name, phone, email, role, decision_authority, relationship_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            tenantId,
            projectId,
            contact.name,
            contact.phone || null,
            contact.email || null,
            contact.role || 'co_owner',
            contact.decision_authority || 'Influencer',
            contact.relationship_notes || null
          ]);
        }
      }
    }

    // Sync project measurements if passed
    if (measurements !== undefined) {
      await client.query('DELETE FROM project_measurements WHERE tenant_id = $1 AND project_id = $2', [tenantId, projectId]);
      if (Array.isArray(measurements) && measurements.length > 0) {
        for (const m of measurements) {
          if (!m.room_name) continue;
          const length = m.length !== undefined && m.length !== null ? Number(m.length) : 0;
          const width = m.width !== undefined && m.width !== null ? Number(m.width) : 0;
          const area = m.area !== undefined && m.area !== null ? Number(m.area) : (length * width);
          await client.query(`
            INSERT INTO project_measurements (
              tenant_id, project_id, room_name, length, width, height, area, unit, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            tenantId,
            projectId,
            m.room_name,
            length,
            width,
            m.height !== undefined && m.height !== null ? Number(m.height) : 0,
            area,
            m.unit || 'feet',
            m.notes || null
          ]);
        }
      }
    }

    // Sync project vendors if passed
    if (vendors !== undefined) {
      await client.query('DELETE FROM project_vendors WHERE tenant_id = $1 AND project_id = $2', [tenantId, projectId]);
      if (Array.isArray(vendors) && vendors.length > 0) {
        for (const v of vendors) {
          if (!v.vendor_name) continue;
          await client.query(`
            INSERT INTO project_vendors (
              tenant_id, project_id, vendor_name, scope_of_work, agreed_rate, payment_terms, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            tenantId,
            projectId,
            v.vendor_name,
            v.scope_of_work || null,
            v.agreed_rate !== undefined && v.agreed_rate !== null ? Number(v.agreed_rate) : null,
            v.payment_terms || null,
            v.status || 'pending'
          ]);
        }
      }
    }

    // Sync project consultants if passed
    if (consultants !== undefined) {
      await client.query('DELETE FROM project_consultants WHERE tenant_id = $1 AND project_id = $2', [tenantId, projectId]);
      if (Array.isArray(consultants) && consultants.length > 0) {
        for (const c of consultants) {
          if (!c.name || !c.role) continue;
          await client.query(`
            INSERT INTO project_consultants (
              tenant_id, project_id, name, role, firm, email, phone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            tenantId,
            projectId,
            c.name,
            c.role,
            c.firm || null,
            c.email || null,
            c.phone || null
          ]);
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // Fetch updated project with fresh contacts list for response
  const finalProject = await projectRepository.findProjectById(tenantId, projectId);

  // 3. Compute changes for audit logging (ignoring contacts in standard table diff)
  const oldValues = {};
  const newValues = {};
  for (const key of Object.keys(projectData)) {
    if (currentProject[key] !== updatedProject[key]) {
      oldValues[key] = currentProject[key];
      newValues[key] = updatedProject[key];
    }
  }

  if (Object.keys(newValues).length > 0) {
    await logAction({
      tenantId,
      userId,
      action: 'project.updated',
      entity: 'project',
      entityId: projectId,
      oldValue: oldValues,
      newValue: newValues
    });
  }

  // 4. Trigger automation if status explicitly changed
  if (data.status && data.status !== currentProject.status) {
    await enqueueAutomation({
      tenantId,
      eventType: 'field.changed',
      entity: 'project',
      record: finalProject,
      changes: {
        field: 'status',
        oldValue: currentProject.status,
        newValue: updatedProject.status
      }
    });
  }

  // 5. Return updated project
  return finalProject;
}

module.exports = { updateProject };
