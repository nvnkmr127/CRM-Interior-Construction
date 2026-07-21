const express = require('express');
const router = express.Router();
const projectsController = require('../../../controllers/v1/projectsController');
const { apiAuth } = require('../../../middlewares/apiAuth');
const apiLogger = require('../../../middlewares/apiLogger');

router.use(apiLogger);

router.get('/', apiAuth('Projects Read'), projectsController.listProjects);
router.get('/:id', apiAuth('Projects Read'), projectsController.getProject);
router.post('/', apiAuth('Projects Write'), projectsController.createProject);
router.put('/:id', apiAuth('Projects Write'), projectsController.updateProject);
router.delete('/:id', apiAuth('Projects Write'), projectsController.deleteProject);

module.exports = router;
