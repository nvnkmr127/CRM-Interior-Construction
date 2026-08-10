import api from './axios';

export const getAll = async (params) => {
  return await api.get('/ai', { params });
};

export const getById = async (id) => {
  return await api.get(`/ai/${id}`);
};

export const create = async (data) => {
  return await api.post('/ai', data);
};

export const update = async (id, data) => {
  return await api.put(`/ai/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/ai/${id}`);
};
