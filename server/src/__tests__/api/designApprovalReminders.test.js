const pool = require('../../db/pool');
const documentReminderService = require('../../services/projects/documentReminderService');
const eventBus = require('../../utils/eventBus');

describe('Design/Document Approval Reminders', () => {
  jest.setTimeout(30000);
  let tenantId;
  let projectId;
  let pmUserId;

  let doc48h;
  let doc72h;
  let docControlRecent;
  let docControlInvisible;
  let docControlApproved;

  const reminderEvents = [];
  const onReminder = (data) => {
    if (data.documentId) {
      reminderEvents.push(data);
    }
  };

  beforeAll(async () => {
    // 1. Resolve tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Fetch a PM user
    const pmRes = await pool.query("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    pmUserId = pmRes.rows[0]?.id || null;

    // Subscribe to EventBus
    eventBus.on('document.approval_reminder_sent', onReminder);
  });

  afterAll(async () => {
    // Clean up
    if (projectId) {
      await pool.query('DELETE FROM documents WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }

    eventBus.off('document.approval_reminder_sent', onReminder);
    await pool.end();
  });

  beforeEach(async () => {
    if (projectId) {
      await pool.query('DELETE FROM documents WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }

    // Create test project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, pm_id)
      VALUES ($1, 'Design Approval Project', 'Client Dave', '7775554444', 'dave@client.com', 'active', $2)
      RETURNING id
    `, [tenantId, pmUserId]);
    projectId = projRes.rows[0].id;

    reminderEvents.length = 0;
  });

  it('should send 48h and 72h reminders for pending client reviews and respect deduplication', async () => {
    // 1. Document pending for 50 hours (should trigger 48h reminder)
    const res1 = await pool.query(`
      INSERT INTO documents (tenant_id, project_id, name, storage_key, status, is_visible_to_client, created_at)
      VALUES ($1, $2, 'Layout Plan V1', 'key1', 'pending_review', true, NOW() - INTERVAL '50 hours')
      RETURNING id
    `, [tenantId, projectId]);
    doc48h = res1.rows[0].id;

    // 2. Document pending for 75 hours (should trigger 72h reminder)
    const res2 = await pool.query(`
      INSERT INTO documents (tenant_id, project_id, name, storage_key, status, is_visible_to_client, created_at)
      VALUES ($1, $2, 'Material Palette Kitchen', 'key2', 'pending_review', true, NOW() - INTERVAL '75 hours')
      RETURNING id
    `, [tenantId, projectId]);
    doc72h = res2.rows[0].id;

    // 3. Document pending for 10 hours (should NOT trigger)
    const res3 = await pool.query(`
      INSERT INTO documents (tenant_id, project_id, name, storage_key, status, is_visible_to_client, created_at)
      VALUES ($1, $2, 'Bathroom Details', 'key3', 'pending_review', true, NOW() - INTERVAL '10 hours')
      RETURNING id
    `, [tenantId, projectId]);
    docControlRecent = res3.rows[0].id;

    // 4. Document pending for 80 hours but NOT visible to client (should NOT trigger)
    const res4 = await pool.query(`
      INSERT INTO documents (tenant_id, project_id, name, storage_key, status, is_visible_to_client, created_at)
      VALUES ($1, $2, 'Internal Budget Draft', 'key4', 'pending_review', false, NOW() - INTERVAL '80 hours')
      RETURNING id
    `, [tenantId, projectId]);
    docControlInvisible = res4.rows[0].id;

    // 5. Document pending for 80 hours but status is already approved (should NOT trigger)
    const res5 = await pool.query(`
      INSERT INTO documents (tenant_id, project_id, name, storage_key, status, is_visible_to_client, created_at)
      VALUES ($1, $2, 'Contract Finalized', 'key5', 'approved', true, NOW() - INTERVAL '80 hours')
      RETURNING id
    `, [tenantId, projectId]);
    docControlApproved = res5.rows[0].id;

    // Execute reminder scan
    const sentCount = await documentReminderService.checkAndSendDocumentApprovalReminders(projectId);
    
    // We expect exactly 2 reminders (one 48h and one 72h)
    expect(sentCount).toBe(2);

    // Filter EventBus events to our specific documents
    const filteredEvents = reminderEvents.filter(e => [doc48h, doc72h].includes(e.documentId));
    expect(filteredEvents.length).toBe(2);

    const reminderTypes = filteredEvents.map(e => e.reminderType);
    expect(reminderTypes).toContain('48_hours_reminder');
    expect(reminderTypes).toContain('72_hours_reminder');

    // Run again - should send 0 new reminders due to audit log deduplication
    const secondRunCount = await documentReminderService.checkAndSendDocumentApprovalReminders(projectId);
    expect(secondRunCount).toBe(0);
  });
});
