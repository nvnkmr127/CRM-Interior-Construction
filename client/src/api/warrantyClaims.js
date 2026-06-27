import api from './axios.js'

export const getClaims = (projectId) => api.get(`/projects/${projectId}/warranty-claims`).then(r => r.data.data);
export const createClaim = (projectId, data) => api.post(`/projects/${projectId}/warranty-claims`, data).then(r => r.data.data);
export const updateClaim = (projectId, claimId, data) => api.put(`/projects/${projectId}/warranty-claims/${claimId}`, data).then(r => r.data.data);
export const deleteClaim = (projectId, claimId) => api.delete(`/projects/${projectId}/warranty-claims/${claimId}`).then(r => r.data.data);

export const getPortalClaims = () => api.get('/portal/warranty-claims').then(r => r.data.data);
export const createPortalClaim = (data) => api.post('/portal/warranty-claims', data).then(r => r.data.data);
