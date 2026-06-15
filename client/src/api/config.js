import api from './axios';

export const configApi = {
  getCustomFields: (entity) => api.get(`/config/custom-fields?entity=${entity}`),
  createCustomField: (data) => api.post('/config/custom-fields', data),
  updateCustomField: (id, data) => api.put(`/config/custom-fields/${id}`, data),
  deleteCustomField: (id) => api.delete(`/config/custom-fields/${id}`),

  // Project Templates
  getTemplates: () => api.get('/config/project-templates'),
  createTemplate: (data) => api.post('/config/project-templates', data),
  updateTemplate: (id, data) => api.put(`/config/project-templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/config/project-templates/${id}`)
};
