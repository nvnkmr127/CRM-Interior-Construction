const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const leadController = require('../controllers/leadController');

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
router.post('/:id/stage', authenticate, authorize('leads:update'), leadController.changeStageHandler);
router.post('/:id/convert-to-project', authenticate, authorize('leads:update'), leadController.convertToProjectHandler);
router.post('/:id/activities', authenticate, leadController.logActivityHandler);
router.get('/:id/activities', authenticate, leadController.getActivitiesHandler);

router.post('/:id/files', authenticate, authorize('leads:update'), upload.single('file'), leadController.uploadFileHandler);
router.get('/:id/files', authenticate, authorize('leads:read'), leadController.getFilesHandler);
router.delete('/:id/files/:fileId', authenticate, authorize('leads:update'), leadController.deleteFileHandler);
router.post('/:id/files/:fileId/parse', authenticate, authorize('leads:update'), leadController.parseFileHandler);

router.get('/:id/followups', authenticate, authorize('leads:read'), leadController.getFollowupsHandler);
router.post('/:id/followups', authenticate, authorize('leads:update'), leadController.createFollowupHandler);
router.patch('/:id/followups/:fid', authenticate, authorize('leads:update'), leadController.updateFollowupHandler);
router.delete('/:id/followups/:fid', authenticate, authorize('leads:update'), leadController.deleteFollowupHandler);

// Estimator App Integration
router.post('/:id/send-to-estimator', authenticate, authorize('leads:update'), leadController.sendToEstimatorHandler);
router.get('/:id/estimates', authenticate, authorize('leads:read'), leadController.getEstimatesHandler);
router.post('/:id/estimates/webhook', leadController.estimatorWebhookHandler);

// Multi-Contact Management
router.get('/:id/contacts', authenticate, authorize('leads:read'), leadController.getContactsHandler);
router.post('/:id/contacts', authenticate, authorize('leads:update'), leadController.createContactHandler);
router.delete('/:id/contacts/:cid', authenticate, authorize('leads:update'), leadController.deleteContactHandler);

// Inspiration Board
router.get('/:id/inspirations', authenticate, authorize('leads:read'), leadController.getInspirationsHandler);
router.post('/:id/inspirations', authenticate, authorize('leads:update'), leadController.createInspirationHandler);
router.delete('/:id/inspirations/:iid', authenticate, authorize('leads:update'), leadController.deleteInspirationHandler);

// AI Copilot
router.get('/:id/ai-insights', authenticate, authorize('leads:read'), leadController.getAiInsightsHandler);
router.post('/:id/ai-design-proposal', authenticate, authorize('leads:update'), leadController.generateDesignProposalHandler);
router.post('/:id/meeting-summary', authenticate, authorize('leads:update'), leadController.summarizeMeetingHandler);

// Add AI Persona Twin route
router.post('/:id/ai-twin', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt is required' });
    
    const responseText = await simulateLeadPersona(tenantId, req.params.id, prompt);
    return res.status(200).json({ success: true, data: { text: responseText } });
  } catch (error) {
    next(error);
  }
});

const { analyzeBuyingIntent, analyzeSentiment } = require('../services/aiService');

// Buying Intent route
router.post('/:id/buying-intent', authenticate, authorize('leads:read'), async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const intentData = await analyzeBuyingIntent(tenantId, req.params.id);
    return res.status(200).json({ success: true, data: intentData });
  } catch (error) {
    next(error);
  }
});

// Mood / Sentiment route
router.post('/:id/sentiment', authenticate, authorize('leads:read'), async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const sentimentData = await analyzeSentiment(tenantId, req.params.id);
    return res.status(200).json({ success: true, data: sentimentData });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
