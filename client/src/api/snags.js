import api from './axios.js'

export const snagsApi = {
  getByProject: (projectId, params={}) =>
    api.get(`/projects/${projectId}/snags`, {params}).then(r=>r.data.data),
  create: (projectId, data) =>
    api.post(`/projects/${projectId}/snags`, data).then(r=>r.data.data),
  update: (snagId, data) =>
    api.patch(`/snags/${snagId}`, data).then(r=>r.data.data),
  // Portal
  portalGetAll: ()       => api.get('/portal/snags').then(r=>r.data.data),
  portalCreate: (data)   => api.post('/portal/snags', data).then(r=>r.data.data),
  portalVerify: (snagId) => api.post(`/portal/snags/${snagId}/verify`).then(r=>r.data.data),
}
