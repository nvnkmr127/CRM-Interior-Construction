import api from './axios';

export const getPaymentMilestones = (projectId) => api.get(`/projects/${projectId}/payment-milestones`);

export const createPaymentMilestone = (data) => api.post('/payment-milestones', data);

export const updatePaymentMilestone = (id, data) => api.patch(`/payment-milestones/${id}`, data);
