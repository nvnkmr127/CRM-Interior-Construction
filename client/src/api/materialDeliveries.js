import api from './axios';

export const getAll = async (params) => {
  return await api.get('/materialDeliveries', { params });
};

export const getById = async (id) => {
  return await api.get(`/materialDeliveries/${id}`);
};

export const create = async (data) => {
  return await api.post('/materialDeliveries', data);
};

export const update = async (id, data) => {
  return await api.put(`/materialDeliveries/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/materialDeliveries/${id}`);
};
