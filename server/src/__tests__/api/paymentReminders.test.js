const pool = require('../../db/pool');
const paymentReminderService = require('../../services/projects/paymentReminderService');
const eventBus = require('../../utils/eventBus');

describe('Payment Due Reminder Notifications to Clients', () => {
  jest.setTimeout(30000);
  let tenantId;
  let projectId;
  let pmUser;
  
  // We need milestones with specific due date offsets:
  // 7 days before, on due date, 3 days overdue, 7 days overdue, 14 days overdue.
  let milestone7dBefore;
  let milestoneOnDue;
  let milestone3dOverdue;
  let milestone7dOverdue;
  let milestone14dOverdue;
  
  // Control milestones:
  let _milestonePaid;
  let _milestoneDeferred;
  let _milestoneNoDueDate;
  let _milestoneOtherOffset;

  const reminderEvents = [];
  const onReminder = (data) => {
    // Only capture events for this specific project
    if (data.milestoneId) {
      reminderEvents.push(data);
    }
  };

  beforeAll(async () => {
    // 1. Resolve tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Fetch a PM user to assign to project (if any exists, else NULL)
    const pmRes = await pool.query("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    pmUser = pmRes.rows[0]?.id || null;

    // 3. Create a test project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, pm_id)
      VALUES ($1, 'Reminder Test Project', 'Reminder Client', '9999999999', 'reminder@client.com', 'active', $2)
      RETURNING id
    `, [tenantId, pmUser]);
    projectId = projRes.rows[0].id;

    // Subscribe to EventBus to capture dispatched events
    eventBus.on('payment_milestone.reminder_sent', onReminder);
  });

  afterAll(async () => {
    // Clean up created records (Note: audit_logs is immutable, so we do not delete from it)
    if (projectId) {
      await pool.query('DELETE FROM payment_milestones WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    
    // Unsubscribe from EventBus
    eventBus.off('payment_milestone.reminder_sent', onReminder);
    await pool.end();
  });

  beforeEach(async () => {
    // Clear any previous milestone records for this project
    await pool.query('DELETE FROM payment_milestones WHERE project_id = $1', [projectId]);
    reminderEvents.length = 0;
  });

  it('should send reminders for appropriate intervals and avoid sending duplicates or sending for paid/deferred milestones', async () => {
    // Create the test payment milestones with various states and dates
    
    // 1. 7 days before due date (e.g. today + 7 days)
    const res1 = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, is_deferred)
      VALUES ($1, $2, '7 Days Before Milestone', 10000.00, CURRENT_DATE + 7, 'scheduled', false)
      RETURNING id
    `, [tenantId, projectId]);
    milestone7dBefore = res1.rows[0].id;

    // 2. On due date (today)
    const res2 = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, is_deferred)
      VALUES ($1, $2, 'Due Today Milestone', 20000.00, CURRENT_DATE, 'invoice_raised', false)
      RETURNING id
    `, [tenantId, projectId]);
    milestoneOnDue = res2.rows[0].id;

    // 3. 3 days overdue (today - 3 days)
    const res3 = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, is_deferred)
      VALUES ($1, $2, '3 Days Overdue Milestone', 15000.00, CURRENT_DATE - 3, 'overdue', false)
      RETURNING id
    `, [tenantId, projectId]);
    milestone3dOverdue = res3.rows[0].id;

    // 4. 7 days overdue (today - 7 days)
    const res4 = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, is_deferred)
      VALUES ($1, $2, '7 Days Overdue Milestone', 25000.00, CURRENT_DATE - 7, 'overdue', false)
      RETURNING id
    `, [tenantId, projectId]);
    milestone7dOverdue = res4.rows[0].id;

    // 5. 14 days overdue (today - 14 days)
    const res5 = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, is_deferred)
      VALUES ($1, $2, '14 Days Overdue Milestone', 35000.00, CURRENT_DATE - 14, 'overdue', false)
      RETURNING id
    `, [tenantId, projectId]);
    milestone14dOverdue = res5.rows[0].id;

    // --- Controls: ---
    
    // Paid milestone (e.g. 3 days overdue, but paid status) -> should NOT trigger
    const resPaid = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, is_deferred)
      VALUES ($1, $2, 'Paid Milestone', 10000.00, CURRENT_DATE - 3, 'paid', false)
      RETURNING id
    `, [tenantId, projectId]);
    milestonePaid = resPaid.rows[0].id;

    // Deferred milestone (e.g. 7 days overdue, but deferred) -> should NOT trigger
    const resDeferred = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, is_deferred)
      VALUES ($1, $2, 'Deferred Milestone', 12000.00, CURRENT_DATE - 7, 'overdue', true)
      RETURNING id
    `, [tenantId, projectId]);
    milestoneDeferred = resDeferred.rows[0].id;

    // No due date -> should NOT trigger
    const resNoDueDate = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, is_deferred)
      VALUES ($1, $2, 'No Due Date Milestone', 8000.00, NULL, 'scheduled', false)
      RETURNING id
    `, [tenantId, projectId]);
    milestoneNoDueDate = resNoDueDate.rows[0].id;

    // Other offset (e.g. 5 days overdue) -> should NOT trigger
    const resOtherOffset = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, is_deferred)
      VALUES ($1, $2, '5 Days Overdue Milestone', 9000.00, CURRENT_DATE - 5, 'overdue', false)
      RETURNING id
    `, [tenantId, projectId]);
    milestoneOtherOffset = resOtherOffset.rows[0].id;

    // Run the reminder service check, scoped only to our project
    const remindersCount = await paymentReminderService.checkAndSendPaymentReminders(projectId);
    
    // We expect exactly 5 reminders to be sent (7d before, on due date, 3d overdue, 7d overdue, 14d overdue)
    expect(remindersCount).toBe(5);

    // Filter events to our created milestones only
    const projectReminderEvents = reminderEvents.filter(e => 
      [milestone7dBefore, milestoneOnDue, milestone3dOverdue, milestone7dOverdue, milestone14dOverdue].includes(e.milestoneId)
    );
    expect(projectReminderEvents.length).toBe(5);
    
    // Check that we have the expected event types
    const types = projectReminderEvents.map(e => e.reminderType);
    expect(types).toContain('7_days_before');
    expect(types).toContain('due_date');
    expect(types).toContain('3_days_overdue');
    expect(types).toContain('7_days_overdue');
    expect(types).toContain('14_days_overdue');

    // Verify audit logs were written for deduplication on our specific milestones
    const auditLogsRes = await pool.query(`
      SELECT entity_id, new_value FROM audit_logs
      WHERE entity = 'payment_milestone' 
        AND action = 'payment_reminder'
        AND entity_id IN ($1, $2, $3, $4, $5)
    `, [milestone7dBefore, milestoneOnDue, milestone3dOverdue, milestone7dOverdue, milestone14dOverdue]);
    expect(auditLogsRes.rows.length).toBe(5);
    
    const loggedMilestoneIds = auditLogsRes.rows.map(r => r.entity_id);
    expect(loggedMilestoneIds).toContain(milestone7dBefore);
    expect(loggedMilestoneIds).toContain(milestoneOnDue);
    expect(loggedMilestoneIds).toContain(milestone3dOverdue);
    expect(loggedMilestoneIds).toContain(milestone7dOverdue);
    expect(loggedMilestoneIds).toContain(milestone14dOverdue);

    // Run the service check again. Since audit logs are present, it should send 0 new reminders.
    const secondRunCount = await paymentReminderService.checkAndSendPaymentReminders(projectId);
    expect(secondRunCount).toBe(0);
  });
});
