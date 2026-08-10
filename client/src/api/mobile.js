import api from './axios';

export const getAll = async (params) => {
  return await api.get('/mobile', { params });
};

export const getById = async (id) => {
  return await api.get(`/mobile/${id}`);
};

export const create = async (data) => {
  return await api.post('/mobile', data);
};

export const update = async (id, data) => {
  return await api.put(`/mobile/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/mobile/${id}`);
};
