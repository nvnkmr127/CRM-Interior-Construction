const eventBus = require('../../utils/eventBus');
const { createProject } = require('./createProject');

eventBus.on('lead.stage_changed', async ({ tenantId, userId, lead, _oldStage, newStage }) => {
  try {
    // Construction-Specific Workflow: If the new stage implies execution/handover, automatically spin up a Project.
    const triggerStages = ['booking', 'handover', 'execution'];
    
    if (newStage && triggerStages.some(trigger => newStage.name.toLowerCase().includes(trigger))) {
      console.log(`[Project Event Handler] Lead ${lead.id} moved to ${newStage.name}. Auto-creating project...`);
      
      await createProject({
        tenantId,
        userId,
        data: {
          name: `${lead.name} - ${lead.property_type || 'Interior Project'}`,
          client_name: lead.name,
          status: 'draft'
        }
      });
      console.log(`[Project Event Handler] Execution Project successfully created for Lead ${lead.id}`);
    }
  } catch (error) {
    console.error('[Project Event Handler] Error processing lead.stage_changed:', error);
  }
});

eventBus.on('project.milestone_overdue', async ({ tenantId, milestone }) => {
  try {
    const { recalculateSchedule } = require('./scheduleRecalculator');
    await recalculateSchedule({
      tenantId,
      projectId: milestone.project_id,
      triggerType: 'milestone_overdue',
      triggerName: milestone.name
    });
  } catch (error) {
    console.error('[Project Event Handler] Error processing project.milestone_overdue:', error);
  }
});

eventBus.on('project.task_overdue', async ({ tenantId, task }) => {
  try {
    const { recalculateSchedule } = require('./scheduleRecalculator');
    await recalculateSchedule({
      tenantId,
      projectId: task.project_id,
      triggerType: 'task_overdue',
      triggerName: task.title
    });
  } catch (error) {
    console.error('[Project Event Handler] Error processing project.task_overdue:', error);
  }
});

eventBus.on('project.handover_signed', async ({ tenantId, projectId }) => {
  try {
    const pool = require('../../config/db');
    // 1. Update project property_handover_date if not set
    await pool.query(
      `UPDATE projects 
       SET property_handover_date = CURRENT_DATE, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND property_handover_date IS NULL`,
      [projectId]
    );

    // 2. Generate customer retention schedules
    const { generateRetentionSchedules } = require('../postSale/retentionService');
    await generateRetentionSchedules(tenantId, projectId, new Date());

    // 3. Create workmanship warranty
    const { createWarranty } = require('../postSale/warrantyService');
    const start = new Date();
    const end = new Date();
    end.setFullYear(start.getFullYear() + 1);

    await createWarranty({
      tenantId,
      projectId,
      productName: '1-Year Installation & Workmanship Warranty',
      brand: 'In-House',
      brandWarrantyMonths: 0,
      companyWarrantyMonths: 12,
      startDate: start,
      endDate: end,
      notes: 'Automatically activated upon successful handover sign-off.'
    });
    console.log(`[Project Event Handler] Auto-activated installation warranty and retention schedules for project ${projectId}`);
  } catch (error) {
    console.error('[Project Event Handler] Error processing project.handover_signed:', error);
  }
});

module.exports = {};
