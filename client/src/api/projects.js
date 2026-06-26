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

// Design Requirements
export const getDesignRequirements = (projectId) => api.get(`/projects/${projectId}/design-requirements`);
export const updateDesignRequirements = (projectId, data) => api.put(`/projects/${projectId}/design-requirements`, data);

export const createRoomRequirement = (projectId, data) => api.post(`/projects/${projectId}/room-requirements`, data);
export const updateRoomRequirement = (projectId, id, data) => api.put(`/projects/${projectId}/room-requirements/${id}`, data);
export const deleteRoomRequirement = (projectId, id) => api.delete(`/projects/${projectId}/room-requirements/${id}`);

export const createProjectInspiration = (projectId, data) => api.post(`/projects/${projectId}/inspirations`, data);
export const deleteProjectInspiration = (projectId, id) => api.delete(`/projects/${projectId}/inspirations/${id}`);

// Design Assets
export const getDesignAssets = (projectId) => api.get(`/projects/${projectId}/design-assets`);
export const createDesignAsset = (projectId, data) => api.post(`/projects/${projectId}/design-assets`, data);
export const getDesignAsset = (projectId, id) => api.get(`/projects/${projectId}/design-assets/${id}`);
export const updateDesignAsset = (projectId, id, data) => api.put(`/projects/${projectId}/design-assets/${id}`, data);
export const deleteDesignAsset = (projectId, id) => api.delete(`/projects/${projectId}/design-assets/${id}`);
export const addDesignAssetItem = (projectId, id, data) => api.post(`/projects/${projectId}/design-assets/${id}/items`, data);
export const deleteDesignAssetItem = (projectId, id, itemId) => api.delete(`/projects/${projectId}/design-assets/${id}/items/${itemId}`);

// Design Reviews
export const getDesignReviewRounds = (projectId) => api.get(`/projects/${projectId}/design-reviews/rounds`);
export const createDesignReviewRound = (projectId, data) => api.post(`/projects/${projectId}/design-reviews/rounds`, data);
export const closeDesignReviewRound = (projectId, id) => api.post(`/projects/${projectId}/design-reviews/rounds/${id}/close`);
export const getDesignReviewDrawings = (projectId, params) => api.get(`/projects/${projectId}/design-reviews/drawings`, { params });
export const associateDrawingWithRound = (projectId, documentId, data) => api.put(`/projects/${projectId}/design-reviews/drawings/${documentId}`, data);
export const getDrawingComments = (projectId, documentId) => api.get(`/projects/${projectId}/design-reviews/drawings/${documentId}/comments`);
export const addDrawingComment = (projectId, documentId, comment) => api.post(`/projects/${projectId}/design-reviews/drawings/${documentId}/comments`, { comment });
export const freezeProjectDesign = (projectId) => api.post(`/projects/${projectId}/design-reviews/freeze-design`);

// Material Palettes
export const getMaterialPalettes = (projectId) => api.get(`/projects/${projectId}/material-palettes`);
export const createMaterialPalette = (projectId, data) => api.post(`/projects/${projectId}/material-palettes`, data);
export const updateMaterialPalette = (projectId, id, data) => api.put(`/projects/${projectId}/material-palettes/${id}`, data);
export const deleteMaterialPalette = (projectId, id) => api.delete(`/projects/${projectId}/material-palettes/${id}`);

// Change Orders
export const getChangeOrders = (projectId) => api.get(`/projects/${projectId}/change-orders`);
export const createChangeOrder = (projectId, data) => api.post(`/projects/${projectId}/change-orders`, data);
export const updateChangeOrder = (projectId, id, data) => api.patch(`/projects/${projectId}/change-orders/${id}`, data);
export const deleteChangeOrder = (projectId, id) => api.delete(`/projects/${projectId}/change-orders/${id}`);

// Quotations / BOQ
export const getQuotations = (projectId) => api.get(`/projects/${projectId}/quotations`);
export const getQuotation = (projectId, id) => api.get(`/projects/${projectId}/quotations/${id}`);
export const createQuotation = (projectId, data) => api.post(`/projects/${projectId}/quotations`, data);
export const addBOQItem = (projectId, id, data) => api.post(`/projects/${projectId}/quotations/${id}/items`, data);
export const updateBOQItem = (projectId, id, itemId, data) => api.put(`/projects/${projectId}/quotations/${id}/items/${itemId}`, data);
export const deleteBOQItem = (projectId, id, itemId) => api.delete(`/projects/${projectId}/quotations/${id}/items/${itemId}`);
export const reviseQuotation = (projectId, id, changeReason) => api.post(`/projects/${projectId}/quotations/${id}/revise`, { changeReason });
export const compareQuotations = (projectId, id, targetId) => api.get(`/projects/${projectId}/quotations/${id}/compare/${targetId}`);




