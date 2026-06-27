const pool = require('../../db/pool');
const handoverService = require('../../services/postSale/handoverService');
const snagService = require('../../services/postSale/snagService');
const eventBus = require('../../utils/eventBus');

describe('Handover Readiness Notifications', () => {
  jest.setTimeout(30000);
  let tenantId;
  let projectId;
  let pmUserId;
  let checklist;
  let snag;

  const readinessEvents = [];
  const onReadiness = (data) => {
    console.log('[Test Listener Debug] Received project.handover_ready for project:', data.projectId);
    if (data.projectId) {
      readinessEvents.push(data);
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
    eventBus.on('project.handover_ready', onReadiness);
  });

  afterAll(async () => {
    // Cleanup
    if (projectId) {
      await pool.query('DELETE FROM snags WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM handover_items WHERE checklist_id IN (SELECT id FROM handover_checklists WHERE project_id = $1)', [projectId]);
      await pool.query('DELETE FROM handover_checklists WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }

    eventBus.off('project.handover_ready', onReadiness);
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up databases for this project
    if (projectId) {
      await pool.query('DELETE FROM snags WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM handover_items WHERE checklist_id IN (SELECT id FROM handover_checklists WHERE project_id = $1)', [projectId]);
      await pool.query('DELETE FROM handover_checklists WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }

    // Create a new test project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, pm_id)
      VALUES ($1, 'Handover Ready Project', 'Client Carl', '7776665555', 'carl@client.com', 'active', $2)
      RETURNING id
    `, [tenantId, pmUserId]);
    projectId = projRes.rows[0].id;

    // Create a checklist with 2 items
    checklist = await handoverService.createChecklist({
      tenantId,
      projectId,
      items: [
        { room: 'Bedroom', description: 'Wardrobe finish check', item_type: 'inspection' },
        { room: 'Bathroom', description: 'Faucet leakage check', item_type: 'inspection' }
      ]
    });

    // Create a snag
    snag = await snagService.createSnag({
      tenantId,
      projectId,
      raisedBy: pmUserId,
      raisedByClient: false,
      title: 'Chipped Tile in Living Room',
      description: 'Replace the cracked tile near the TV console.',
      photoKeys: [],
      category: 'finishing'
    });

    readinessEvents.length = 0;
  });

  it('should auto-notify PM, finance, and client only when all checklist items are resolved AND all snags are resolved', async () => {
    // Step 1: Check the first checklist item. Check should NOT trigger because 1 item is unchecked and snag is open.
    await handoverService.updateItem({
      checklistId: checklist.id,
      itemId: checklist.items[0].id,
      isChecked: true,
      userId: pmUserId
    });

    // Give asynchronous setImmediate code brief delay
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(readinessEvents.length).toBe(0);

    // Step 2: Check the second checklist item. All checklist items are checked, but snag is still OPEN. Check should NOT trigger.
    await handoverService.updateItem({
      checklistId: checklist.id,
      itemId: checklist.items[1].id,
      isChecked: true,
      userId: pmUserId
    });

    await new Promise(resolve => setTimeout(resolve, 300));
    expect(readinessEvents.length).toBe(0);

    // Step 3: Assign the snag (still open)
    await snagService.assignSnag({
      tenantId,
      snagId: snag.id,
      assigneeId: pmUserId,
      userId: pmUserId
    });

    await new Promise(resolve => setTimeout(resolve, 300));
    expect(readinessEvents.length).toBe(0);

    // Transition snag to in_progress
    await snagService.updateSnagStatus({
      tenantId,
      snagId: snag.id,
      status: 'in_progress',
      userId: pmUserId
    });

    await new Promise(resolve => setTimeout(resolve, 300));
    expect(readinessEvents.length).toBe(0);

    // Step 4: Resolve the snag. Now all checklist items are checked AND all snags are resolved! Notification should trigger.
    const eventPromise = new Promise((resolve) => {
      eventBus.once('project.handover_ready', (data) => {
        if (data.projectId === projectId) {
          resolve(data);
        }
      });
    });

    await snagService.updateSnagStatus({
      tenantId,
      snagId: snag.id,
      status: 'resolved',
      resolutionNote: 'Tile replaced',
      userId: pmUserId
    });

    // Wait for event to be emitted
    const eventData = await eventPromise;
    expect(eventData.projectId).toBe(projectId);

    // Verify audit log exists
    const logs = await pool.query(
      `SELECT 1 FROM audit_logs 
       WHERE entity = 'project' AND entity_id = $1 AND action = 'handover_readiness_notification'`,
      [projectId]
    );
    expect(logs.rows.length).toBe(1);
  });
});
