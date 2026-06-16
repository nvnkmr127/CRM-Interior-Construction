import api from './axios';

export const getLeadAnalytics = (params) => api.get('/analytics/leads', { params });

export const getProjectAnalytics = (params) => api.get('/analytics/projects', { params });
