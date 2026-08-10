import api from './axios';

export const getAll = async (params) => {
  return await api.get('/leaves', { params });
};

export const getById = async (id) => {
  return await api.get(`/leaves/${id}`);
};

export const create = async (data) => {
  return await api.post('/leaves', data);
};

export const update = async (id, data) => {
  return await api.put(`/leaves/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/leaves/${id}`);
};
