import api from './axios';

export const getAll = async (params) => {
  return await api.get('/communications', { params });
};

export const getById = async (id) => {
  return await api.get(`/communications/${id}`);
};

export const create = async (data) => {
  return await api.post('/communications', data);
};

export const update = async (id, data) => {
  return await api.put(`/communications/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/communications/${id}`);
};
