import api from './axios';

export const getAll = async (params) => {
  return await api.get('/drawingRegister', { params });
};

export const getById = async (id) => {
  return await api.get(`/drawingRegister/${id}`);
};

export const create = async (data) => {
  return await api.post('/drawingRegister', data);
};

export const update = async (id, data) => {
  return await api.put(`/drawingRegister/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/drawingRegister/${id}`);
};
