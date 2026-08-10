import api from './axios';

export const getAll = async (params) => {
  return await api.get('/vendorPayments', { params });
};

export const getById = async (id) => {
  return await api.get(`/vendorPayments/${id}`);
};

export const create = async (data) => {
  return await api.post('/vendorPayments', data);
};

export const update = async (id, data) => {
  return await api.put(`/vendorPayments/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/vendorPayments/${id}`);
};
