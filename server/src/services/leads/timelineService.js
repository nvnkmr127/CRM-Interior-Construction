const leadRepository = require('../../repositories/leadRepository');

class TimelineService {
  async getLeadTimeline(tenantId, leadId, options = {}) {
    // Rely exclusively on the unified timeline table
    const result = await leadRepository.getLeadTimeline(tenantId, leadId, options);
    
    // Convert to the array format expected by the frontend (or pass through if it handles pagination)
    // The previous implementation returned a raw array, but getLeadTimeline returns { data, total, page, limit }
    // We'll return the paginated object as it's more robust, but if frontend expects an array, we could map it.
    // For safety, let's assume the frontend was hitting this through a controller.
    // The existing timeline service returned an array. Let's return result.data for backward compatibility
    // if the caller isn't using pagination, but it's better to just return the full result object.
    
    // Ensure all items have a generic category if they don't map cleanly
    result.data.forEach(item => {
      // The frontend might expect a 'category' field for grouping/icons
      if (!item.category) {
        if (item.type === 'stage.changed' || item.type === 'lead.stage_changed') item.category = 'audit';
        else if (item.type.includes('task')) item.category = 'task';
        else if (item.type.includes('site_visit')) item.category = 'site_visit';
        else if (item.type.includes('quotation')) item.category = 'quotation';
        else if (item.type.includes('payment')) item.category = 'payment';
        else if (item.type.includes('project')) item.category = 'project';
        else if (item.type.includes('call')) item.category = 'call';
        else if (item.type.includes('meeting')) item.category = 'meeting';
        else item.category = 'activity';
      }
      
      // Ensure description is populated
      item.description = item.notes || item.summary || item.title;
    });

    return result;
  }
}

module.exports = new TimelineService();
