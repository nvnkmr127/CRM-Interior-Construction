import api from './axios';

export const getProjects = (params) => api.get('/projects', { params });

export const getProject = (id) => api.get(`/projects/${id}`);

export const createProject = (data) => api.post('/projects', data);

export const updateProject = (id, data) => api.patch(`/projects/${id}`, data);

export const deleteProject = (id) => api.delete(`/projects/${id}`);

export const previewCancellation = (id) => api.post(`/projects/${id}/cancel/preview`);
export const cancelProject = (id, data) => api.post(`/projects/${id}/cancel`, data);
export const acknowledgeCancellation = (id) => api.post(`/projects/${id}/acknowledge-cancellation`);


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

// Task Dependencies
export const getTaskDependencies = (projectId) => api.get(`/projects/${projectId}/task-dependencies`);

export const createTaskDependency = (projectId, data) => api.post(`/projects/${projectId}/task-dependencies`, data);

export const deleteTaskDependency = (projectId, id) => api.delete(`/projects/${projectId}/task-dependencies/${id}`);

// Daily Site Reports
export const getDailyReports = (projectId) => api.get(`/projects/${projectId}/daily-reports`);

export const getDailyReport = (projectId, id) => api.get(`/projects/${projectId}/daily-reports/${id}`);

export const submitDailyReport = (projectId, data) => api.post(`/projects/${projectId}/daily-reports`, data);

export const getRoomProgress = (projectId) => api.get(`/projects/${projectId}/room-progress`);

// Documents
export const getDocuments = (projectId, params) => api.get(`/projects/${projectId}/documents`, { params });

export const getUploadUrl = (projectId, data) => api.post(`/projects/${projectId}/documents/upload-url`, data);

export const getContractUploadUrl = (data) => api.post('/projects/contract/upload-url', data);

export const registerDocument = (projectId, data) => api.post(`/projects/${projectId}/documents/register`, data);

export const approveDocument = (projectId, did) => api.post(`/projects/${projectId}/documents/${did}/approve`);

export const getDocumentUrl = (projectId, did) => api.get(`/projects/${projectId}/documents/${did}/url`);

export const requestRevision = (projectId, did, note) => api.post(`/projects/${projectId}/documents/${did}/revision`, { note });

export const addVersion = (projectId, did, storageKey) => api.post(`/projects/${projectId}/documents/${did}/version`, { storageKey });

export const updateDocumentVisibility = (projectId, did, isVisibleToClient) => api.patch(`/projects/${projectId}/documents/${did}/visibility`, { isVisibleToClient });

export const getDocumentComments = (projectId, did) => api.get(`/projects/${projectId}/documents/${did}/comments`);

export const addDocumentComment = (projectId, did, comment) => api.post(`/projects/${projectId}/documents/${did}/comments`, { comment });

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

// Design Workflow
export const getDesignWorkflow = (projectId) => api.get(`/projects/${projectId}/design-workflow`);
export const transitionDesignWorkflow = (projectId, data) => api.post(`/projects/${projectId}/design-workflow/transition`, data);
export const confirmDesignWorkflow = (projectId, data) => api.post(`/projects/${projectId}/design-workflow/client-confirm`, data);

// Material Palettes
export const getMaterialPalettes = (projectId) => api.get(`/projects/${projectId}/material-palettes`);
export const getMaterialPaletteBOQItems = (projectId) => api.get(`/projects/${projectId}/material-palettes/boq-items`);
export const createMaterialPalette = (projectId, data) => api.post(`/projects/${projectId}/material-palettes`, data);
export const updateMaterialPalette = (projectId, id, data) => api.put(`/projects/${projectId}/material-palettes/${id}`, data);
export const deleteMaterialPalette = (projectId, id) => api.delete(`/projects/${projectId}/material-palettes/${id}`);

// Change Orders
export const getChangeOrders = (projectId) => api.get(`/projects/${projectId}/change-orders`);
export const createChangeOrder = (projectId, data) => api.post(`/projects/${projectId}/change-orders`, data);
export const updateChangeOrder = (projectId, id, data) => api.patch(`/projects/${projectId}/change-orders/${id}`, data);
export const deleteChangeOrder = (projectId, id) => api.delete(`/projects/${projectId}/change-orders/${id}`);

// BOQ Variance Reports
export const getBOQVarianceReport = (projectId) => api.get(`/projects/${projectId}/boq-variance`);
export const getPortfolioBOQVarianceReport = () => api.get('/projects/boq-variance');

// Quotations / BOQ
export const getQuotations = (projectId) => api.get(`/projects/${projectId}/quotations`);
export const getQuotation = (projectId, id) => api.get(`/projects/${projectId}/quotations/${id}`);
export const createQuotation = (projectId, data) => api.post(`/projects/${projectId}/quotations`, data);
export const addBOQItem = (projectId, id, data) => api.post(`/projects/${projectId}/quotations/${id}/items`, data);
export const updateBOQItem = (projectId, id, itemId, data) => api.put(`/projects/${projectId}/quotations/${id}/items/${itemId}`, data);
export const deleteBOQItem = (projectId, id, itemId) => api.delete(`/projects/${projectId}/quotations/${id}/items/${itemId}`);
export const reviseQuotation = (projectId, id, changeReason) => api.post(`/projects/${projectId}/quotations/${id}/revise`, { changeReason });
export const compareQuotations = (projectId, id, targetId) => api.get(`/projects/${projectId}/quotations/${id}/compare/${targetId}`);
export const sendQuotation = (projectId, id) => api.post(`/projects/${projectId}/quotations/${id}/send`);
export const acceptQuotation = (projectId, id) => api.post(`/projects/${projectId}/quotations/${id}/accept`);
export const rejectQuotation = (projectId, id) => api.post(`/projects/${projectId}/quotations/${id}/reject`);
export const updateQuotation = (projectId, id, data) => api.put(`/projects/${projectId}/quotations/${id}`, data);

// Budget Tracking
export const getBudgetSummary = (projectId) => api.get(`/projects/${projectId}/budget`);
export const updateBudgetAllocation = (projectId, data) => api.post(`/projects/${projectId}/budget`, data);
export const getExpenses = (projectId) => api.get(`/projects/${projectId}/budget/expenses`);
export const addExpense = (projectId, data) => api.post(`/projects/${projectId}/budget/expenses`, data);
export const deleteExpense = (projectId, expenseId) => api.delete(`/projects/${projectId}/budget/expenses/${expenseId}`);

// Purchase Orders
export const getPurchaseOrders = (projectId) => api.get(`/projects/${projectId}/purchase-orders`);
export const getPurchaseOrder = (projectId, id) => api.get(`/projects/${projectId}/purchase-orders/${id}`);
export const createPurchaseOrder = (projectId, data) => api.post(`/projects/${projectId}/purchase-orders`, data);
export const updatePurchaseOrder = (projectId, id, data) => api.put(`/projects/${projectId}/purchase-orders/${id}`, data);
export const updatePOItemReceipt = (projectId, id, itemId, data) => api.put(`/projects/${projectId}/purchase-orders/${id}/items/${itemId}/receipt`, data);

// Purchase Requests
export const getPurchaseRequests = (projectId) => api.get(`/projects/${projectId}/purchase-requests`);
export const getPurchaseRequest = (projectId, id) => api.get(`/projects/${projectId}/purchase-requests/${id}`);
export const createPurchaseRequest = (projectId, data) => api.post(`/projects/${projectId}/purchase-requests`, data);
export const updatePurchaseRequest = (projectId, id, data) => api.put(`/projects/${projectId}/purchase-requests/${id}`, data);
export const convertPRToPO = (projectId, id, data) => api.post(`/projects/${projectId}/purchase-requests/${id}/convert`, data);

// Material Deliveries
export const getMaterialDeliveries = (projectId) => api.get(`/projects/${projectId}/material-deliveries`);
export const getMaterialDelivery = (projectId, id) => api.get(`/projects/${projectId}/material-deliveries/${id}`);
export const createMaterialDelivery = (projectId, data) => api.post(`/projects/${projectId}/material-deliveries`, data);
export const updateMaterialDelivery = (projectId, id, data) => api.put(`/projects/${projectId}/material-deliveries/${id}`, data);

// Vendor Payments
export const getVendorPayments = (projectId) => api.get(`/projects/${projectId}/vendor-payments`);
export const getVendorPayment = (projectId, id) => api.get(`/projects/${projectId}/vendor-payments/${id}`);
export const createVendorPayment = (projectId, data) => api.post(`/projects/${projectId}/vendor-payments`, data);
export const updateVendorPayment = (projectId, id, data) => api.put(`/projects/${projectId}/vendor-payments/${id}`, data);
export const deleteVendorPayment = (projectId, id) => api.delete(`/projects/${projectId}/vendor-payments/${id}`);

// Material Substitutions
export const getSubstitutions = (projectId) => api.get(`/projects/${projectId}/material-substitutions`);
export const getSubstitution = (projectId, id) => api.get(`/projects/${projectId}/material-substitutions/${id}`);
export const proposeSubstitution = (projectId, data) => api.post(`/projects/${projectId}/material-substitutions`, data);
export const respondToSubstitution = (projectId, id, data) => api.put(`/projects/${projectId}/material-substitutions/${id}/respond`, data);

// Production Orders
export const getProductionOrders = (projectId) => api.get(`/projects/${projectId}/production-orders`);
export const getProductionOrder = (projectId, id) => api.get(`/projects/${projectId}/production-orders/${id}`);
export const createProductionOrder = (projectId, data) => api.post(`/projects/${projectId}/production-orders`, data);
export const updateProductionOrder = (projectId, id, data) => api.put(`/projects/${projectId}/production-orders/${id}`, data);
export const updateProductionOrderItem = (projectId, id, itemId, data) => api.put(`/projects/${projectId}/production-orders/${id}/items/${itemId}`, data);
export const recordQCInspection = (projectId, orderId, itemId, data) => api.post(`/projects/${projectId}/production-orders/${orderId}/items/${itemId}/qc`, data);
export const createReworkOrder = (projectId, orderId, itemId, data) => api.post(`/projects/${projectId}/production-orders/${orderId}/items/${itemId}/rework`, data);
export const updateReworkOrderStatus = (projectId, orderId, reworkId, data) => api.put(`/projects/${projectId}/production-orders/${orderId}/rework/${reworkId}`, data);
export const clearOrderForDispatch = (projectId, orderId) => api.post(`/projects/${projectId}/production-orders/${orderId}/clear-dispatch`);
export const getQCAndReworkSummary = (projectId, orderId) => api.get(`/projects/${projectId}/production-orders/${orderId}/qc-rework-summary`);
export const dispatchProductionOrder = (projectId, orderId, data) => api.post(`/projects/${projectId}/production-orders/${orderId}/dispatch`, data);
export const confirmSiteDelivery = (projectId, orderId, dispatchId, data) => api.put(`/projects/${projectId}/production-orders/${orderId}/dispatch/${dispatchId}/receipt`, data);
export const getDispatchRecords = (projectId, orderId) => api.get(`/projects/${projectId}/production-orders/${orderId}/dispatch`);
export const createTransitDamageReport = (projectId, orderId, dispatchId, itemId, data) => api.post(`/projects/${projectId}/production-orders/${orderId}/dispatch/${dispatchId}/items/${itemId}/damage`, data);
export const initiateReplacementOrder = (projectId, orderId, damageId) => api.post(`/projects/${projectId}/production-orders/${orderId}/damage/${damageId}/replacement`);
export const updateTransitDamageStatus = (projectId, orderId, damageId, data) => api.put(`/projects/${projectId}/production-orders/${orderId}/damage/${damageId}`, data);
export const getTransitDamageRecords = (projectId, orderId) => api.get(`/projects/${projectId}/production-orders/${orderId}/damage`);

export const bulkUpdateTasks = (projectId, tasks) => api.patch(`/projects/${projectId}/tasks/bulk-update`, { tasks });
export const bulkUpdateTaskDependencies = (projectId, dependencies) => api.put(`/projects/${projectId}/task-dependencies/bulk`, { dependencies });

export const getScheduleRevisions = (projectId) => api.get(`/projects/${projectId}/schedule-revisions`);

// Resource Replacement
export const replaceProjectResource = (projectId, data) => api.post(`/projects/${projectId}/replace-resource`, data);
export const getProjectHandovers = (projectId) => api.get(`/projects/${projectId}/handovers`);

// Drawing Register
export const getDrawingRegister = (projectId) => api.get(`/projects/${projectId}/drawing-register`);
export const createDrawingRegisterEntry = (projectId, data) => api.post(`/projects/${projectId}/drawing-register`, data);
export const updateDrawingRegisterEntry = (projectId, id, data) => api.put(`/projects/${projectId}/drawing-register/${id}`, data);
export const deleteDrawingRegisterEntry = (projectId, id) => api.delete(`/projects/${projectId}/drawing-register/${id}`);
export const approveDrawingRegisterClient = (projectId, id, data) => api.post(`/projects/${projectId}/drawing-register/${id}/client-approve`, data);
export const requestDrawingRegisterClientRevision = (projectId, id, data) => api.post(`/projects/${projectId}/drawing-register/${id}/client-revision`, data);
export const approveDrawingRegisterContractor = (projectId, id, data) => api.post(`/projects/${projectId}/drawing-register/${id}/contractor-approve`, data);
export const requestDrawingRegisterContractorRevision = (projectId, id, data) => api.post(`/projects/${projectId}/drawing-register/${id}/contractor-revision`, data);

// MEP Checklist
export const getMepChecklist = (projectId) => api.get(`/projects/${projectId}/mep-checklist`);
export const updateMepChecklistItem = (projectId, itemId, data) => api.patch(`/projects/${projectId}/mep-checklist/${itemId}`, data);

// Project Closure Checklist
export const getClosureChecklist = (projectId) => api.get(`/projects/${projectId}/closure-checklist`);
export const updateClosureChecklist = (projectId, data) => api.patch(`/projects/${projectId}/closure-checklist`, data);

// Project Retrospective
export const getRetrospective = (projectId) => api.get(`/projects/${projectId}/retrospective`);
export const saveRetrospective = (projectId, data) => api.post(`/projects/${projectId}/retrospective`, data);

// Project Archive & Reopen & Pause/Resume
export const archiveProject = (projectId) => api.post(`/projects/${projectId}/archive`);
export const reopenProject = (projectId, data) => api.post(`/projects/${projectId}/reopen`, data);
export const pauseProject = (projectId, data) => api.post(`/projects/${projectId}/pause`, data);
export const resumeProject = (projectId, data) => api.post(`/projects/${projectId}/resume`, data);

// Project Booking Confirmation
export const getProjectBooking = (projectId) => api.get(`/projects/${projectId}/booking`);
export const confirmProjectBooking = (projectId, data) => api.post(`/projects/${projectId}/booking`, data);

// Project Commercial Approval
export const getCommercialApprovalChecklist = (projectId) => api.get(`/projects/${projectId}/commercial-approval`);
export const confirmCommercialApproval = (projectId, data) => api.post(`/projects/${projectId}/commercial-approval`, data);

// Project Production-Site Coordination
export const getProjectCoordination = (projectId) => api.get(`/projects/${projectId}/coordination`);
export const updateProjectCoordination = (projectId, data) => api.patch(`/projects/${projectId}/coordination`, data);
export const getCoordinationDashboard = () => api.get('/projects/coordination/dashboard');
export const getVendorCoordination = (projectId) => api.get(`/projects/${projectId}/vendor-coordination`).then(r => r.data.data);

// Global Factory Production Orders & CNC Requests
export const getGlobalProductionOrders = (params) => api.get('/projects/factory/production-orders', { params });
export const getGlobalCNCRequests = () => api.get('/projects/factory/cnc-requests');
export const getCNCRequests = (projectId, orderId) => api.get(`/projects/${projectId}/production-orders/${orderId}/cnc-requests`);
export const createCNCRequest = (projectId, orderId, data) => api.post(`/projects/${projectId}/production-orders/${orderId}/cnc-requests`, data);
export const updateCNCRequestStatus = (projectId, orderId, requestId, data) => api.put(`/projects/${projectId}/production-orders/${orderId}/cnc-requests/${requestId}`, data);
export const getCuttingList = (projectId, orderId, itemId) => api.get(`/projects/${projectId}/production-orders/${orderId}/items/${itemId}/cutting-list`);
export const saveCuttingList = (projectId, orderId, itemId, data) => api.post(`/projects/${projectId}/production-orders/${orderId}/items/${itemId}/cutting-list`, data);

// External Inspections
export const getExternalInspections = (projectId) => api.get(`/projects/${projectId}/external-inspections`).then(r => r.data.data);
export const createExternalInspection = (projectId, data) => api.post(`/projects/${projectId}/external-inspections`, data).then(r => r.data.data);
export const updateExternalInspection = (projectId, id, data) => api.patch(`/projects/${projectId}/external-inspections/${id}`, data).then(r => r.data.data);
export const deleteExternalInspection = (projectId, id) => api.delete(`/projects/${projectId}/external-inspections/${id}`).then(r => r.data.data);

// Project Profitability
export const getProjectProfitability = (projectId) => api.get(`/projects/${projectId}/profitability`).then(r => r.data.data);
export const getProjectLedger = (projectId) => api.get(`/projects/${projectId}/ledger`).then(r => r.data.data);


// Vendor Defaults & Recovery
export const markVendorDefault = (projectId, vendorId, data) => api.post(`/projects/${projectId}/vendors/${vendorId}/default`, data).then(r => r.data.data);
export const updateVendorRecovery = (projectId, vendorId, data) => api.patch(`/projects/${projectId}/vendors/${vendorId}/recovery`, data).then(r => r.data.data);

// Payment Escalations
export const getPaymentEscalations = (projectId) => api.get(`/projects/${projectId}/payment-escalations`).then(r => r.data.data);
export const triggerPaymentEscalation = (projectId, data) => api.post(`/projects/${projectId}/payment-escalations`, data).then(r => r.data.data);
export const resolvePaymentEscalation = (projectId, escalationId) => api.patch(`/projects/${projectId}/payment-escalations/${escalationId}/resolve`).then(r => r.data.data);


