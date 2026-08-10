import api from './axios';

export const getAll = async (params) => {
  return await api.get('/materialUsages', { params });
};

export const getById = async (id) => {
  return await api.get(`/materialUsages/${id}`);
};

export const create = async (data) => {
  return await api.post('/materialUsages', data);
};

export const update = async (id, data) => {
  return await api.put(`/materialUsages/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/materialUsages/${id}`);
};
