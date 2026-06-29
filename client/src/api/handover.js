import api from './axios.js'

export const getHandoverChecklist = (projectId) => api.get(`/projects/${projectId}/handover/checklists`).then(r=>r.data.data);
export const createHandoverChecklist = (projectId) => api.post(`/projects/${projectId}/handover/checklists`).then(r=>r.data.data);
export const updateHandoverItem = (itemId, data) => api.patch(`/handover/items/${itemId}`, data).then(r=>r.data.data);
export const signOffHandoverChecklist = (checklistId) => api.post(`/handover/checklists/${checklistId}/sign-off`).then(r=>r.data.data);
export const addHandoverItem = (checklistId, data) => api.post(`/handover/checklists/${checklistId}/items`, data).then(r=>r.data.data);

// Handover Readiness Gates & Scheduled Appointments
export const getHandoverReadiness = (projectId) => api.get(`/projects/${projectId}/handover/readiness`).then(r => r.data.data || r.data);
export const pmSignOffHandoverReadiness = (projectId) => api.post(`/projects/${projectId}/handover/readiness/pm-sign-off`).then(r => r.data.data || r.data);
export const getHandoverAppointments = (projectId) => api.get(`/projects/${projectId}/handover/appointments`).then(r => r.data.data || r.data);
export const scheduleHandoverAppointment = (projectId, data) => api.post(`/projects/${projectId}/handover/appointments`, data).then(r => r.data.data || r.data);
export const getHandoverReadinessDashboard = () => api.get(`/projects/handover/readiness-dashboard`).then(r => r.data.data || r.data);

// Customer Retention Schedules
export const getRetentionSchedules = (projectId) => api.get(`/projects/${projectId}/retention`).then(r => r.data.data || r.data);
export const updateRetentionSchedule = (projectId, scheduleId, data) => api.patch(`/projects/${projectId}/retention/${scheduleId}`, data).then(r => r.data.data || r.data);
export const getRetentionDashboard = () => api.get('/projects/retention/dashboard').then(r => r.data.data || r.data);

// Service Support Tickets & Visits
export const getServiceTickets = (projectId) => api.get(`/projects/${projectId}/service-tickets`).then(r => r.data.data || r.data);
export const createServiceTicket = (projectId, data) => api.post(`/projects/${projectId}/service-tickets`, data).then(r => r.data.data || r.data);
export const getServiceTicketById = (projectId, ticketId) => api.get(`/projects/${projectId}/service-tickets/${ticketId}`).then(r => r.data.data || r.data);
export const updateServiceTicket = (projectId, ticketId, data) => api.put(`/projects/${projectId}/service-tickets/${ticketId}`, data).then(r => r.data.data || r.data);
export const deleteServiceTicket = (projectId, ticketId) => api.delete(`/projects/${projectId}/service-tickets/${ticketId}`).then(r => r.data.data || r.data);

export const scheduleServiceVisit = (projectId, ticketId, data) => api.post(`/projects/${projectId}/service-tickets/${ticketId}/visits`, data).then(r => r.data.data || r.data);
export const updateServiceVisit = (projectId, ticketId, visitId, data) => api.put(`/projects/${projectId}/service-tickets/${ticketId}/visits/${visitId}`, data).then(r => r.data.data || r.data);
export const deleteServiceVisit = (projectId, ticketId, visitId) => api.delete(`/projects/${projectId}/service-tickets/${ticketId}/visits/${visitId}`).then(r => r.data.data || r.data);

export const getCsatMetrics = (projectId) => api.get(`/projects/${projectId}/service-tickets/csat-metrics`).then(r => r.data.data || r.data);
