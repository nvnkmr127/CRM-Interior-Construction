import api from './axios';

export const getAll = async (params) => {
  return await api.get('/materialSubstitutions', { params });
};

export const getById = async (id) => {
  return await api.get(`/materialSubstitutions/${id}`);
};

export const create = async (data) => {
  return await api.post('/materialSubstitutions', data);
};

export const update = async (id, data) => {
  return await api.put(`/materialSubstitutions/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/materialSubstitutions/${id}`);
};
