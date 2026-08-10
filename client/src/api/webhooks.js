import api from './axios';

export const getAll = async (params) => {
  return await api.get('/webhooks', { params });
};

export const getById = async (id) => {
  return await api.get(`/webhooks/${id}`);
};

export const create = async (data) => {
  return await api.post('/webhooks', data);
};

export const update = async (id, data) => {
  return await api.put(`/webhooks/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/webhooks/${id}`);
};
