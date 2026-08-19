const express = require('express');
const router = express.Router();

// Auto-generated stub router to prevent 404 console errors for incomplete modules
const handleStub = (req, res) => {
  res.status(200).json({
    success: true,
    data: [], // Return empty array by default to satisfy .map() calls
    items: [],
    message: 'Stub response'
  });
};

router.use('/ai', handleStub);
router.use('/analytics', handleStub);
router.use('/approval-matrix', handleStub);
router.use('/approvals', handleStub);
router.use('/auditLogs', handleStub);
router.use('/auth', handleStub);
router.use('/automation', handleStub);
router.use('/baselineAssessment', handleStub);
router.use('/communications', handleStub);
router.use('/config/api-keys', handleStub);
router.use('/config/automations', handleStub);
router.use('/config/custom-fields', handleStub);
router.use('/config/lead-stages', handleStub);
router.use('/config/project-templates', handleStub);
router.use('/config/tenant-settings', handleStub);
router.use('/config/trade-activity-templates', handleStub);
router.use('/config/trade-dependency-templates', handleStub);
router.use('/config/webhooks', handleStub);
router.use('/designReviews', handleStub);
router.use('/developer', handleStub);
router.use('/emailTemplates', handleStub);
router.use('/emails', handleStub);
router.use('/events', handleStub);
router.use('/filters', handleStub);
router.use('/financialApprovals', handleStub);
router.use('/handover', handleStub);
router.use('/lead-forms', handleStub);
router.use('/leaves', handleStub);
router.use('/loginHistory', handleStub);
router.use('/logs', handleStub);
router.use('/manager', handleStub);
router.use('/materialUsages', handleStub);
router.use('/mfa', handleStub);
router.use('/mobile', handleStub);
router.use('/partners', handleStub);
router.use('/paymentEscalations', handleStub);
router.use('/phases', handleStub);
router.use('/portal', handleStub);
router.use('/projectClosures', handleStub);
router.use('/projectRetrospectives', handleStub);
router.use('/projects/:projectId/amcs', handleStub);
router.use('/projects/:projectId/budget', handleStub);
router.use('/projects/:projectId/delay-notifications', handleStub);
router.use('/projects/:projectId/design-assets', handleStub);
router.use('/projects/:projectId/design-reviews', handleStub);
router.use('/projects/:projectId/documents', handleStub);
router.use('/projects/:projectId/drawing-register', handleStub);
router.use('/projects/:projectId/handover', handleStub);
router.use('/projects/:projectId/material-deliveries', handleStub);
router.use('/projects/:projectId/material-palettes', handleStub);
router.use('/projects/:projectId/material-substitutions', handleStub);
router.use('/projects/:projectId/meeting-notes', handleStub);
router.use('/projects/:projectId/payment-escalations', handleStub);
router.use('/projects/:projectId/phases', handleStub);
router.use('/projects/:projectId/production-orders', handleStub);
router.use('/projects/:projectId/punch-lists', handleStub);
router.use('/projects/:projectId/purchase-orders', handleStub);
router.use('/projects/:projectId/purchase-requests', handleStub);
router.use('/projects/:projectId/qc', handleStub);
router.use('/projects/:projectId/quotations', handleStub);
router.use('/projects/:projectId/room-handovers', handleStub);
router.use('/projects/:projectId/service-tickets', handleStub);
router.use('/projects/:projectId/site-readiness', handleStub);
router.use('/projects/:projectId/task-dependencies', handleStub);
router.use('/projects/:projectId/tasks', handleStub);
router.use('/projects/:projectId/vendors', handleStub);
router.use('/projects/:projectId/work-activities', handleStub);
router.use('/public', handleStub);
router.use('/publicForms', handleStub);
router.use('/qc', handleStub);
router.use('/roomProgress', handleStub);
router.use('/security', handleStub);
router.use('/sequences', handleStub);
router.use('/site-visits', handleStub);
router.use('/siteExpenses', handleStub);
router.use('/siteVisits', handleStub);
router.use('/superadmin', handleStub);
router.use('/task-templates', handleStub);
router.use('/tasks', handleStub);
router.use('/users', handleStub);
router.use('/usersBulk', handleStub);
router.use('/warehouses', handleStub);
router.use('/webauthn', handleStub);

module.exports = router;
