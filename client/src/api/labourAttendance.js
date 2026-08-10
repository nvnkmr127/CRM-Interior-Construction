import api from './axios';

export const getAll = async (params) => {
  return await api.get('/labourAttendance', { params });
};

export const getById = async (id) => {
  return await api.get(`/labourAttendance/${id}`);
};

export const create = async (data) => {
  return await api.post('/labourAttendance', data);
};

export const update = async (id, data) => {
  return await api.put(`/labourAttendance/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/labourAttendance/${id}`);
};
