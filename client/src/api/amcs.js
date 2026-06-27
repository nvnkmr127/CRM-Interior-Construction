import api from './axios.js'

export const getAmcs = (projectId) => api.get(`/projects/${projectId}/amcs`).then(r => r.data.data);
export const createAmc = (projectId, data) => api.post(`/projects/${projectId}/amcs`, data).then(r => r.data.data);
export const updateAmc = (projectId, amcId, data) => api.put(`/projects/${projectId}/amcs/${amcId}`, data).then(r => r.data.data);
export const deleteAmc = (projectId, amcId) => api.delete(`/projects/${projectId}/amcs/${amcId}`).then(r => r.data.data);

export const createAmcVisit = (projectId, amcId, data) => api.post(`/projects/${projectId}/amcs/${amcId}/visits`, data).then(r => r.data.data);
export const updateAmcVisit = (projectId, amcId, visitId, data) => api.put(`/projects/${projectId}/amcs/${amcId}/visits/${visitId}`, data).then(r => r.data.data);
export const deleteAmcVisit = (projectId, amcId, visitId) => api.delete(`/projects/${projectId}/amcs/${amcId}/visits/${visitId}`).then(r => r.data.data);

export const getPortalAmcs = () => api.get('/portal/amcs').then(r => r.data.data);
