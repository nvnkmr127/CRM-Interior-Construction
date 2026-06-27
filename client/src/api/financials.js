import api from './axios';

export const getCreditNotes = (projectId) => api.get(`/financials/projects/${projectId}/credit-notes`);

export const getRefunds = (projectId) => api.get(`/financials/projects/${projectId}/refunds`);

export const createCreditNote = (data) => api.post('/financials/credit-notes', data);

export const createRefund = (data) => api.post('/financials/refunds', data);
