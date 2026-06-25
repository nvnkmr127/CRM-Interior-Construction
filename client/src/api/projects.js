import api from './axios';

export const getProjects = (params) => api.get('/projects', { params });

export const getProject = (id) => api.get(`/projects/${id}`);

export const createProject = (data) => api.post('/projects', data);

export const updateProject = (id, data) => api.patch(`/projects/${id}`, data);

export const deleteProject = (id) => api.delete(`/projects/${id}`);

export const applyTemplate = (id, templateId) => api.post(`/projects/${id}/apply-template`, { templateId });

// Phases
export const getPhases = (projectId) => api.get(`/projects/${projectId}/phases`);

export const createPhase = (projectId, data) => api.post(`/projects/${projectId}/phases`, data);

export const signOffPhase = (projectId, phaseId) => api.post(`/projects/${projectId}/phases/${phaseId}/sign-off`);

// Milestones
export const getMilestones = (phaseId) => api.get(`/phases/${phaseId}/milestones`);

export const completeMilestone = (phaseId, mid) => api.post(`/phases/${phaseId}/milestones/${mid}/complete`);

// Tasks
export const getTasks = (projectId, params) => api.get(`/projects/${projectId}/tasks`, { params });

export const createTask = (projectId, data) => api.post(`/projects/${projectId}/tasks`, data);

export const updateTask = (projectId, tid, data) => api.patch(`/projects/${projectId}/tasks/${tid}`, data);

export const deleteTask = (projectId, tid) => api.delete(`/projects/${projectId}/tasks/${tid}`);

export const bulkCreateTasks = (projectId, tasks) => api.post(`/projects/${projectId}/tasks/bulk`, { tasks });

// Documents
export const getDocuments = (projectId, params) => api.get(`/projects/${projectId}/documents`, { params });

export const getUploadUrl = (projectId, data) => api.post(`/projects/${projectId}/documents/upload-url`, data);

export const getContractUploadUrl = (data) => api.post('/projects/contract/upload-url', data);

export const registerDocument = (projectId, data) => api.post(`/projects/${projectId}/documents/register`, data);

export const approveDocument = (projectId, did) => api.post(`/projects/${projectId}/documents/${did}/approve`);

export const getDocumentUrl = (projectId, did) => api.get(`/projects/${projectId}/documents/${did}/url`);

export const requestRevision = (projectId, did, note) => api.post(`/projects/${projectId}/documents/${did}/revision`, { note });

export const addVersion = (projectId, did, storageKey) => api.post(`/projects/${projectId}/documents/${did}/version`, { storageKey });
