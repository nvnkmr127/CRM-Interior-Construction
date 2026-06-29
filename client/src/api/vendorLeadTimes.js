import api from './axios';

export const getLeadTimes = () => api.get('/vendor-lead-times');
export const saveLeadTime = (data) => api.post('/vendor-lead-times', data);
export const deleteLeadTime = (id) => api.delete(`/vendor-lead-times/${id}`);
