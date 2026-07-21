import api from './axios';

export const getForms = async () => {
  const res = await api.get('/lead-forms');
  return res.data;
};

export const getFormById = async (id) => {
  const res = await api.get(`/lead-forms/${id}`);
  return res.data;
};

export const createForm = async (data) => {
  const res = await api.post('/lead-forms', data);
  return res.data;
};

export const updateForm = async (id, data) => {
  const res = await api.put(`/lead-forms/${id}`, data);
  return res.data;
};

export const deleteForm = async (id) => {
  const res = await api.delete(`/lead-forms/${id}`);
  return res.data;
};

export const getFormSubmissions = async (id) => {
  const res = await api.get(`/lead-forms/${id}/submissions`);
  return res.data;
};

export const getPublicFormBySlug = async (slug) => {
  const res = await api.get(`/public/forms/${slug}`);
  return res.data;
};

export const submitPublicForm = async (slug, data) => {
  const res = await api.post(`/public/forms/${slug}/submit`, data);
  return res.data;
};
