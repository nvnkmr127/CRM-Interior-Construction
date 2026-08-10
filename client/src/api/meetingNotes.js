import api from './axios';

export const getAll = async (params) => {
  return await api.get('/meetingNotes', { params });
};

export const getById = async (id) => {
  return await api.get(`/meetingNotes/${id}`);
};

export const create = async (data) => {
  return await api.post('/meetingNotes', data);
};

export const update = async (id, data) => {
  return await api.put(`/meetingNotes/${id}`, data);
};

export const remove = async (id) => {
  return await api.delete(`/meetingNotes/${id}`);
};
