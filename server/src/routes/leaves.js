const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.use(authenticate);

// GET /api/leaves - All authenticated team members can view leave records / portal leaves
router.get('/', leaveController.getLeaves);

// GET /api/leaves/covering - Projects delegated to the current user for colleague coverage
router.get('/covering', leaveController.getCoveringLeaves);

const isUserAdmin = (user) => {
  if (!user) return false;
  const role = (user.role?.name || user.role || '').toLowerCase();
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  return role === 'admin' || role === 'superadmin' || role === 'owner' || role === 'super admin' || perms.includes('*') || perms.includes('*:*');
};

// GET /api/leaves/schedule - Team absence roster & calendar view (Restricted to Admin & Super Admin)
router.get('/schedule', (req, res, next) => {
  if (isUserAdmin(req.user)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden: Team schedule is only available for administrators' });
}, leaveController.getTeamSchedule);

// GET /api/leaves/project/:projectId - Active & planned colleague coverages for a project
router.get('/project/:projectId', leaveController.getProjectCoverages);

// GET /api/leaves/impact/:userId - Team members can check their own impact, or admins/PMs can check any member's impact
router.get('/impact/:userId', (req, res, next) => {
  if (req.user && (req.user.id === req.params.userId || isUserAdmin(req.user))) {
    return next();
  }
  return authorize('projects:view')(req, res, next);
}, leaveController.getLeaveImpact);

// POST /api/leaves - Any team member can request their own leave; admins can submit for any member
router.post('/', (req, res, next) => {
  if (req.user && (req.user.id === req.body.userId || isUserAdmin(req.user))) {
    return next();
  }
  return authorize('projects:write')(req, res, next);
}, leaveController.createLeave);

// DELETE /api/leaves/:id - Cancel an upcoming planned leave request
router.delete('/:id', leaveController.deleteLeave);

// PATCH /api/leaves/:id/status - Strictly restricted to Superadmin and Admin
router.patch('/:id/status', (req, res, next) => {
  if (isUserAdmin(req.user)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden: Only administrators can approve or reject leaves' });
}, leaveController.updateLeaveStatus);

module.exports = router;
