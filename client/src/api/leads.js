import api from './axios';

/**
 * Fetch a paginated list of leads with optional filters.
 * @param {Object} params - Query parameters.
 * @param {string} [params.stageId] - Filter by stage ID.
 * @param {string} [params.assigneeId] - Filter by assignee ID.
 * @param {string} [params.source] - Filter by lead source.
 * @param {string} [params.search] - Search query for name, email, or phone.
 * @param {number} [params.page] - Page number (default: 1).
 * @param {number} [params.limit] - Results per page (default: 20).
 * @returns {Promise<{ success: boolean, data: Array, meta: Object }>} Paginated list of leads.
 */
export const getLeads = async (params) => {
  const response = await api.get('/leads', { params });
  return response.data;
};

/**
 * Fetch a single lead by its ID.
 * @param {string} id - The UUID of the lead.
 * @returns {Promise<{ success: boolean, data: Object }>} The lead object, including recent activities.
 */
export const getLead = async (id) => {
  const response = await api.get(`/leads/${id}`);
  return response.data;
};

/**
 * Create a new lead.
 * @param {Object} data - The lead data payload.
 * @param {string} data.name - Name of the lead.
 * @param {string} data.phone - Phone number.
 * @param {string} [data.email] - Email address.
 * @param {string} [data.source] - Lead source (e.g., 'facebook', 'website').
 * @param {string} [data.stageId] - Stage UUID.
 * @param {string} [data.assigneeId] - Assignee UUID.
 * @param {string} [data.notes] - Additional notes.
 * @param {Object} [data.custom_fields] - Custom field key-value pairs.
 * @returns {Promise<{ success: boolean, data: Object }>} The created lead.
 */
export const createLead = async (data) => {
  const response = await api.post('/leads', data);
  return response.data;
};

/**
 * Update an existing lead.
 * @param {string} id - The UUID of the lead.
 * @param {Object} data - Partial lead data payload to update.
 * @returns {Promise<{ success: boolean, data: Object }>} The updated lead.
 */
export const updateLead = async (id, data) => {
  const response = await api.patch(`/leads/${id}`, data);
  return response.data;
};

/**
 * Soft delete a lead.
 * @param {string} id - The UUID of the lead to delete.
 * @returns {Promise<void>} Resolves when deletion is complete.
 */
export const deleteLead = async (id) => {
  const response = await api.delete(`/leads/${id}`);
  return response.data;
};

/**
 * Change the stage of a lead.
 * @param {string} id - The UUID of the lead.
 * @param {string} stageId - The UUID of the new stage.
 * @returns {Promise<{ success: boolean, data: Object }>} The updated lead object.
 */
export const changeLeadStage = async (id, stageId) => {
  const response = await api.post(`/leads/${id}/stage`, { stageId });
  return response.data;
};

/**
 * Log a new activity for a lead.
 * @param {string} leadId - The UUID of the lead.
 * @param {Object} data - The activity data.
 * @param {string} data.type - Activity type ('call', 'note', 'email', 'whatsapp', 'site_visit', 'meeting').
 * @param {string} data.notes - Content of the activity.
 * @param {string} [data.title] - Optional title.
 * @param {string} [data.outcome] - Outcome of the activity.
 * @param {string} [data.scheduledAt] - Datetime for scheduled activities.
 * @returns {Promise<{ success: boolean, data: Object }>} The created activity.
 */
export const logActivity = async (leadId, data) => {
  const response = await api.post(`/leads/${leadId}/activities`, data);
  return response.data;
};

/**
 * Fetch a paginated list of activities for a specific lead.
 * @param {string} leadId - The UUID of the lead.
 * @param {Object} params - Query parameters.
 * @param {string} [params.type] - Filter by activity type.
 * @param {number} [params.page] - Page number (default: 1).
 * @param {number} [params.limit] - Results per page (default: 20).
 * @returns {Promise<{ success: boolean, data: Array, meta: Object }>} Paginated list of activities.
 */
export const getActivities = async (leadId, params) => {
  const response = await api.get(`/leads/${leadId}/activities`, { params });
  return response.data;
};

/**
 * Convert a lead to a project (stub for D3 integration).
 * @param {string} leadId - The UUID of the lead.
 * @param {Object} projectData - The payload to initialize the project.
 * @returns {Promise<{ success: boolean, data: Object }>} The newly created project details.
 */
export const convertToProject = async (leadId, projectData) => {
  const response = await api.post(`/leads/${leadId}/convert`, projectData);
  return response.data;
};
