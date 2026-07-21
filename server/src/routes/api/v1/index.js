const express = require('express');
const router = express.Router();

const leadsRoutes = require('./leads');
const customersRoutes = require('./customers');
const projectsRoutes = require('./projects');
const tasksRoutes = require('./tasks');
const paymentsRoutes = require('./payments');
const quotationsRoutes = require('./quotations');

/**
 * @swagger
 * tags:
 *   - name: Leads
 *     description: API for managing Leads
 *   - name: Customers
 *     description: API for managing Customers
 *   - name: Projects
 *     description: API for managing Projects
 *   - name: Tasks
 *     description: API for managing Tasks
 *   - name: Payments
 *     description: API for managing Payments (Invoices)
 *   - name: Quotations
 *     description: API for managing Quotations
 */

router.use('/leads', leadsRoutes);
router.use('/customers', customersRoutes);
router.use('/projects', projectsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/payments', paymentsRoutes);
router.use('/quotations', quotationsRoutes);

module.exports = router;
