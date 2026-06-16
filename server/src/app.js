const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(morgan('dev'));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const configRoutes = require('./routes/config');
const projectsRoutes = require('./routes/projects');
const snagsRoutes = require('./routes/snags');
const paymentMilestonesRoutes = require('./routes/paymentMilestones');
const handoverRoutes = require('./routes/handover');
const milestonesRoutes = require('./routes/milestones');
const globalTasksRoutes = require('./routes/globalTasks');
const analyticsRoutes = require('./routes/analytics');
const logsRoutes = require('./routes/logs');
const webhooksRoutes = require('./routes/webhooks');
const webhooksInboundRoutes = require('./routes/webhooks/inbound');
const portalAuthRoutes = require('./routes/portal/auth');
const portalProjectRoutes = require('./routes/portal/project');
const portalSnagsRoutes = require('./routes/portal/snags');
const portalApprovalsRoutes = require('./routes/portal/approvals');
const portalBrandingRoutes = require('./routes/portal/branding');
const usersRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const errorHandler = require('./middleware/errorHandler');

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/snags', snagsRoutes);
app.use('/api/payment-milestones', paymentMilestonesRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/phases/:phaseId/milestones', milestonesRoutes);
app.use('/api/tasks', globalTasksRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/webhooks/inbound', webhooksInboundRoutes);
app.use('/api/portal/auth', portalAuthRoutes);
app.use('/api/portal/project', portalProjectRoutes);
app.use('/api/portal/snags', portalSnagsRoutes);
app.use('/api/portal/approvals', portalApprovalsRoutes);
app.use('/api/portal/branding', portalBrandingRoutes);

// Error handler MUST be the last middleware
app.use(errorHandler);

module.exports = app;
