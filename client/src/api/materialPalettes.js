import api from './axios';

export const getAll = async (params) => {
  return await api.get('/materialPalettes', { params });
};

export const getById = async (id) => {
  return await api.get(`/materialPalettes/${id}`);
};

export const create = async (data) => {
  return await api.post('/materialPalettes', data);
};

export const update = async (id, data) => {
  return await api.put(`/materialPalettes/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/materialPalettes/${id}`);
};
