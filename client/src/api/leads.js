/* eslint-disable no-unused-vars, no-undef */
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
 * Fetch site visits for a lead.
 * @param {string} id - The UUID of the lead.
 * @returns {Promise<{ success: boolean, data: Array }>} List of site visits.
 */
export const getSiteVisits = async (id) => {
  const response = await api.get(`/site-visits/lead/${id}`);
  return response.data;
};

/**
 * Create a site visit for a lead.
 * @param {string} id - The UUID of the lead.
 * @param {Object} data - The site visit data.
 * @returns {Promise<{ success: boolean, data: Object }>} The created site visit.
 */
export const createSiteVisit = async (id, data) => {
  const response = await api.post(`/site-visits/lead/${id}`, data);
  return response.data;
};

/**
 * Fetch communications for a lead.
 */
export const getCommunications = async (id) => {
  const response = await api.get(`/leads/${id}/communications`);
  return response.data;
};

/**
 * Create a communication for a lead.
 */
export const createCommunication = async (id, data) => {
  const response = await api.post(`/leads/${id}/communications`, data);
  return response.data;
};

/**
 * Draft a communication with AI.
 */
export const draftCommunication = async (id, data) => {
  const response = await api.post(`/leads/${id}/communications/draft`, data);
  return response.data;
};

/**
 * Sync WhatsApp communications / status updates for a lead.
 */
export const syncCommunications = async (id) => {
  const response = await api.post(`/leads/${id}/communications/sync`);
  return response.data;
};

/**
 * Bulk change the stage of multiple leads.
 * @param {Array<string>} leadIds - UUIDs of the leads.
 * @param {string} stageId - The UUID of the new stage.
 * @returns {Promise<{ success: boolean, data: Object }>} Result.
 */
export const bulkChangeLeadStage = async (leadIds, stageId) => {
  const response = await api.post(`/leads/bulk/stage`, { leadIds, stageId });
  return response.data;
};

/**
 * Bulk delete multiple leads.
 * @param {Array<string>} leadIds - UUIDs of the leads.
 * @returns {Promise<{ success: boolean, data: Object }>} Result.
 */
export const bulkDeleteLeads = async (leadIds) => {
  const response = await api.post(`/leads/bulk/delete`, { leadIds });
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
 * Fetch a paginated list of timeline events for a specific lead.
 * @param {string} leadId - The UUID of the lead.
 * @param {Object} params - Query parameters.
 * @param {string} [params.type] - Filter by event type ('all', 'system', 'note', 'email', etc).
 * @param {number} [params.page] - Page number (default: 1).
 * @param {number} [params.limit] - Results per page (default: 20).
 * @returns {Promise<{ success: boolean, data: Array, meta: Object }>} Paginated list of events.
 */
export const getLeadTimeline = async (leadId, params) => {
  const response = await api.get(`/leads/${leadId}/timeline`, { params });
  return response.data;
};

/**
 * Convert a lead to a project (stub for D3 integration).
 * @param {string} leadId - The UUID of the lead.
 * @param {Object} projectData - The payload to initialize the project.
 * @returns {Promise<{ success: boolean, data: Object }>} The newly created project details.
 */
export const convertToProject = async (leadId, projectData) => {
  const response = await api.post(`/leads/${leadId}/convert-to-project`, projectData);
  return response.data;
};

/**
 * Create a native estimate.
 * @param {string} leadId - The UUID of the lead.
 * @param {Object} payload - The estimate data (rooms, items).
 * @returns {Promise<{ success: boolean, data: Object }>} The created estimate.
 */
export const createEstimate = async (leadId, payload) => {
  const response = await api.post(`/leads/${leadId}/estimates`, payload);
  return response.data;
};

/**
 * Get estimates for a lead.
 * @param {string} leadId - The UUID of the lead.
 * @returns {Promise<{ success: boolean, data: Array }>} List of estimates.
 */
export const getEstimates = async (leadId) => {
  const response = await api.get(`/leads/${leadId}/estimates`);
  return response.data;
};

/**
 * Fetch site measurements for a lead.
 * @param {string} leadId - The UUID of the lead.
 * @returns {Promise<{ success: boolean, data: Array }>} List of measurements.
 */
export const getLeadMeasurements = async (leadId) => {
  const response = await api.get(`/leads/${leadId}/measurements`);
  return response.data;
};

/**
 * Capture a new measurement for a lead.
 * @param {string} leadId - The UUID of the lead.
 * @param {Object} data - Measurement details.
 * @returns {Promise<{ success: boolean, data: Object }>} Created measurement.
 */
export const createLeadMeasurement = async (leadId, data) => {
  const response = await api.post(`/leads/${leadId}/measurements`, data);
  return response.data;
};

export const getAutomationEvents = async (leadId) => {
  const response = await api.get(/leads//automation-events);
  return response.data.data;
};

/**
 * Update an existing activity for a lead.
 * @param {string} leadId - The UUID of the lead.
 * @param {string} activityId - The UUID of the activity.
 * @param {Object} data - The updated activity data.
 * @returns {Promise<{ success: boolean, data: Object }>} The updated activity.
 */
export const updateActivity = async (leadId, activityId, data) => {
  const response = await api.patch(`/leads/${leadId}/activities/${activityId}`, data);
  return response.data;
};
