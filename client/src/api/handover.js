import api from './axios';

export const getHandoverChecklist = (projectId) => api.get(`/projects/${projectId}/handover/checklists`);

export const createHandoverChecklist = (projectId) => api.post(`/projects/${projectId}/handover/checklists`);

export const addHandoverItem = (projectId, data) => api.post(`/projects/${projectId}/handover/items`, data);

export const updateHandoverItem = (itemId, data) => api.patch(`/handover/items/${itemId}`, data);

export const signOffHandoverChecklist = (checklistId) => api.post(`/handover/checklists/${checklistId}/sign-off`);
