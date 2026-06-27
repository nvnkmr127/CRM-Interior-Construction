import api from './axios';

export const getInvoiceByMilestone = (milestoneId) => api.get(`/invoices/milestone/${milestoneId}`);

export const getInvoiceDraft = (milestoneId) => api.get(`/invoices/milestone/${milestoneId}/draft`);

export const createInvoice = (data) => api.post('/invoices', data);
