import api from './axios';

export const getInvoiceByMilestone = (milestoneId) => api.get(`/invoices/milestone/${milestoneId}`);

export const getInvoiceDraft = (milestoneId) => api.get(`/invoices/draft`);

export const createInvoice = (data) => api.post('/invoices', data);

export const getInvoicesByProject = (projectId) => api.get(`/invoices?projectId=${projectId}`);

export const getAllInvoices = () => api.get(`/invoices`);

export const deleteInvoice = (invoiceId) => api.delete(`/invoices/${invoiceId}`);
