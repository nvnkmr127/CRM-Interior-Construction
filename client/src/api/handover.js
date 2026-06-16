import api from './axios.js'

export const getHandoverChecklist = (projectId) => api.get(`/projects/${projectId}/handover/checklists`).then(r=>r.data.data);
export const createHandoverChecklist = (projectId) => api.post(`/projects/${projectId}/handover/checklists`).then(r=>r.data.data);
export const updateHandoverItem = (itemId, data) => api.patch(`/handover/items/${itemId}`, data).then(r=>r.data.data);
export const signOffHandoverChecklist = (checklistId) => api.post(`/handover/checklists/${checklistId}/sign-off`).then(r=>r.data.data);
export const addHandoverItem = (checklistId, data) => api.post(`/handover/checklists/${checklistId}/items`, data).then(r=>r.data.data);
