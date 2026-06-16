import api from './axios.js'

export const analyticsApi = {
  getLeadAnalytics:    (from, to) => api.get('/analytics/leads',    { params:{from,to} }).then(r=>r.data.data),
  getProjectAnalytics: (from, to) => api.get('/analytics/projects', { params:{from,to} }).then(r=>r.data.data),
}
