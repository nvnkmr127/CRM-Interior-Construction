const express = require('express');
const router = express.Router();
const tasksController = require('../../../controllers/v1/tasksController');
const { apiAuth } = require('../../../middlewares/apiAuth');
const apiLogger = require('../../../middlewares/apiLogger');

router.use(apiLogger);

router.get('/', apiAuth('Tasks Read'), tasksController.listTasks);
router.get('/:id', apiAuth('Tasks Read'), tasksController.getTask);
router.post('/', apiAuth('Tasks Write'), tasksController.createTask);
router.put('/:id', apiAuth('Tasks Write'), tasksController.updateTask);
router.delete('/:id', apiAuth('Tasks Write'), tasksController.deleteTask);

module.exports = router;
