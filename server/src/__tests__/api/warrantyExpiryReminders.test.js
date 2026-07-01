const pool = require('../../db/pool');
const warrantyReminderService = require('../../services/postSale/warrantyReminderService');
const eventBus = require('../../utils/eventBus');

describe('Warranty Expiry Reminder Notifications to Clients', () => {
  jest.setTimeout(30000);
  let tenantId;
  let projectId;
  let pmUserId;

  let warranty90d;
  let warranty30d;
  let warrantyOtherOffset;
  let warrantyExpired;
  let warrantyVoided;

  const reminderEvents = [];
  const onReminder = (data) => {
    if (data.warrantyId) {
      reminderEvents.push(data);
    }
  };

  beforeAll(async () => {
    // 1. Resolve tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Fetch a PM user to assign to project (if any exists, else NULL)
    const pmRes = await pool.query("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    pmUserId = pmRes.rows[0]?.id || null;

    // 3. Create a test project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, pm_id)
      VALUES ($1, 'Warranty Expiry Project', 'Warranty Client', '7777777777', 'warranty@client.com', 'active', $2)
      RETURNING id
    `, [tenantId, pmUserId]);
    projectId = projRes.rows[0].id;

    // Subscribe to EventBus to capture dispatched events
    eventBus.on('warranty.expiry_reminder_sent', onReminder);
  });

  afterAll(async () => {
    // Clean up created records (Note: audit_logs is immutable)
    if (projectId) {
      await pool.query('DELETE FROM warranties WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }

    // Unsubscribe from EventBus
    eventBus.off('warranty.expiry_reminder_sent', onReminder);
    await pool.end();
  });

  beforeEach(async () => {
    // Clear any previous records
    await pool.query('DELETE FROM warranties WHERE project_id = $1', [projectId]);
    reminderEvents.length = 0;
  });

  it('should send expiry reminders for appropriate intervals (90 and 30 days before) and avoid sending duplicates or sending for voided/expired warranties', async () => {
    // Create the test warranties
    
    // 1. Expiring in 90 days
    const res1 = await pool.query(`
      INSERT INTO warranties (tenant_id, project_id, product_name, brand, start_date, end_date, status)
      VALUES ($1, $2, '90d Fridge', 'Samsung', CURRENT_DATE, CURRENT_DATE + 90, 'active')
      RETURNING id
    `, [tenantId, projectId]);
    warranty90d = res1.rows[0].id;

    // 2. Expiring in 30 days
    const res2 = await pool.query(`
      INSERT INTO warranties (tenant_id, project_id, product_name, brand, start_date, end_date, status)
      VALUES ($1, $2, '30d Microwave', 'LG', CURRENT_DATE, CURRENT_DATE + 30, 'active')
      RETURNING id
    `, [tenantId, projectId]);
    warranty30d = res2.rows[0].id;

    // --- Controls: ---
    
    // Expiring in 45 days (should NOT trigger)
    const resOther = await pool.query(`
      INSERT INTO warranties (tenant_id, project_id, product_name, brand, start_date, end_date, status)
      VALUES ($1, $2, '45d Television', 'Sony', CURRENT_DATE, CURRENT_DATE + 45, 'active')
      RETURNING id
    `, [tenantId, projectId]);
    warrantyOtherOffset = resOther.rows[0].id;

    // Already expired (e.g. expired 5 days ago, should NOT trigger)
    const resExpired = await pool.query(`
      INSERT INTO warranties (tenant_id, project_id, product_name, brand, start_date, end_date, status)
      VALUES ($1, $2, 'Expired AC', 'Daikin', CURRENT_DATE - 365, CURRENT_DATE - 5, 'active')
      RETURNING id
    `, [tenantId, projectId]);
    warrantyExpired = resExpired.rows[0].id;

    // Expiring in 30 days but voided status (should NOT trigger)
    const resVoided = await pool.query(`
      INSERT INTO warranties (tenant_id, project_id, product_name, brand, start_date, end_date, status)
      VALUES ($1, $2, 'Voided Chimney', 'Faber', CURRENT_DATE, CURRENT_DATE + 30, 'voided')
      RETURNING id
    `, [tenantId, projectId]);
    warrantyVoided = resVoided.rows[0].id;

    // Run the reminder service check
    const remindersCount = await warrantyReminderService.checkAndSendWarrantyExpiryReminders(projectId);
    
    // We expect exactly 2 reminders to be sent (90d and 30d)
    expect(remindersCount).toBe(2);

    // Filter events to our created warranties only
    const projectReminderEvents = reminderEvents.filter(e => 
      [warranty90d, warranty30d].includes(e.warrantyId)
    );
    expect(projectReminderEvents.length).toBe(2);

    // Verify trigger types
    const types = projectReminderEvents.map(e => e.reminderType);
    expect(types).toContain('90_days_before');
    expect(types).toContain('30_days_before');

    // Verify audit logs were written for deduplication
    const auditLogsRes = await pool.query(`
      SELECT entity_id, new_value FROM audit_logs
      WHERE entity = 'warranty' 
        AND action = 'warranty_expiry_reminder'
        AND entity_id IN ($1, $2)
    `, [warranty90d, warranty30d]);
    expect(auditLogsRes.rows.length).toBe(2);

    const loggedIds = auditLogsRes.rows.map(r => r.entity_id);
    expect(loggedIds).toContain(warranty90d);
    expect(loggedIds).toContain(warranty30d);

    // Run the check again. Since audit logs exist, it should send 0 new reminders.
    const secondRunCount = await warrantyReminderService.checkAndSendWarrantyExpiryReminders(projectId);
    expect(secondRunCount).toBe(0);
  });
});
