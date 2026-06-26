import api from './axios';

export const getWorkActivities = (projectId, params) => api.get(`/projects/${projectId}/work-activities`, { params });

export const getTemplates = (projectId, params) => api.get(`/projects/${projectId}/work-activities/templates`, { params });

export const createWorkActivity = (projectId, data) => api.post(`/projects/${projectId}/work-activities`, data);

export const generateWorkActivities = (projectId, data) => api.post(`/projects/${projectId}/work-activities/generate`, data);

export const updateWorkActivity = (projectId, id, data) => api.patch(`/projects/${projectId}/work-activities/${id}`, data);

export const deleteWorkActivity = (projectId, id) => api.delete(`/projects/${projectId}/work-activities/${id}`);
