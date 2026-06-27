import api from './axios.js'

export const getWarranties = (projectId) => api.get(`/projects/${projectId}/warranties`).then(r => r.data.data);
export const createWarranty = (projectId, data) => api.post(`/projects/${projectId}/warranties`, data).then(r => r.data.data);
export const updateWarranty = (projectId, warrantyId, data) => api.put(`/projects/${projectId}/warranties/${warrantyId}`, data).then(r => r.data.data);
export const deleteWarranty = (projectId, warrantyId) => api.delete(`/projects/${projectId}/warranties/${warrantyId}`).then(r => r.data.data);

export const getPortalWarranties = () => api.get('/portal/warranties').then(r => r.data.data);
