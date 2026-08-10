import api from './axios';

export const getAll = async (params) => {
  return await api.get('/auditLogs', { params });
};

export const getById = async (id) => {
  return await api.get(`/auditLogs/${id}`);
};

export const create = async (data) => {
  return await api.post('/auditLogs', data);
};

export const update = async (id, data) => {
  return await api.put(`/auditLogs/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/auditLogs/${id}`);
};
