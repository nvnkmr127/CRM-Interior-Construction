import api from './axios';

export const getAll = async (params) => {
  return await api.get('/usersBulk', { params });
};

export const getById = async (id) => {
  return await api.get(`/usersBulk/${id}`);
};

export const create = async (data) => {
  return await api.post('/usersBulk', data);
};

export const update = async (id, data) => {
  return await api.put(`/usersBulk/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/usersBulk/${id}`);
};
