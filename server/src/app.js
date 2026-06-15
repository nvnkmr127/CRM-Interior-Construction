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
const analyticsRoutes = require('./routes/analytics');
const logsRoutes = require('./routes/logs');
const webhooksRoutes = require('./routes/webhooks');
const webhooksInboundRoutes = require('./routes/webhooks/inbound');
const errorHandler = require('./middleware/errorHandler');

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/webhooks/inbound', webhooksInboundRoutes);

// Error handler MUST be the last middleware
app.use(errorHandler);

module.exports = app;
