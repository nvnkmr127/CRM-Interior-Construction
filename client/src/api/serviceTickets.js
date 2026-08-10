import api from './axios';

export const getAll = async (params) => {
  return await api.get('/serviceTickets', { params });
};

export const getById = async (id) => {
  return await api.get(`/serviceTickets/${id}`);
};

export const create = async (data) => {
  return await api.post('/serviceTickets', data);
};

export const update = async (id, data) => {
  return await api.put(`/serviceTickets/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/serviceTickets/${id}`);
};
