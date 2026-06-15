const express = require('express');
const { success, fail, paginate } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const taskRepository = require('../repositories/taskRepository');

const router = express.Router();
router.use(authenticate);

// GET /api/tasks
router.get('/', async (req, res, next) => {
  try {
    let { assigneeId, status, priority, dueWithin, page, limit } = req.query;
    
    // For "My Tasks", assigneeId is 'me'. Replace it with the logged in user's ID.
    if (assigneeId === 'me') {
      assigneeId = req.user.userId;
    }

    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 50;

    const result = await taskRepository.findTasks(req.tenantId, {
      projectId: null, // Global query, ignore specific project
      assigneeId,
      status,
      priority,
      dueWithin,
      page: parsedPage,
      limit: parsedLimit
    });

    return paginate(res, result.data, result.total, result.page, result.limit);
  } catch (err) {
    console.error('[Global Tasks Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch global tasks.', 500);
  }
});

module.exports = router;
