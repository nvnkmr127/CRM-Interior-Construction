const express = require('express');
const qcController = require('../controllers/qcController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
// Routes without projectId prefix (mounted directly on /api/v1/qc/templates)
// We will mount this separately if needed, or handle it via a different router
// Let's assume we mount this router on /api/v1
// We need to differentiate /api/v1/qc/templates vs /api/v1/projects/:projectId/qc

module.exports = function(app) {
  // Global templates route
  app.get('/api/qc/templates', authenticate, authorize('projects:read'), qcController.getTemplates);
  app.get('/api/v1/qc/templates', authenticate, authorize('projects:read'), qcController.getTemplates);
  
  // Project-specific QC routes
  app.get('/api/projects/:projectId/qc', authenticate, authorize('projects:read'), qcController.getProjectQcStages);
  app.post('/api/projects/:projectId/qc', authenticate, authorize('projects:write'), qcController.initializeQcStage);
  app.put('/api/projects/:projectId/qc/:stageId/items/:itemId', authenticate, authorize('projects:write'), qcController.updateChecklistItem);
  app.post('/api/projects/:projectId/qc/:stageId/sign-off', authenticate, authorize('projects:write'), qcController.signOffStage);

  app.get('/api/v1/projects/:projectId/qc', authenticate, authorize('projects:read'), qcController.getProjectQcStages);
  app.post('/api/v1/projects/:projectId/qc', authenticate, authorize('projects:write'), qcController.initializeQcStage);
  app.put('/api/v1/projects/:projectId/qc/:stageId/items/:itemId', authenticate, authorize('projects:write'), qcController.updateChecklistItem);
  app.post('/api/v1/projects/:projectId/qc/:stageId/sign-off', authenticate, authorize('projects:write'), qcController.signOffStage);
};
