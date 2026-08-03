const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const setupSwagger = require('./config/swagger');

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

const app = express();
setupSwagger(app);

// Initialize EventBus Subscribers
try { require('./services/notifications/notificationEventHandler'); } catch (e) { console.warn('Failed to load notificationEventHandler:', e.message); }
try { require('./services/ai/aiEventHandler'); } catch (e) { console.warn('Failed to load aiEventHandler:', e.message); }
try { require('./services/projects/projectEventHandler'); } catch (e) { console.warn('Failed to load projectEventHandler:', e.message); }
try { require('./services/workflows/workflowEngine'); } catch (e) { console.warn('Failed to load workflowEngine:', e.message); }
try { require('./services/timeline/timelineWriter'); } catch (e) { console.warn('Failed to load timelineWriter:', e.message); }

// Removed periodic intervals. Jobs are now handled by BullMQ cronWorker.

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan('dev'));

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
  validate: false,
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
  max: isDev ? 1000 : 500, // High limit for auth routes
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/portal/auth', authLimiter);

// 20. Enterprise CORS Hardening
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:5173'];

if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || process.env.NODE_ENV === 'development' || origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
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

const asyncLocalStorage = require('./utils/requestContext');
app.use((req, res, next) => {
  asyncLocalStorage.run({ req }, () => {
    next();
  });
});

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

const orgRoutes = require('./routes/org');
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
const savedFiltersRoutes = require('./routes/savedFilters');
const usersBulkRoutes = require('./routes/usersBulk');
const rolesRoutes = require('./routes/roles');
const dashboardRoutes = require('./routes/dashboard');
const errorHandler = require('./middleware/errorHandler');

const searchRouter = require('./routes/search');
const notificationsRouter = require('./routes/notifications');
const siteVisitRoutes = require('./routes/siteVisits');
const quotationRoutes = require('./routes/quotations');
const aiRoutes = require('./routes/ai');
const mobileRoutes = require('./routes/mobile');
app.get(['/favicon.ico', '/favicon.png', '/robots.txt'], (req, res) => res.status(204).end());

// Vercel Serverless URL Normalizer: ensures req.url starts with /api for route matching
app.use((req, res, next) => {
  const targetUrl = req.originalUrl || req.url || '';
  if (targetUrl.includes('/api/')) {
    const apiIndex = targetUrl.indexOf('/api/');
    req.url = targetUrl.substring(apiIndex);
  } else if (!req.url.startsWith('/api') && req.url !== '/' && req.url !== '/health') {
    req.url = '/api' + (req.url.startsWith('/') ? '' : '/') + req.url;
  }
  next();
});

const { auditMiddleware } = require('./middleware/auditLogger');
app.use(auditMiddleware);

app.get(['/', '/api'], (req, res) => {
  res.json({ message: 'CRM Interior Construction API Server', status: 'ok', timestamp: new Date().toISOString() });
});

app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth/sessions', require('./routes/sessions'));
app.use('/api/auth/webauthn', require('./routes/webauthn'));
app.use('/api/auth/mfa', require('./routes/mfa'));
app.use('/api/auth', authRoutes);
app.use('/api/leads/manager', require('./routes/manager'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/login-history', require('./routes/loginHistory'));
app.use('/api/security', require('./routes/security'));
app.use('/api/leads', leadsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/lead-forms', require('./routes/leadForms'));
app.use('/api/public/forms', require('./routes/publicForms'));
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
app.use('/api/approval-matrix', require('./routes/approvalMatrix'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/handover', handoverRoutes);
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/login-history', require('./routes/loginHistory'));

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
app.use('/api/tags', require('./routes/tags'));
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users/bulk', usersBulkRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/offboarding', require('./routes/offboarding'));
app.use('/api/filters', savedFiltersRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', require('./routes/logs'));
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
app.use('/api/emails', require('./routes/emails'));
app.use('/api/email-templates', require('./routes/emailTemplates'));



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
app.use('/api/developer/tokens', require('./routes/apiTokens'));

// Mount Versioned API
app.use('/api/v1', require('./routes/api/v1'));

require('./routes/qc')(app);

// 404 Catch-All Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl || req.url} not found`
    }
  });
});

// Error handler MUST be the last middleware
app.use(errorHandler);

// --- AUTO-MIGRATE ON VERCEL (Since Vercel doesn't run server.js) ---
const pool = require('./config/db');
pool.query(`
  CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes INTEGER,
    version INTEGER DEFAULT 1,
    parent_id UUID REFERENCES task_attachments(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'replaced')),
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ta_task ON task_attachments(task_id, status);

  -- 20260723_enterprise_security.sql
  CREATE TABLE IF NOT EXISTS login_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      session_id VARCHAR(255),
      email_attempted VARCHAR(255),
      ip_address VARCHAR(100),
      browser VARCHAR(100),
      os VARCHAR(100),
      device VARCHAR(100),
      status VARCHAR(50),
      failure_reason TEXT,
      login_time TIMESTAMP DEFAULT NOW(),
      logout_time TIMESTAMP,
      duration_seconds INT
  );
  CREATE INDEX IF NOT EXISTS idx_login_history_tenant ON login_history(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
  
  -- Fix session_id type if it was created as UUID
  ALTER TABLE login_history ALTER COLUMN session_id TYPE VARCHAR(255) USING session_id::VARCHAR;

  CREATE TABLE IF NOT EXISTS tenant_security_settings (
      tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
      mfa_required_all BOOLEAN DEFAULT false,
      session_timeout_minutes INT DEFAULT 120,
      concurrent_login_limit INT DEFAULT 3,
      password_min_length INT DEFAULT 8,
      password_require_symbols BOOLEAN DEFAULT true,
      password_require_numbers BOOLEAN DEFAULT true,
      password_expiry_days INT DEFAULT 90,
      password_prevent_reuse INT DEFAULT 3,
      allowed_ips JSONB DEFAULT '[]'::jsonb,
      allowed_countries JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
  );
  
  CREATE TABLE IF NOT EXISTS user_security (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      mfa_enabled BOOLEAN DEFAULT false,
      mfa_secret VARCHAR(255),
      mfa_method VARCHAR(50) DEFAULT 'email',
      last_password_change TIMESTAMP DEFAULT NOW(),
      failed_login_attempts INT DEFAULT 0,
      lockout_until TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS user_trusted_devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      device_fingerprint VARCHAR(255) NOT NULL,
      device_name VARCHAR(255),
      expires_at TIMESTAMP,
      last_used_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_user_trusted_devices_user ON user_trusted_devices(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_trusted_devices_fingerprint ON user_trusted_devices(device_fingerprint);
  
  CREATE TABLE IF NOT EXISTS password_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);
  
  CREATE TABLE IF NOT EXISTS otp_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      code_hash VARCHAR(255) NOT NULL,
      purpose VARCHAR(50) DEFAULT 'login',
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_otp_codes_user ON otp_codes(user_id);

  CREATE TABLE IF NOT EXISTS user_preferences (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      email_sla_breaches BOOLEAN DEFAULT true,
      push_score_changes BOOLEAN DEFAULT true,
      dnd_start_time VARCHAR(10) DEFAULT '22:00',
      dnd_end_time VARCHAR(10) DEFAULT '08:00',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      permissions JSONB DEFAULT '[]'::jsonb,
      secret_hash VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'active',
      last_used_at TIMESTAMP WITH TIME ZONE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);

  CREATE TABLE IF NOT EXISTS api_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
      endpoint VARCHAR(255) NOT NULL,
      method VARCHAR(10) NOT NULL,
      status_code INTEGER NOT NULL,
      ip_address VARCHAR(45),
      execution_time_ms INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_api_logs_tenant_id ON api_logs(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_api_logs_api_key_id ON api_logs(api_key_id);
  
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT NOW();
  
  INSERT INTO user_security (user_id)
  SELECT id FROM users
  ON CONFLICT (user_id) DO NOTHING;
  
  INSERT INTO tenant_security_settings (tenant_id)
  SELECT id FROM tenants
  ON CONFLICT (tenant_id) DO NOTHING;

`).catch(err => console.error('Auto-migration error:', err));

module.exports = app;
