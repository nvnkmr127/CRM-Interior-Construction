import api from './axios';

export const getAll = async (params) => {
  return await api.get('/warehouses', { params });
};

export const getById = async (id) => {
  return await api.get(`/warehouses/${id}`);
};

export const create = async (data) => {
  return await api.post('/warehouses', data);
};

export const update = async (id, data) => {
  return await api.put(`/warehouses/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/warehouses/${id}`);
};
