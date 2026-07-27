const fs = require('fs');
let c = fs.readFileSync('client/src/pages/config/RolesManager.jsx', 'utf8');

const templatesStr = `const BUILT_IN_TEMPLATES = [
  { id: 'tmpl-1', name: 'Project Manager', category: 'built-in', description: 'Full access to projects, schedules, and team assignments.', permissions: ['projects:view', 'projects:create', 'projects:edit', 'projects:delete', 'milestones:view', 'milestones:create', 'milestones:edit'], enabled_modules: ['projects', 'milestones'], data_scopes: { projects: 'department' }, page_permissions: {}, field_permissions: {}, security_policies: {} },
  { id: 'tmpl-2', name: 'Site Supervisor', category: 'built-in', description: 'Access to daily site reports, tasks, and labour tracking.', permissions: ['dailySiteReports:view', 'dailySiteReports:create', 'dailySiteReports:edit', 'tasks:view', 'tasks:create', 'tasks:edit'], enabled_modules: ['dailySiteReports', 'tasks'], data_scopes: { dailySiteReports: 'own', tasks: 'own' }, page_permissions: {}, field_permissions: {}, security_policies: {} },
  { id: 'tmpl-3', name: 'Sales Representative', category: 'built-in', description: 'Manage leads, pipeline, and initial quotations.', permissions: ['leads:view', 'leads:create', 'leads:edit', 'quotations:view', 'quotations:create'], enabled_modules: ['leads', 'quotations'], data_scopes: { leads: 'own', quotations: 'own' }, page_permissions: {}, field_permissions: {}, security_policies: {} },
  { id: 'tmpl-4', name: 'Finance Controller', category: 'built-in', description: 'Global access to budgets, invoices, and financial reporting.', permissions: ['invoices:view', 'invoices:create', 'invoices:edit', 'invoices:approve', 'budget:view', 'budget:create', 'budget:edit'], enabled_modules: ['invoices', 'budget'], data_scopes: { invoices: 'global', budget: 'global' }, page_permissions: {}, field_permissions: {}, security_policies: {} },
  { id: 'tmpl-5', name: 'Quality Inspector', category: 'built-in', description: 'Access to punch lists, snags, and QC forms.', permissions: ['qc:view', 'qc:create', 'qc:edit', 'snags:view', 'snags:create', 'snags:edit'], enabled_modules: ['qc', 'snags'], data_scopes: { qc: 'department', snags: 'department' }, page_permissions: {}, field_permissions: {}, security_policies: {} }
];

export default function RolesManager() {`;

c = c.replace('export default function RolesManager() {', templatesStr);
c = c.replace('const [templates, setTemplates] = useState([])', 'const [templates, setTemplates] = useState(BUILT_IN_TEMPLATES)');

fs.writeFileSync('client/src/pages/config/RolesManager.jsx', c);
console.log('Injected templates');
