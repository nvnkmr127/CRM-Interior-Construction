import api from './axios';

export const getAll = async (params) => {
  return await api.get('/dailySiteReports', { params });
};

export const getById = async (id) => {
  return await api.get(`/dailySiteReports/${id}`);
};

export const create = async (data) => {
  return await api.post('/dailySiteReports', data);
};

export const update = async (id, data) => {
  return await api.put(`/dailySiteReports/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/dailySiteReports/${id}`);
};
