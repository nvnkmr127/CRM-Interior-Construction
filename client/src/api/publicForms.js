import api from './axios';

export const getAll = async (params) => {
  return await api.get('/publicForms', { params });
};

export const getById = async (id) => {
  return await api.get(`/publicForms/${id}`);
};

export const create = async (data) => {
  return await api.post('/publicForms', data);
};

export const update = async (id, data) => {
  return await api.put(`/publicForms/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/publicForms/${id}`);
};
