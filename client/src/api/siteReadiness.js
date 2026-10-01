import api from './axios';

export const getSiteReadiness = (projectId) => api.get(`/projects/${projectId}/site-readiness`);

export const updateSiteReadinessItem = (projectId, itemId, data) => api.patch(`/projects/${projectId}/site-readiness/${itemId}`, data);

export const createSiteReadinessItem = (projectId, data) => api.post(`/projects/${projectId}/site-readiness`, data);

export const deleteSiteReadinessItem = (projectId, itemId) => api.delete(`/projects/${projectId}/site-readiness/${itemId}`);

export const signOffSiteReadiness = (projectId) => api.post(`/projects/${projectId}/site-readiness/sign-off`);
