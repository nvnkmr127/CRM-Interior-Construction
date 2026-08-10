import api from './axios';

export const getAll = async (params) => {
  return await api.get('/designAssets', { params });
};

export const getById = async (id) => {
  return await api.get(`/designAssets/${id}`);
};

export const create = async (data) => {
  return await api.post('/designAssets', data);
};

export const update = async (id, data) => {
  return await api.put(`/designAssets/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/designAssets/${id}`);
};
