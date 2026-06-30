import api from './axios';

export const getWorkActivities = (projectId, params) => api.get(`/projects/${projectId}/work-activities`, { params });

export const getTemplates = (projectId, params) => api.get(`/projects/${projectId}/work-activities/templates`, { params });

export const createWorkActivity = (projectId, data) => api.post(`/projects/${projectId}/work-activities`, data);

export const generateWorkActivities = (projectId, data) => api.post(`/projects/${projectId}/work-activities/generate`, data);

export const updateWorkActivity = (projectId, id, data) => api.patch(`/projects/${projectId}/work-activities/${id}`, data);

export const deleteWorkActivity = (projectId, id) => api.delete(`/projects/${projectId}/work-activities/${id}`);

export const getWorkActivityDependencies = (projectId) => api.get(`/projects/${projectId}/work-activities/dependencies`);

export const createWorkActivityDependency = (projectId, data) => api.post(`/projects/${projectId}/work-activities/dependencies`, data);

export const deleteWorkActivityDependency = (projectId, id) => api.delete(`/projects/${projectId}/work-activities/dependencies/${id}`);

export const bulkUpdateWorkActivityDependencies = (projectId, data) => api.put(`/projects/${projectId}/work-activities/dependencies/bulk`, data);

export const uploadWorkActivityPhoto = (projectId, activityId, file, caption = '') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('caption', caption);
  return api.post(`/projects/${projectId}/work-activities/${activityId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const deleteWorkActivityPhoto = (projectId, activityId, photoId) => api.delete(`/projects/${projectId}/work-activities/${activityId}/photos/${photoId}`);
