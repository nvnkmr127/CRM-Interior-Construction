const eventBus = require('../../utils/eventBus');
const { createProject } = require('./createProject');

eventBus.on('lead.stage_changed', async ({ tenantId, userId, lead, oldStage, newStage }) => {
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

module.exports = {};
