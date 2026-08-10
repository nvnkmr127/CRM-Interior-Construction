import api from './axios';

export const getAll = async (params) => {
  return await api.get('/emails', { params });
};

export const getById = async (id) => {
  return await api.get(`/emails/${id}`);
};

export const create = async (data) => {
  return await api.post('/emails', data);
};

export const update = async (id, data) => {
  return await api.put(`/emails/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/emails/${id}`);
};
