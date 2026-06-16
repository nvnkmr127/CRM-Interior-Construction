import api from './axios.js'

export const dashboardApi = {
  getStats:    () => api.get('/dashboard/stats').then(r => r.data.data),
  getActivity: (limit=10) => api.get(`/dashboard/activity?limit=${limit}`).then(r => r.data.data),
  getPipeline: () => api.get('/dashboard/pipeline').then(r => r.data.data),
  getMyTasks:  (limit=7) => api.get(`/dashboard/my-tasks?limit=${limit}`).then(r => r.data.data),
}
