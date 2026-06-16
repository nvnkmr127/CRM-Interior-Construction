import api from './axios.js'

export const getSnags = (projectId, params={}) =>
  api.get(`/projects/${projectId}/snags`, {params}).then(r=>r.data.data);
export const createSnag = (projectId, data) =>
  api.post(`/projects/${projectId}/snags`, data).then(r=>r.data.data);
export const updateSnag = (snagId, data) =>
  api.patch(`/snags/${snagId}`, data).then(r=>r.data.data);

// Portal
export const getPortalSnags = () => api.get('/portal/snags').then(r=>r.data.data);
export const createPortalSnag = (data) => api.post('/portal/snags', data).then(r=>r.data.data);
export const verifyPortalSnag = (snagId) => api.post(`/portal/snags/${snagId}/verify`).then(r=>r.data.data);
