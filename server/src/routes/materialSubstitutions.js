const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const materialSubstitutionController = require('../controllers/materialSubstitutionController');

// List substitutions for a project
router.get('/', authenticate, authorize('projects:read'), materialSubstitutionController.getProjectSubstitutions);

// Propose a material substitution (shortage flagged)
router.post('/', authenticate, authorize('projects:update'), materialSubstitutionController.proposeSubstitution);

// Get detailed substitution request
router.get('/:id', authenticate, authorize('projects:read'), materialSubstitutionController.getSubstitution);

// Approve or reject the substitution request
router.put('/:id/respond', authenticate, authorize('projects:update'), materialSubstitutionController.respondToSubstitution);

module.exports = router;
