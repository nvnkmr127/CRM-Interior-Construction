import api from './axios';

export const getAll = async (params) => {
  return await api.get('/emailTemplates', { params });
};

export const getById = async (id) => {
  return await api.get(`/emailTemplates/${id}`);
};

export const create = async (data) => {
  return await api.post('/emailTemplates', data);
};

export const update = async (id, data) => {
  return await api.put(`/emailTemplates/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/emailTemplates/${id}`);
};
