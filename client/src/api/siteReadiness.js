import api from './axios';

export const getSiteReadiness = (projectId) => api.get(`/projects/${projectId}/site-readiness`);

export const updateSiteReadinessItem = (projectId, itemId, data) => api.patch(`/projects/${projectId}/site-readiness/${itemId}`, data);

export const signOffSiteReadiness = (projectId) => api.post(`/projects/${projectId}/site-readiness/sign-off`);
