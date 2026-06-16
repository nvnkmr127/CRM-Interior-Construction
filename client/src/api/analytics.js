import api from './axios';

export const getLeadAnalytics = (params) => api.get('/analytics/leads', { params }).then(r=>r.data.data);

export const getProjectAnalytics = (params) => api.get('/analytics/projects', { params }).then(r=>r.data.data);
