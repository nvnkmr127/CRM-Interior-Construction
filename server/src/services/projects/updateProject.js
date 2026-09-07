const logger = require('../../utils/logger');
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

  // Enforce booking record gate if project is transitioning to active
  if (data.status === 'active' && currentProject.status !== 'active') {
    const bookingCheck = await pool.query(
      "SELECT id FROM project_bookings WHERE project_id = $1 AND tenant_id = $2 LIMIT 1",
      [projectId, tenantId]
    );
    if (bookingCheck.rows.length === 0) {
      const error = new Error('Cannot activate project: Booking confirmation has not been completed.');
      error.code = 'BOOKING_REQUIRED';
      error.status = 400;
      throw error;
    }
  }

  // Enforce project closure gates if project is transitioning to completed
  if (data.status === 'completed' && currentProject.status !== 'completed') {
    const { verifyProjectClosureReady } = require('../postSale/projectClosureService');
    await verifyProjectClosureReady(projectId, tenantId);
  }

  const { contacts, measurements, vendors, consultants, site_team, changeReason, change_reason, template_id, enforce_dependencies, enforceDependencies, ...projectData } = data;

  // Map legacy plural role keys to singular DB columns
  const roleFieldMap = [
    ['designer_ids', 'designer_id'],
    ['lead_designer_ids', 'lead_designer_id'],
    ['junior_designer_ids', 'junior_designer_id'],
    ['site_engineer_ids', 'site_engineer_id'],
    ['qc_engineer_ids', 'qc_engineer_id'],
    ['site_supervisor_ids', 'site_supervisor_id'],
    ['crm_executive_ids', 'crm_executive_id'],
    ['procurement_officer_ids', 'procurement_officer_id']
  ];

  for (const [pluralKey, singularKey] of roleFieldMap) {
    if (projectData[pluralKey] !== undefined) {
      if (projectData[singularKey] === undefined) {
        const val = projectData[pluralKey];
        projectData[singularKey] = Array.isArray(val) ? (val[0] || null) : (val || null);
      }
      delete projectData[pluralKey];
    }
  }

  const client = await pool.connect();
  let updatedProject;

  const toIso = (d) => {
    if (!d) return null;
    try {
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
    } catch {
      return null;
    }
  };

  const parseNum = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = Number(val);
    return isNaN(n) ? fallback : n;
  };

  try {
    await client.query('BEGIN');

    // Kickoff baseline commitment (status transition -> active)
    if (data.status === 'active' && currentProject.status !== 'active') {
      if (!currentProject.baseline_start_date) {
        projectData.baseline_start_date = data.start_date || currentProject.start_date || toIso(new Date());
      }
      if (!currentProject.baseline_target_date) {
        projectData.baseline_target_date = data.target_date || currentProject.target_date || toIso(new Date());
      }

      // Populate baselines for all tasks in the project
      await client.query(
        `UPDATE tasks 
         SET baseline_start_date = COALESCE(start_date, due_date, CURRENT_DATE), 
             baseline_due_date = COALESCE(due_date, start_date, CURRENT_DATE) 
         WHERE project_id = $1 AND tenant_id = $2 AND baseline_start_date IS NULL`,
        [projectId, tenantId]
      );
    }

    // Schedule revision tracking for active projects
    const startChanged = data.start_date && data.start_date !== toIso(currentProject.start_date);
    const targetChanged = data.target_date && data.target_date !== toIso(currentProject.target_date);

    if (currentProject.status === 'active' && (startChanged || targetChanged)) {
      // Find last revision number
      const { rows: revRows } = await client.query(
        'SELECT MAX(revision_number) as max_rev FROM project_schedule_revisions WHERE project_id = $1 AND tenant_id = $2',
        [projectId, tenantId]
      );
      const nextRev = (revRows[0]?.max_rev || 0) + 1;
      const reason = data.changeReason || data.change_reason || 'Schedule adjustment';

      await client.query(`
        INSERT INTO project_schedule_revisions (
          tenant_id, project_id, revised_by, previous_start_date, previous_target_date, 
          new_start_date, new_target_date, reason, revision_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        tenantId,
        projectId,
        userId || null,
        currentProject.start_date,
        currentProject.target_date,
        data.start_date || currentProject.start_date,
        data.target_date || currentProject.target_date,
        reason,
        nextRev
      ]);
      logger.info(`[UpdateProject] Logged schedule revision #${nextRev} for project ${projectId}. Reason: ${reason}`);
    }

    // 2. Execute update
    updatedProject = await projectRepository.updateProject(tenantId, projectId, projectData, client);

    // Sync project contacts if passed
    if (contacts !== undefined) {
      await client.query('DELETE FROM project_contacts WHERE tenant_id = $1 AND project_id = $2', [tenantId, projectId]);
      if (Array.isArray(contacts) && contacts.length > 0) {
        for (const contact of contacts) {
          if (!contact || !contact.name) continue;
          let approvalLevel = null;
          if (contact.approval_authority_level !== undefined && contact.approval_authority_level !== null && contact.approval_authority_level !== '') {
            const parsed = Number(contact.approval_authority_level);
            approvalLevel = isNaN(parsed) ? null : parsed;
          }

          await client.query(`
            INSERT INTO project_contacts (
              tenant_id, project_id, name, phone, email, role, decision_authority, relationship_notes,
              contact_preference, approval_authority_level
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            tenantId,
            projectId,
            contact.name,
            contact.phone || null,
            contact.email || null,
            contact.role || 'co_owner',
            contact.decision_authority || 'Influencer',
            contact.relationship_notes || null,
            contact.contact_preference || null,
            approvalLevel
          ]);
        }
      }
    }

    // Sync project measurements if passed
    if (measurements !== undefined) {
      await client.query('DELETE FROM project_measurements WHERE tenant_id = $1 AND project_id = $2', [tenantId, projectId]);
      if (Array.isArray(measurements) && measurements.length > 0) {
        for (const m of measurements) {
          if (!m || !m.room_name) continue;
          const length = parseNum(m.length, 0);
          const width = parseNum(m.width, 0);
          const height = parseNum(m.height, 0);
          const area = (m.area !== undefined && m.area !== null && m.area !== '') ? parseNum(m.area, length * width) : (length * width);
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
            height,
            area,
            m.unit || 'feet',
            m.notes || null
          ]);
        }
      }
    }

    // Sync project vendors if passed
    const vendorNameToIdMap = {};
    if (vendors !== undefined) {
      await client.query('DELETE FROM project_vendors WHERE tenant_id = $1 AND project_id = $2', [tenantId, projectId]);
      if (Array.isArray(vendors) && vendors.length > 0) {
        for (const v of vendors) {
          if (!v || !v.vendor_name) continue;
          const agreedRate = (v.agreed_rate !== undefined && v.agreed_rate !== null && v.agreed_rate !== '') ? Number(v.agreed_rate) : null;
          const finalRate = (agreedRate !== null && !isNaN(agreedRate)) ? agreedRate : null;

          const vendorInsertRes = await client.query(`
            INSERT INTO project_vendors (
              tenant_id, project_id, vendor_name, scope_of_work, agreed_rate, payment_terms, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `, [
            tenantId,
            projectId,
            v.vendor_name,
            v.scope_of_work || null,
            finalRate,
            v.payment_terms || null,
            v.status || 'pending'
          ]);
          if (vendorInsertRes.rows.length > 0) {
            vendorNameToIdMap[v.vendor_name] = vendorInsertRes.rows[0].id;
          }
        }
      }
    } else if (site_team !== undefined) {
      const existingVendors = await client.query(
        'SELECT id, vendor_name FROM project_vendors WHERE tenant_id = $1 AND project_id = $2',
        [tenantId, projectId]
      );
      for (const ev of existingVendors.rows) {
        vendorNameToIdMap[ev.vendor_name] = ev.id;
      }
    }

    // Sync project consultants if passed
    if (consultants !== undefined) {
      await client.query('DELETE FROM project_consultants WHERE tenant_id = $1 AND project_id = $2', [tenantId, projectId]);
      if (Array.isArray(consultants) && consultants.length > 0) {
        for (const c of consultants) {
          if (!c || !c.name || !c.role) continue;
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

    // Sync project site team if passed
    if (site_team !== undefined) {
      await client.query('DELETE FROM project_site_team WHERE tenant_id = $1 AND project_id = $2', [tenantId, projectId]);
      if (Array.isArray(site_team) && site_team.length > 0) {
        for (const member of site_team) {
          if (!member || !member.name || !member.role) continue;

          let finalVendorId = null;
          if (member.vendor_id && member.vendor_id !== '') {
            finalVendorId = member.vendor_id;
          } else if (member.vendor_name && vendorNameToIdMap[member.vendor_name]) {
            finalVendorId = vendorNameToIdMap[member.vendor_name];
          }

          await client.query(`
            INSERT INTO project_site_team (
              tenant_id, project_id, vendor_id, role, name, phone, email, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            tenantId,
            projectId,
            finalVendorId,
            member.role,
            member.name,
            member.phone || null,
            member.email || null,
            member.status || 'active'
          ]);
        }
      }
    }

    if (data.status === 'completed' && currentProject.status !== 'completed') {
      const completedAt = new Date();
      const anniversaryDate = new Date();
      anniversaryDate.setFullYear(completedAt.getFullYear() + 1);

      const nextFollowupDate = new Date();
      nextFollowupDate.setMonth(completedAt.getMonth() + 6);

      const rand = Math.floor(1000 + Math.random() * 9000);
      const cleanName = currentProject.client_name ? currentProject.client_name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() : 'CUST';
      const referralCode = `REF-${cleanName}-${rand}`;

      await client.query(
        `INSERT INTO client_relationship_records (
          tenant_id, project_id, client_name, client_email, client_phone,
          project_completed_at, anniversary_date, next_followup_schedule_date, referral_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (project_id) DO NOTHING`,
        [
          tenantId,
          projectId,
          currentProject.client_name || 'Valued Customer',
          currentProject.client_email || null,
          currentProject.client_phone || null,
          completedAt,
          anniversaryDate,
          nextFollowupDate,
          referralCode
        ]
      );
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

  // 3. Compute changes for audit logging
  const oldValues = {};
  const newValues = {};
  if (updatedProject) {
    for (const key of Object.keys(projectData)) {
      if (currentProject[key] !== updatedProject[key]) {
        oldValues[key] = currentProject[key];
        newValues[key] = updatedProject[key];
      }
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

    const eventBus = require('../../utils/eventBus');
    if (newValues.pm_id && newValues.pm_id !== oldValues.pm_id) {
      eventBus.emit('RESOURCE_ASSIGNED_TO_PROJECT', {
        tenantId,
        userId: newValues.pm_id,
        projectId,
        projectName: finalProject.name
      });
    }
    if (newValues.designer_id && newValues.designer_id !== oldValues.designer_id) {
      eventBus.emit('RESOURCE_ASSIGNED_TO_PROJECT', {
        tenantId,
        userId: newValues.designer_id,
        projectId,
        projectName: finalProject.name
      });
    }

    try {
      const updatedKeys = Object.keys(newValues);
      await pool.query(
        `INSERT INTO activities (project_id, tenant_id, type, title, notes, user_id, created_at)
         VALUES ($1, $2, 'system', 'Project Updated', $3, $4, NOW())`,
        [projectId, tenantId, `Updated fields: ${updatedKeys.join(', ')}`, userId]
      );
    } catch (error) {
      logger.error('Failed to insert project activity:', error);
    }
  }

  // 4. Trigger automation if status explicitly changed
  if (data.status && data.status !== currentProject.status && updatedProject) {
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
