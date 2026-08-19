const fs = require('fs');
const path = require('path');

const clientSrcPath = path.join(__dirname, '../../client/src');
const serverRoutesPath = path.join(__dirname, '../src/routes');

const frontendEndpoints = new Set();
const backendRoutes = [];

function walkFrontend(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkFrontend(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.match(/api\.(get|post|put|delete|patch)\((['"`])(.*?)\2/g);
      if (matches) {
        matches.forEach(m => {
          const urlMatch = m.match(/api\.(?:get|post|put|delete|patch)\((['"`])(.*?)\1/);
          if (urlMatch && urlMatch[2]) {
            let cleanUrl = urlMatch[2].replace(/\$\{([^}]+)\}/g, ':$1');
            cleanUrl = cleanUrl.split('?')[0];
            frontendEndpoints.add(cleanUrl);
          }
        });
      }
    }
  }
}
walkFrontend(clientSrcPath);

const routePrefixes = {
  'auth.js': '/auth',
  'users.js': '/users',
  'roles.js': '/roles',
  'tenants.js': '/tenants',
  'organizations.js': '/organizations',
  'dashboard.js': '/dashboard',
  'leads.js': '/leads',
  'leadStages.js': '/lead-stages',
  'projects.js': '/projects',
  'tasks.js': '/tasks',
  'auditLogs.js': '/audit-logs',
  'templates.js': '/templates',
  'customFields.js': '/custom-fields',
  'automations.js': '/automations',
  'emails.js': '/emails',
  'emailTemplates.js': '/email-templates',
  'documents.js': '/documents',
  'comments.js': '/comments',
  'analytics.js': '/analytics',
  'vendorLeadTimes.js': '/vendor-lead-times',
  'tradeActivities.js': '/trade-activities',
  'qcChecklists.js': '/qc-checklists',
  'conversionChecklists.js': '/conversion-checklists',
  'apiKeys.js': '/api-keys',
  'logs.js': '/logs',
  'financialSettings.js': '/financial-settings',
  'financialApprovals.js': '/financial-approvals',
  'paymentMilestones.js': '/payment-milestones',
  'offboarding.js': '/offboarding',
  'loginHistory.js': '/login-history'
};

function getBackendRoutes() {
  const files = fs.readdirSync(serverRoutesPath);
  for (const file of files) {
    if (file.endsWith('.js')) {
      const fullPath = path.join(serverRoutesPath, file);
      const content = fs.readFileSync(fullPath, 'utf8');
      
      const prefix = routePrefixes[file] || `/${file.replace('.js', '')}`;
      
      const matches = content.match(/router\.(get|post|put|delete|patch)\((['"`])(.*?)\2/g);
      if (matches) {
        matches.forEach(m => {
          const urlMatch = m.match(/router\.(?:get|post|put|delete|patch)\((['"`])(.*?)\1/);
          if (urlMatch && urlMatch[2]) {
            let routePath = urlMatch[2];
            if (routePath === '/') routePath = '';
            backendRoutes.push(prefix + routePath);
          }
        });
      }
    }
  }
}
getBackendRoutes();

const missingEndpoints = [];
const allFrontend = Array.from(frontendEndpoints);

function matchRoute(frontendRoute, backendRoutes) {
  for (const backend of backendRoutes) {
    const frontParts = frontendRoute.split('/');
    const backParts = backend.split('/');
    
    if (frontParts.length === backParts.length) {
      let matches = true;
      for (let i = 0; i < frontParts.length; i++) {
        if (backParts[i].startsWith(':') || frontParts[i].startsWith(':')) {
          continue;
        }
        if (frontParts[i] !== backParts[i]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
  }
  return false;
}

for (const fe of allFrontend) {
  if (!matchRoute(fe, backendRoutes)) {
    missingEndpoints.push(fe);
  }
}

fs.writeFileSync(path.join(__dirname, 'missing.json'), JSON.stringify(missingEndpoints.sort(), null, 2));
