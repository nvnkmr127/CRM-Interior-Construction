import api from './axios';

export const getAll = async (params) => {
  return await api.get('/paymentEscalations', { params });
};

export const getById = async (id) => {
  return await api.get(`/paymentEscalations/${id}`);
};

export const create = async (data) => {
  return await api.post('/paymentEscalations', data);
};

export const update = async (id, data) => {
  return await api.put(`/paymentEscalations/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/paymentEscalations/${id}`);
};
