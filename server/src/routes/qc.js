const express = require('express');
const _router = express.Router({ mergeParams: true }); // mergeParams to get projectId from parent route
const qcController = require('../../controllers/qcController');

// Routes without projectId prefix (mounted directly on /api/v1/qc/templates)
// We will mount this separately if needed, or handle it via a different router
// Let's assume we mount this router on /api/v1
// We need to differentiate /api/v1/qc/templates vs /api/v1/projects/:projectId/qc

module.exports = function(app) {
  // Global templates route
  app.get('/api/v1/qc/templates', qcController.getTemplates);
  
  // Project-specific QC routes
  app.get('/api/v1/projects/:projectId/qc', qcController.getProjectQcStages);
  app.post('/api/v1/projects/:projectId/qc', qcController.initializeQcStage);
  app.put('/api/v1/projects/:projectId/qc/:stageId/items/:itemId', qcController.updateChecklistItem);
  app.post('/api/v1/projects/:projectId/qc/:stageId/sign-off', qcController.signOffStage);
};
