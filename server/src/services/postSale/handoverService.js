const pool = require('../../db/pool');
const { logAction } = require('../auditLog');

async function createChecklist({ tenantId, projectId, items = [] }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checklistResult = await client.query(
      `INSERT INTO handover_checklists (tenant_id, project_id, status)
       VALUES ($1, $2, 'in_progress')
       RETURNING *`,
      [tenantId, projectId]
    );
    const checklist = checklistResult.rows[0];

    // Auto-populate default items if none provided
    let itemsToInsert = items;
    if (itemsToInsert.length === 0) {
      const projectRes = await client.query('SELECT project_type FROM projects WHERE id = $1', [projectId]);
      const pType = projectRes.rows[0]?.project_type || 'full_home';
      
      switch (pType) {
        case 'modular_kitchen':
          itemsToInsert = [
            { room: 'Kitchen', description: 'All cabinets and drawers open/close smoothly' },
            { room: 'Kitchen', description: 'Countertop installed without scratches or chips' },
            { room: 'Kitchen', description: 'Sink and faucet installed, no leaks' },
            { room: 'Systems & Appliance Testing', description: 'Electrical Testing: Each circuit, each switch, each point tested' },
            { room: 'Systems & Appliance Testing', description: 'Plumbing Testing: Each tap, each drain, water pressure tested' },
            { room: 'Systems & Appliance Testing', description: 'Hardware Testing: Each door, drawer, hinge, pull tested' },
            { room: 'Systems & Appliance Testing', description: 'Appliance Testing: Each installed appliance tested by client' },
            { room: 'Product Documentation', description: 'Hob (Cooktop) Manual & Warranty', item_type: 'document' },
            { room: 'Product Documentation', description: 'Chimney Manual & Warranty', item_type: 'document' },
            { room: 'Product Documentation', description: 'Water Purifier Manual & Warranty', item_type: 'document' },
            { room: 'Keys & Access Handovers', description: 'Main Door Keys', item_type: 'key_access' },
            { room: 'Keys & Access Handovers', description: 'Service Door Keys', item_type: 'key_access' },
            { room: 'Keys & Access Handovers', description: 'Digital Lock Access Code', item_type: 'key_access' },
            { room: 'Keys & Access Handovers', description: 'Parking Access Cards / RFID Tags', item_type: 'key_access' }
          ];
          break;
        case 'full_home':
          itemsToInsert = [
            { room: 'Kitchen', description: 'All cabinets and drawers open/close smoothly' },
            { room: 'Living Room', description: 'TV unit installed properly' },
            { room: 'Master Bedroom', description: 'Wardrobe sliding mechanism works smoothly' },
            { room: 'General', description: 'All switchboards aligned and working' },
            { room: 'General', description: 'Paint finish uniform with no patches' },
            { room: 'Systems & Appliance Testing', description: 'Electrical Testing: Each circuit, each switch, each point tested' },
            { room: 'Systems & Appliance Testing', description: 'Plumbing Testing: Each tap, each drain, water pressure tested' },
            { room: 'Systems & Appliance Testing', description: 'Hardware Testing: Each door, drawer, hinge, pull tested' },
            { room: 'Systems & Appliance Testing', description: 'Appliance Testing: Each installed appliance tested by client' },
            { room: 'Product Documentation', description: 'Hob (Cooktop) Manual & Warranty', item_type: 'document' },
            { room: 'Product Documentation', description: 'Chimney Manual & Warranty', item_type: 'document' },
            { room: 'Product Documentation', description: 'Water Purifier Manual & Warranty', item_type: 'document' },
            { room: 'Product Documentation', description: 'Geyser (Master Bathroom) Manual & Warranty', item_type: 'document' },
            { room: 'Product Documentation', description: 'Air Conditioner (Living Room) Manual & Warranty', item_type: 'document' },
            { room: 'Keys & Access Handovers', description: 'Main Door Keys', item_type: 'key_access' },
            { room: 'Keys & Access Handovers', description: 'Service Door Keys', item_type: 'key_access' },
            { room: 'Keys & Access Handovers', description: 'Digital Lock Access Code', item_type: 'key_access' },
            { room: 'Keys & Access Handovers', description: 'Parking Access Cards / RFID Tags', item_type: 'key_access' }
          ];
          break;
        default:
          itemsToInsert = [
            { room: 'General', description: 'Installation completed as per design' },
            { room: 'General', description: 'Site cleaned and debris removed' },
            { room: 'Systems & Appliance Testing', description: 'Electrical Testing: Each circuit, each switch, each point tested' },
            { room: 'Systems & Appliance Testing', description: 'Plumbing Testing: Each tap, each drain, water pressure tested' },
            { room: 'Systems & Appliance Testing', description: 'Hardware Testing: Each door, drawer, hinge, pull tested' },
            { room: 'Systems & Appliance Testing', description: 'Appliance Testing: Each installed appliance tested by client' },
            { room: 'Product Documentation', description: 'Appliances Manual & Warranty', item_type: 'document' },
            { room: 'Product Documentation', description: 'Hardware & Fittings Warranties', item_type: 'document' },
            { room: 'Keys & Access Handovers', description: 'Main Door Keys', item_type: 'key_access' },
            { room: 'Keys & Access Handovers', description: 'Service Door Keys', item_type: 'key_access' },
            { room: 'Keys & Access Handovers', description: 'Digital Lock Access Code', item_type: 'key_access' },
            { room: 'Keys & Access Handovers', description: 'Parking Access Cards / RFID Tags', item_type: 'key_access' }
          ];
      }
    }

    const insertedItems = [];
    for (const item of itemsToInsert) {
      const itemResult = await client.query(
        `INSERT INTO handover_items (checklist_id, room, description, item_type)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [checklist.id, item.room, item.description, item.item_type || 'inspection']
      );
      insertedItems.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');
    return { ...checklist, items: insertedItems };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function addDefaultItems(checklistId, projectType) {
  let defaultItems;

  switch (projectType) {
    case 'modular_kitchen':
      defaultItems = [
        { room: 'Kitchen', description: 'All cabinets and drawers open/close smoothly' },
        { room: 'Kitchen', description: 'Countertop installed without scratches or chips' },
        { room: 'Kitchen', description: 'Sink and faucet installed, no leaks' },
        { room: 'Systems & Appliance Testing', description: 'Electrical Testing: Each circuit, each switch, each point tested' },
        { room: 'Systems & Appliance Testing', description: 'Plumbing Testing: Each tap, each drain, water pressure tested' },
        { room: 'Systems & Appliance Testing', description: 'Hardware Testing: Each door, drawer, hinge, pull tested' },
        { room: 'Systems & Appliance Testing', description: 'Appliance Testing: Each installed appliance tested by client' },
        { room: 'Product Documentation', description: 'Hob (Cooktop) Manual & Warranty', item_type: 'document' },
        { room: 'Product Documentation', description: 'Chimney Manual & Warranty', item_type: 'document' },
        { room: 'Product Documentation', description: 'Water Purifier Manual & Warranty', item_type: 'document' },
        { room: 'Keys & Access Handovers', description: 'Main Door Keys', item_type: 'key_access' },
        { room: 'Keys & Access Handovers', description: 'Service Door Keys', item_type: 'key_access' },
        { room: 'Keys & Access Handovers', description: 'Digital Lock Access Code', item_type: 'key_access' },
        { room: 'Keys & Access Handovers', description: 'Parking Access Cards / RFID Tags', item_type: 'key_access' }
      ];
      break;
    case 'full_home':
      defaultItems = [
        { room: 'Kitchen', description: 'All cabinets and drawers open/close smoothly' },
        { room: 'Living Room', description: 'TV unit installed properly' },
        { room: 'Master Bedroom', description: 'Wardrobe sliding mechanism works smoothly' },
        { room: 'General', description: 'All switchboards aligned and working' },
        { room: 'General', description: 'Paint finish uniform with no patches' },
        { room: 'Systems & Appliance Testing', description: 'Electrical Testing: Each circuit, each switch, each point tested' },
        { room: 'Systems & Appliance Testing', description: 'Plumbing Testing: Each tap, each drain, water pressure tested' },
        { room: 'Systems & Appliance Testing', description: 'Hardware Testing: Each door, drawer, hinge, pull tested' },
        { room: 'Systems & Appliance Testing', description: 'Appliance Testing: Each installed appliance tested by client' },
        { room: 'Product Documentation', description: 'Hob (Cooktop) Manual & Warranty', item_type: 'document' },
        { room: 'Product Documentation', description: 'Chimney Manual & Warranty', item_type: 'document' },
        { room: 'Product Documentation', description: 'Water Purifier Manual & Warranty', item_type: 'document' },
        { room: 'Product Documentation', description: 'Geyser (Master Bathroom) Manual & Warranty', item_type: 'document' },
        { room: 'Product Documentation', description: 'Air Conditioner (Living Room) Manual & Warranty', item_type: 'document' },
        { room: 'Keys & Access Handovers', description: 'Main Door Keys', item_type: 'key_access' },
        { room: 'Keys & Access Handovers', description: 'Service Door Keys', item_type: 'key_access' },
        { room: 'Keys & Access Handovers', description: 'Digital Lock Access Code', item_type: 'key_access' },
        { room: 'Keys & Access Handovers', description: 'Parking Access Cards / RFID Tags', item_type: 'key_access' }
      ];
      break;
    default:
      defaultItems = [
        { room: 'General', description: 'Installation completed as per design' },
        { room: 'General', description: 'Site cleaned and debris removed' },
        { room: 'Systems & Appliance Testing', description: 'Electrical Testing: Each circuit, each switch, each point tested' },
        { room: 'Systems & Appliance Testing', description: 'Plumbing Testing: Each tap, each drain, water pressure tested' },
        { room: 'Systems & Appliance Testing', description: 'Hardware Testing: Each door, drawer, hinge, pull tested' },
        { room: 'Systems & Appliance Testing', description: 'Appliance Testing: Each installed appliance tested by client' },
        { room: 'Product Documentation', description: 'Appliances Manual & Warranty', item_type: 'document' },
        { room: 'Product Documentation', description: 'Hardware & Fittings Warranties', item_type: 'document' },
        { room: 'Keys & Access Handovers', description: 'Main Door Keys', item_type: 'key_access' },
        { room: 'Keys & Access Handovers', description: 'Service Door Keys', item_type: 'key_access' },
        { room: 'Keys & Access Handovers', description: 'Digital Lock Access Code', item_type: 'key_access' },
        { room: 'Keys & Access Handovers', description: 'Parking Access Cards / RFID Tags', item_type: 'key_access' }
      ];
  }

  const insertedItems = [];
  for (const item of defaultItems) {
    const result = await pool.query(
      `INSERT INTO handover_items (checklist_id, room, description, item_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [checklistId, item.room, item.description, item.item_type || 'inspection']
    );
    insertedItems.push(result.rows[0]);
  }

  return insertedItems;
}

async function updateItem({ 
  checklistId, 
  itemId, 
  isChecked, 
  photoKey, 
  userId,
  serialNumber,
  warrantyExpiryDate,
  hasManual,
  hasWarrantyCard,
  keyDetails,
  hasBrandRegistrationCard
}) {
  const result = await pool.query(
    `UPDATE handover_items
     SET is_checked = COALESCE($1, is_checked),
         photo_key = COALESCE($2, photo_key),
         checked_at = CASE WHEN $1 = true THEN NOW()::text ELSE checked_at END,
         checked_by = CASE WHEN $1 = true THEN $3 ELSE checked_by END,
         serial_number = COALESCE($6, serial_number),
         warranty_expiry_date = COALESCE(NULLIF($7, '')::DATE, warranty_expiry_date),
         has_manual = COALESCE($8, has_manual),
         has_warranty_card = COALESCE($9, has_warranty_card),
         key_details = COALESCE($10, key_details),
         has_brand_registration_card = COALESCE($11, has_brand_registration_card)
     WHERE id = $4 AND checklist_id = $5
     RETURNING *`,
    [
      isChecked, 
      photoKey, 
      userId, 
      itemId, 
      checklistId, 
      serialNumber, 
      warrantyExpiryDate, 
      hasManual, 
      hasWarrantyCard, 
      keyDetails,
      hasBrandRegistrationCard
    ]
  );

  if (result.rows.length === 0) {
    throw new Error('Handover item not found or could not be updated');
  }

  const updatedItem = result.rows[0];

  // Run handover readiness check asynchronously
  setImmediate(async () => {
    try {
      const checklistInfo = await pool.query(
        'SELECT project_id, tenant_id FROM handover_checklists WHERE id = $1',
        [checklistId]
      );
      if (checklistInfo.rows.length > 0) {
        const { project_id, tenant_id } = checklistInfo.rows[0];
        await checkAndNotifyHandoverReadiness(tenant_id, project_id);
      }
    } catch (err) {
      console.error('[Handover Service] Error triggering handover readiness check:', err.message);
    }
  });

  return updatedItem;
}

async function addItem({ checklistId, room, description, itemType = 'inspection' }) {
  const result = await pool.query(
    `INSERT INTO handover_items (checklist_id, room, description, item_type)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [checklistId, room, description, itemType]
  );
  return result.rows[0];
}

async function getChecklist(checklistId, tenantId) {
  const checklistResult = await pool.query(
    `SELECT * FROM handover_checklists WHERE id = $1 AND tenant_id = $2`,
    [checklistId, tenantId]
  );
  const checklist = checklistResult.rows[0];
  if (!checklist) {
    throw new Error('Checklist not found');
  }

  const itemsResult = await pool.query(
    `SELECT * FROM handover_items WHERE checklist_id = $1 ORDER BY room, description`,
    [checklistId]
  );

  return { ...checklist, items: itemsResult.rows };
}

async function getChecklistByProjectId(projectId, tenantId) {
  const checklistResult = await pool.query(
    `SELECT * FROM handover_checklists WHERE project_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [projectId, tenantId]
  );
  const checklist = checklistResult.rows[0];
  if (!checklist) {
    return null;
  }

  const itemsResult = await pool.query(
    `SELECT * FROM handover_items WHERE checklist_id = $1 ORDER BY room, description`,
    [checklist.id]
  );

  return { ...checklist, items: itemsResult.rows };
}

async function clientSignOff({ checklistId, tenantId, clientPortalUserId, clientName }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify all items are checked
    const itemsResult = await client.query(
      `SELECT is_checked FROM handover_items WHERE checklist_id = $1`,
      [checklistId]
    );

    const allChecked = itemsResult.rows.every(item => item.is_checked);
    if (!allChecked || itemsResult.rows.length === 0) {
      throw new Error('ITEMS_INCOMPLETE');
    }

    // 1b. Check financial clearance and internal authorization
    const checklistInfo = await client.query(
      `SELECT project_id, is_internally_authorized FROM handover_checklists WHERE id = $1 AND tenant_id = $2`,
      [checklistId, tenantId]
    );
    if (checklistInfo.rows.length === 0) {
      throw new Error('Checklist not found');
    }
    const { project_id: projectId, is_internally_authorized: isAuth } = checklistInfo.rows[0];
    if (!isAuth) {
      throw new Error('INTERNAL_AUTHORIZATION_PENDING');
    }
    if (projectId) {
      const unpaidMilestones = await client.query(
        `SELECT COUNT(*) FROM payment_milestones 
         WHERE project_id = $1 AND tenant_id = $2 
         AND status != 'paid' AND is_deferred = false`,
        [projectId, tenantId]
      );
      if (parseInt(unpaidMilestones.rows[0].count) > 0) {
        throw new Error('FINANCIAL_CLEARANCE_PENDING');
      }
    }

    // 2. UPDATE handover_checklists
    const checklistResult = await client.query(
      `UPDATE handover_checklists
       SET status = 'signed_off', 
           signed_by_client_at = NOW(),
           client_name = COALESCE($3, client_name),
           client_otp_verified = true
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [checklistId, tenantId, clientName]
    );

    const checklist = checklistResult.rows[0];
    if (!checklist) {
      throw new Error('Checklist not found');
    }

    // 3. Enqueue PDF generation job
    await client.query(
      `INSERT INTO automation_jobs (tenant_id, event_type, entity, record)
       VALUES ($1, 'generate_handover_pdf', 'handover_checklist', $2)`,
      [tenantId, JSON.stringify({ checklistId, projectId: checklist.project_id })]
    );

    // 4. logAction 'project.handover_signed'
    await logAction({
      tenantId,
      userId: clientPortalUserId,
      action: 'project.handover_signed',
      entity: 'project',
      entityId: checklist.project_id,
      newValue: { checklistId }
    });

    const eventBus = require('../../utils/eventBus');
    eventBus.emit('project.handover_signed', {
      tenantId,
      projectId: checklist.project_id,
      checklistId
    });

    await client.query('COMMIT');
    return checklist;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function checkAndNotifyHandoverReadiness(tenantId, projectId) {
  try {
    // 1. Fetch the active handover checklist for this project
    const checklistRes = await pool.query(
      `SELECT id FROM handover_checklists WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );
    if (checklistRes.rows.length === 0) return;
    const checklistId = checklistRes.rows[0].id;

    // 2. Count unchecked items
    const uncheckedRes = await pool.query(
      `SELECT COUNT(*) FROM handover_items WHERE checklist_id = $1 AND is_checked = false`,
      [checklistId]
    );
    const uncheckedCount = parseInt(uncheckedRes.rows[0].count, 10);
    if (uncheckedCount > 0) return;

    // 3. Count unresolved snags
    const unresolvedSnagsRes = await pool.query(
      `SELECT COUNT(*) FROM snags WHERE project_id = $1 AND status NOT IN ('resolved', 'closed', 'client_verified')`,
      [projectId]
    );
    const unresolvedCount = parseInt(unresolvedSnagsRes.rows[0].count, 10);
    if (unresolvedCount > 0) return;

    // 4. Check if readiness alert has already been sent to prevent duplicates
    const checkLog = await pool.query(
      `SELECT 1 FROM audit_logs 
       WHERE entity = 'project' AND entity_id = $1 AND action = 'handover_readiness_notification'`,
      [projectId]
    );
    if (checkLog.rows.length > 0) return;

    // 5. Fetch project, client, PM details
    const projRes = await pool.query(
      `SELECT p.name, p.client_name, p.client_email, p.client_phone, p.pm_id,
              u.name as pm_name, u.email as pm_email
       FROM projects p
       LEFT JOIN users u ON p.pm_id = u.id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [projectId, tenantId]
    );
    const project = projRes.rows[0];
    if (!project) return;

    const { notifyUser } = require('../notificationService');
    const { sendWhatsAppMessage } = require('../whatsappService');
    const { notificationQueue } = require('../../queues/queueSetup');

    const pmMsg = `Handover readiness alert: Project "${project.name}" is ready for client handover. All checklist items are complete and snags are resolved.`;
    
    // Notify PM In-App
    if (project.pm_id) {
      notifyUser({
        tenantId,
        userId: project.pm_id,
        type: 'handover_readiness',
        message: pmMsg,
        referenceUrl: `/projects/${projectId}?tab=Handover`
      });
    }

    // Notify PM Email
    if (project.pm_email) {
      await notificationQueue.add('handoverReadinessNotification', {
        type: 'email',
        recipientId: project.pm_name || 'Project Manager',
        email: project.pm_email,
        message: pmMsg
      });
    }

    // Notify Finance Users (Email only)
    const financeRes = await pool.query(
      `SELECT u.id, u.email, u.name 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.tenant_id = $1 
         AND (r.name = 'finance' OR r.name = 'superadmin' OR r.name = 'admin')
         AND u.status = 'active'`,
      [tenantId]
    );
    for (const financeUser of financeRes.rows) {
      const financeMsg = `Dear ${financeUser.name},\n\nPlease note that project "${project.name}" (Client: ${project.client_name}) is now ready for client handover. All checklist items and snags are resolved.\n\nBest regards,\nCRM Logistics Team`;
      await notificationQueue.add('handoverReadinessNotification', {
        type: 'email',
        recipientId: financeUser.name,
        email: financeUser.email,
        message: financeMsg
      });
    }

    // Notify Client (Email + WhatsApp)
    if (project.client_email) {
      const clientEmailMsg = `Dear ${project.client_name},\n\nWe are pleased to inform you that all checklist items and snags for your project "${project.name}" have been fully completed and resolved. Your home is now ready for client handover!\n\nOur team will be in touch shortly to schedule the key handover.\n\nBest regards,\nCRM After-Sales Team`;
      await notificationQueue.add('handoverReadinessNotification', {
        type: 'email',
        recipientId: project.client_name,
        email: project.client_email,
        message: clientEmailMsg
      });
    }

    if (project.client_phone) {
      const clientWaMsg = `Handover Readiness Alert: All checklist items and snags for your project "${project.name}" have been completed/resolved. Your home is ready for handover!`;
      await sendWhatsAppMessage(project.client_phone, clientWaMsg);
    }

    // Log action to audit_logs
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, action, entity, entity_id, new_value)
       VALUES ($1, 'handover_readiness_notification', 'project', $2, 'ready')`,
      [tenantId, projectId]
    );

    // Emit EventBus
    const eventBus = require('../../utils/eventBus');
    eventBus.emit('project.handover_ready', {
      tenantId,
      projectId,
      projectName: project.name,
      clientName: project.client_name
    });

  } catch (error) {
    console.error('[Handover Service] Error in checkAndNotifyHandoverReadiness:', error);
  }
}

module.exports = {
  createChecklist,
  addDefaultItems,
  updateItem,
  addItem,
  getChecklist,
  getChecklistByProjectId,
  clientSignOff,
  checkAndNotifyHandoverReadiness
};
