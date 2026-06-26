const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const leadController = require('../controllers/leadController');
const aiRateLimiter = require('../middleware/aiRateLimiter');

const router = express.Router();

router.post('/', authenticate, authorize('leads:create'), leadController.createLeadHandler);
router.get('/', authenticate, authorize('leads:read'), leadController.getLeadsHandler);
router.get('/stats', authenticate, authorize('leads:read'), leadController.getLeadStatsHandler);
router.post('/public', leadController.createPublicLeadHandler);
router.get('/check-duplicate', leadController.checkDuplicateHandler);

// Manager Dashboard Routes (must be defined before /:id)
const managerController = require('../controllers/managerController');
const requireRole = require('../middleware/requireRole');

router.get('/manager/sla-breaches', authenticate, requireRole(['manager', 'gm']), managerController.getSlaBreaches);
router.get('/manager/pipeline-movement', authenticate, requireRole(['manager', 'gm']), managerController.getPipelineMovement);
router.get('/manager/rep-capacity', authenticate, requireRole(['manager', 'gm']), managerController.getRepCapacity);
router.get('/manager/score-distribution', authenticate, requireRole(['manager', 'gm']), managerController.getScoreDistribution);
router.get('/manager/pending-approvals', authenticate, requireRole(['manager', 'gm']), managerController.getPendingApprovals);
router.get('/manager/scheduled-visits', authenticate, requireRole(['manager', 'gm']), managerController.getScheduledVisits);
router.get('/manager/predictive-revenue', authenticate, requireRole(['manager', 'gm']), managerController.getPredictiveRevenue);
router.get('/manager/heat-map', authenticate, requireRole(['manager', 'gm']), managerController.getHeatMapData);
router.post('/manager/approvals/:id/decide', authenticate, requireRole(['manager', 'gm']), managerController.decideApproval);

router.get('/export', authenticate, authorize('leads:read'), leadController.exportLeadsHandler);
router.post('/import', authenticate, authorize('leads:create'), leadController.importLeadsHandler);

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/:id', authenticate, authorize('leads:read'), leadController.getLeadByIdHandler);
router.patch('/:id', authenticate, authorize('leads:update'), leadController.updateLeadHandler);
router.delete('/:id', authenticate, authorize('leads:delete'), leadController.deleteLeadHandler);
router.post('/bulk/delete', authenticate, authorize('leads:delete'), leadController.bulkDeleteLeadsHandler);
router.post('/bulk/assign', authenticate, authorize('leads:update'), leadController.bulkAssignLeadsHandler);
router.post('/bulk/stage', authenticate, authorize('leads:update'), leadController.bulkChangeStageHandler);
router.post('/bulk/tag', authenticate, authorize('leads:update'), leadController.bulkTagHandler);
router.post('/merge', authenticate, authorize('leads:update'), leadController.mergeLeadsHandler);
router.post('/:id/stage', authenticate, authorize('leads:update'), leadController.changeStageHandler);
router.post('/:id/convert-to-project', authenticate, authorize('leads:update'), leadController.convertToProjectHandler);
router.post('/:id/activities', authenticate, leadController.logActivityHandler);
router.get('/:id/activities', authenticate, leadController.getActivitiesHandler);
router.patch('/:id/activities/:aid', authenticate, leadController.updateActivityHandler);
router.get('/:id/timeline', authenticate, leadController.getTimelineHandler);
router.get('/:id/automation-events', authenticate, authorize('leads:read'), leadController.getAutomationEventsHandler);

router.post('/:id/files', authenticate, authorize('leads:update'), upload.single('file'), leadController.uploadFileHandler);
router.get('/:id/files', authenticate, authorize('leads:read'), leadController.getFilesHandler);
router.delete('/:id/files/:fileId', authenticate, authorize('leads:update'), leadController.deleteFileHandler);
router.post('/:id/files/:fileId/parse', authenticate, authorize('leads:update'), leadController.parseFileHandler);

router.get('/:id/followups', authenticate, authorize('leads:read'), leadController.getFollowupsHandler);
router.post('/:id/followups', authenticate, authorize('leads:update'), leadController.createFollowupHandler);
router.patch('/:id/followups/:fid', authenticate, authorize('leads:update'), leadController.updateFollowupHandler);
router.delete('/:id/followups/:fid', authenticate, authorize('leads:update'), leadController.deleteFollowupHandler);

// Native Estimator Integration
router.post('/:id/estimates', authenticate, authorize('leads:update'), leadController.createNativeEstimateHandler);
router.get('/:id/estimates', authenticate, authorize('leads:read'), leadController.getEstimatesHandler);
router.post('/:id/estimates/sync', authenticate, authorize('leads:update'), leadController.syncEstimatesHandler);
router.post('/:id/estimates/webhook', leadController.estimatorWebhookHandler);

// Lead Measurements Integration
router.post('/:id/measurements', authenticate, authorize('leads:update'), leadController.captureMeasurementHandler);
router.get('/:id/measurements', authenticate, authorize('leads:read'), leadController.getMeasurementsHandler);

// Multi-Contact Management
router.get('/:id/contacts', authenticate, authorize('leads:read'), leadController.getContactsHandler);
router.post('/:id/contacts', authenticate, authorize('leads:update'), leadController.createContactHandler);
router.patch('/:id/contacts/:cid', authenticate, authorize('leads:update'), leadController.updateContactHandler);
router.delete('/:id/contacts/:cid', authenticate, authorize('leads:update'), leadController.deleteContactHandler);

// Communications Hub
router.get('/:id/communications', authenticate, authorize('leads:read'), leadController.getCommunicationsHandler);
router.post('/:id/communications', authenticate, authorize('leads:update'), leadController.createCommunicationHandler);
router.post('/:id/communications/draft', authenticate, authorize('leads:update'), leadController.draftCommunicationHandler);
router.post('/:id/communications/sync', authenticate, authorize('leads:update'), leadController.syncWhatsAppHandler);

// Inspiration Board
router.get('/:id/inspirations', authenticate, authorize('leads:read'), leadController.getInspirationsHandler);
router.post('/:id/inspirations', authenticate, authorize('leads:update'), leadController.createInspirationHandler);
router.delete('/:id/inspirations/:iid', authenticate, authorize('leads:update'), leadController.deleteInspirationHandler);

// AI Copilot & Planning
router.get('/:id/ai-insights', authenticate, authorize('leads:read'), leadController.getAiInsightsHandler);
router.post('/:id/ai-design-proposal', authenticate, authorize('leads:update'), aiRateLimiter, leadController.generateDesignProposalHandler);
router.post('/:id/meeting-summary', authenticate, authorize('leads:update'), aiRateLimiter, leadController.summarizeMeetingHandler);
router.patch('/:id/requirements', authenticate, authorize('leads:update'), leadController.updateRequirementsHandler);
router.post('/:id/budget-planner', authenticate, authorize('leads:read'), aiRateLimiter, leadController.getBudgetPlannerHandler);
router.post('/:id/sales-coach', authenticate, authorize('leads:update'), aiRateLimiter, leadController.salesCoachHandler);
router.post('/:id/knowledge-assistant', authenticate, authorize('leads:read'), aiRateLimiter, leadController.knowledgeAssistantHandler);
router.post('/:id/buying-intent', authenticate, authorize('leads:read'), aiRateLimiter, leadController.analyzeBuyingIntentHandler);
router.post('/:id/sentiment', authenticate, authorize('leads:read'), aiRateLimiter, leadController.analyzeSentimentHandler);

// Bottom of Funnel (Proposal & Negotiation)
router.post('/:id/generate-proposal', authenticate, authorize('leads:read'), leadController.generateProposalHandler);
router.get('/:id/proposals', authenticate, authorize('leads:read'), leadController.getProposalsHandler);
router.patch('/:id/negotiation', authenticate, authorize('leads:update'), leadController.updateNegotiationHandler);
router.patch('/:id/budget', authenticate, authorize('leads:update'), leadController.updateBudgetHandler);

// Add AI Persona Twin route
router.post('/:id/ai-twin', authenticate, aiRateLimiter, leadController.aiTwinHandler);

module.exports = router;
