import api from './axios';

export const getAll = async (params) => {
  return await api.get('/mfa', { params });
};

export const getById = async (id) => {
  return await api.get(`/mfa/${id}`);
};

export const create = async (data) => {
  return await api.post('/mfa', data);
};

export const update = async (id, data) => {
  return await api.put(`/mfa/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/mfa/${id}`);
};
