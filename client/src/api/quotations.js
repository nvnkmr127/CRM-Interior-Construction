import api from './axios';

export const getAll = async (params) => {
  return await api.get('/quotations', { params });
};

export const getById = async (id) => {
  return await api.get(`/quotations/${id}`);
};

export const create = async (data) => {
  return await api.post('/quotations', data);
};

export const update = async (id, data) => {
  return await api.put(`/quotations/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/quotations/${id}`);
};
