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
            { room: 'Kitchen', description: 'Sink and faucet installed, no leaks' }
          ];
          break;
        case 'full_home':
          itemsToInsert = [
            { room: 'Kitchen', description: 'All cabinets and drawers open/close smoothly' },
            { room: 'Living Room', description: 'TV unit installed properly' },
            { room: 'Master Bedroom', description: 'Wardrobe sliding mechanism works smoothly' },
            { room: 'General', description: 'All switchboards aligned and working' },
            { room: 'General', description: 'Paint finish uniform with no patches' }
          ];
          break;
        default:
          itemsToInsert = [
            { room: 'General', description: 'Installation completed as per design' },
            { room: 'General', description: 'Site cleaned and debris removed' }
          ];
      }
    }

    const insertedItems = [];
    for (const item of itemsToInsert) {
      const itemResult = await client.query(
        `INSERT INTO handover_items (checklist_id, room, description)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [checklist.id, item.room, item.description]
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
  let defaultItems = [];

  switch (projectType) {
    case 'modular_kitchen':
      defaultItems = [
        { room: 'Kitchen', description: 'All cabinets and drawers open/close smoothly' },
        { room: 'Kitchen', description: 'Countertop installed without scratches or chips' },
        { room: 'Kitchen', description: 'Sink and faucet installed, no leaks' }
      ];
      break;
    case 'full_home':
      defaultItems = [
        { room: 'Kitchen', description: 'All cabinets and drawers open/close smoothly' },
        { room: 'Living Room', description: 'TV unit installed properly' },
        { room: 'Master Bedroom', description: 'Wardrobe sliding mechanism works smoothly' },
        { room: 'General', description: 'All switchboards aligned and working' },
        { room: 'General', description: 'Paint finish uniform with no patches' }
      ];
      break;
    default:
      defaultItems = [
        { room: 'General', description: 'Installation completed as per design' },
        { room: 'General', description: 'Site cleaned and debris removed' }
      ];
  }

  const insertedItems = [];
  for (const item of defaultItems) {
    const result = await pool.query(
      `INSERT INTO handover_items (checklist_id, room, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [checklistId, item.room, item.description]
    );
    insertedItems.push(result.rows[0]);
  }

  return insertedItems;
}

async function updateItem({ checklistId, itemId, isChecked, photoKey, userId }) {
  const result = await pool.query(
    `UPDATE handover_items
     SET is_checked = COALESCE($1, is_checked),
         photo_key = COALESCE($2, photo_key),
         checked_at = CASE WHEN $1 = true THEN NOW() ELSE checked_at END,
         checked_by = CASE WHEN $1 = true THEN $3 ELSE checked_by END
     WHERE id = $4 AND checklist_id = $5
     RETURNING *`,
    [isChecked, photoKey, userId, itemId, checklistId]
  );

  if (result.rows.length === 0) {
    throw new Error('Handover item not found or could not be updated');
  }

  return result.rows[0];
}

async function addItem({ checklistId, room, description }) {
  const result = await pool.query(
    `INSERT INTO handover_items (checklist_id, room, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [checklistId, room, description]
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
    `SELECT * FROM handover_items WHERE checklist_id = $1 ORDER BY room, created_at ASC`,
    [checklist.id]
  );

  return { ...checklist, items: itemsResult.rows };
}

async function clientSignOff({ checklistId, tenantId, clientPortalUserId }) {
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

    // 2. UPDATE handover_checklists
    const checklistResult = await client.query(
      `UPDATE handover_checklists
       SET status = 'signed_off', signed_by_client_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [checklistId, tenantId]
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

    await client.query('COMMIT');
    return checklist;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createChecklist,
  addDefaultItems,
  updateItem,
  addItem,
  getChecklist,
  getChecklistByProjectId,
  clientSignOff
};
