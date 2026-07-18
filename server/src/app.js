const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const setupSwagger = require('./config/swagger');

const app = express();
setupSwagger(app);

// Initialize EventBus Subscribers
require('./services/notifications/notificationEventHandler');
require('./services/ai/aiEventHandler');
require('./services/projects/projectEventHandler');
require('./services/workflows/workflowEngine');
require('./services/timeline/timelineWriter');

// Removed periodic intervals. Jobs are now handled by BullMQ cronWorker.

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));

const { rateLimit, default: defaultRateLimit } = require('express-rate-limit');
const rateLimitFn = rateLimit || defaultRateLimit || require('express-rate-limit');
// Some versions of express-rate-limit export ipKeyGenerator or defaultKeyGenerator
// We will extract it safely if available to prevent IPv6 bypass warnings
// Usually it's exported as 'defaultKeyGenerator' in older versions, or 'ipKeyGenerator' in v7+
let ipGen = (req) => req.ip || 'unknown';
try {
  const erl = require('express-rate-limit');
  if (typeof erl.defaultKeyGenerator === 'function') ipGen = erl.defaultKeyGenerator;
  if (typeof erl.ipKeyGenerator === 'function') ipGen = erl.ipKeyGenerator;
} catch (e) { /* ignore */ }

const isDev = process.env.NODE_ENV !== 'production';

// Abuse Detector for credential stuffing and recon
const abuseDetector = require('./middleware/abuseDetector');
app.use(abuseDetector);

// Global API rate limiter
const apiLimiter = rateLimitFn({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 5000 : 100, // High limit in dev to prevent 429s on hot reload
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  keyGenerator: (req, _res) => {
    // Use IP for auth routes to prevent credential stuffing
    if (req.originalUrl && req.originalUrl.startsWith('/api/auth')) {
      return ipGen(req, _res);
    }
    
    const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = require('jsonwebtoken').decode(token);
        if (decoded && decoded.tenantId && decoded.userId) {
          return `${decoded.tenantId}:${decoded.userId}`;
        }
      } catch (e) { /* ignore */ }
    }
    return ipGen(req, _res);
  },
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Stricter rate limiter for auth routes
const authLimiter = rateLimitFn({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 15, // High limit in dev
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/portal/auth', authLimiter);

// 20. Enterprise CORS Hardening
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:5173', 'https://crm.example.com'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    // Or strictly enforce whitelisted origins
    if (process.env.NODE_ENV === 'development' || !origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS Policy (Strict)'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const responseFormatter = require('./middleware/responseFormatter');
app.use(responseFormatter);


const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const configRoutes = require('./routes/config');
const projectsRoutes = require('./routes/projects');
const snagsRoutes = require('./routes/snags');
const paymentMilestonesRoutes = require('./routes/paymentMilestones');
const invoicesRoutes = require('./routes/invoices');
const financialsRoutes = require('./routes/financials');
const financialApprovalsRoutes = require('./routes/financialApprovals');
const handoverRoutes = require('./routes/handover');
const milestonesRoutes = require('./routes/milestones');
const globalTasksRoutes = require('./routes/globalTasks');
const analyticsRoutes = require('./routes/analytics');
const logsRoutes = require('./routes/logs');
const webhooksRoutes = require('./routes/webhooks');
const eventsRoutes = require('./routes/events');
const webhooksInboundRoutes = require('./routes/webhooks/inbound');
const portalAuthRoutes = require('./routes/portal/auth');
const portalProjectRoutes = require('./routes/portal/project');
const portalSnagsRoutes = require('./routes/portal/snags');
const portalHandoverRoutes = require('./routes/portal/handover');
const portalApprovalsRoutes = require('./routes/portal/approvals');
const portalBrandingRoutes = require('./routes/portal/branding');
const portalDesignAssetsRoutes = require('./routes/portal/designAssets');
const portalDesignReviewsRoutes = require('./routes/portal/designReviews');
const portalMaterialPalettesRoutes = require('./routes/portal/materialPalettes');
const portalChangeOrdersRoutes = require('./routes/portal/changeOrders');
const portalMaterialSubstitutionsRoutes = require('./routes/portal/materialSubstitutions');
const portalPunchListsRoutes = require('./routes/portal/punchLists');
const portalWarrantiesRoutes = require('./routes/portal/warranties');
const portalAmcsRoutes = require('./routes/portal/amcs');
const portalWarrantyClaimsRoutes = require('./routes/portal/warrantyClaims');
const serviceTicketsRoutes = require('./routes/serviceTickets');
const portalServiceTicketsRoutes = require('./routes/portal/serviceTickets');
const portalQuotationsRoutes = require('./routes/portal/quotations');


const usersRoutes = require('./routes/users');
const rolesRoutes = require('./routes/roles');
const dashboardRoutes = require('./routes/dashboard');
const errorHandler = require('./middleware/errorHandler');

const searchRouter = require('./routes/search');
const notificationsRouter = require('./routes/notifications');
const siteVisitRoutes = require('./routes/siteVisits');
const quotationRoutes = require('./routes/quotations');
const aiRoutes = require('./routes/ai');
const mobileRoutes = require('./routes/mobile');
const { auditMiddleware } = require('./middleware/auditLogger');

app.use(auditMiddleware);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth/sessions', require('./routes/sessions'));
app.use('/api/auth/webauthn', require('./routes/webauthn'));
app.use('/api/auth/mfa', require('./routes/mfa'));
app.use('/api/auth', authRoutes);
app.use('/api/leads/manager', require('./routes/manager'));
app.use('/api/leads', leadsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/public-portal', require('./routes/portal'));
app.use('/api/projects', projectsRoutes);
app.use('/api/warehouses', require('./routes/warehouses'));
app.use('/api/vendor-lead-times', require('./routes/vendorLeadTimes'));
app.use('/api/snags', snagsRoutes);
app.use('/api/projects/:id/snags', snagsRoutes);
app.use('/api/payment-milestones', paymentMilestonesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/financials', financialsRoutes);
app.use('/api/financial-approvals', financialApprovalsRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/audit-logs', require('./routes/auditLogs'));

// Safe fallback for local file downloads
app.get('/api/local-download', (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).send('Missing key');
  if (key.includes('..')) {
    return res.status(403).send('Invalid key');
  }
  const path = require('path');
  const fs = require('fs');
  const uploadsDir = path.resolve(__dirname, '../uploads');
  const filePath = path.resolve(uploadsDir, key);
  
  // Enterprise Security: Prevent absolute path traversal and directory escape
  if (!filePath.startsWith(uploadsDir)) {
    return res.status(403).send('Invalid file path');
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  const ext = path.extname(key).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.pdf') contentType = 'application/pdf';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  res.setHeader('Content-Type', contentType);
  return res.download(filePath);
});
app.use('/api/projects/:id/handover', handoverRoutes);
app.use('/api/phases/:phaseId/milestones', milestonesRoutes);
app.use('/api/tasks', globalTasksRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/webhooks/inbound', webhooksInboundRoutes);
app.use('/api/portal/auth', portalAuthRoutes);
app.use('/api/portal/project', portalProjectRoutes);
app.use('/api/portal/snags', portalSnagsRoutes);
app.use('/api/portal/handover', portalHandoverRoutes);
app.use('/api/portal/approvals', portalApprovalsRoutes);
app.use('/api/portal/branding', portalBrandingRoutes);
app.use('/api/portal/design-assets', portalDesignAssetsRoutes);
app.use('/api/portal/design-reviews', portalDesignReviewsRoutes);
app.use('/api/portal/material-palettes', portalMaterialPalettesRoutes);
app.use('/api/portal/change-orders', portalChangeOrdersRoutes);
app.use('/api/portal/material-substitutions', portalMaterialSubstitutionsRoutes);
app.use('/api/portal/punch-lists', portalPunchListsRoutes);
app.use('/api/portal/warranties', portalWarrantiesRoutes);
app.use('/api/portal/amcs', portalAmcsRoutes);
app.use('/api/portal/warranty-claims', portalWarrantyClaimsRoutes);
app.use('/api/projects/:projectId/service-tickets', serviceTicketsRoutes);
app.use('/api/portal/service-tickets', portalServiceTicketsRoutes);
app.use('/api/portal/quotations', portalQuotationsRoutes);



app.use('/api/search', searchRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/site-visits', siteVisitRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/communications', require('./routes/communications'));
app.use('/api/views', require('./routes/views'));
app.use('/api/sequences', require('./routes/sequences'));
app.use('/api/automation', require('./routes/automation'));
app.use('/api/partners', require('./routes/partners'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/ai', aiRoutes);
app.use('/api/mobile', mobileRoutes);

require('./routes/qc')(app);

// Error handler MUST be the last middleware
app.use(errorHandler);

module.exports = app;
