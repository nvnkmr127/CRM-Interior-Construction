import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { useAuth } from '../../store/authContext';
import { useToast } from '../../store/toastContext';
import { Button, Input, Modal, Textarea, Checkbox } from '../../components/ui';
import { formatCurrency } from '../../utils/format';
import api from '../../api/axios';
import styles from './ReportsHubPage.module.css';

const PLAN_DEFAULTS = {
  starter: [
    'dashboard', 'leads', 'leads-dashboard', 'leads-list', 'leads-kanban', 'leads-calendar',
    'projects', 'tasks', 'reports', 'team-management', 'team-members', 'roles-permissions', 'organization'
  ],
  growth: [
    'dashboard', 'leads', 'leads-dashboard', 'leads-list', 'leads-kanban', 'leads-calendar', 'leads-map',
    'projects', 'tasks', 'reports', 'analytics', 'analytics-leads', 'analytics-projects', 'analytics-csat',
    'analytics-delay', 'coordination', 'handover-dashboard', 'retention-dashboard', 'resource-capacity',
    'absences', 'vendor-performance', 'vendor-capacity', 'team-management', 'team-members',
    'roles-permissions', 'organization'
  ],
  enterprise: [
    'dashboard', 'leads', 'leads-dashboard', 'leads-list', 'leads-kanban', 'leads-calendar', 'leads-map',
    'projects', 'tasks', 'reports', 'analytics', 'analytics-leads', 'analytics-projects', 'analytics-csat',
    'analytics-delay', 'analytics-boq', 'analytics-resources', 'analytics-resource-workload',
    'lead-stages', 'custom-fields', 'lead-forms', 'templates', 'trade-activities', 'qc-checklists',
    'conversion-checklist', 'automations', 'coordination', 'handover-dashboard', 'retention-dashboard',
    'resource-capacity', 'absences', 'vendor-performance', 'vendor-capacity', 'vendor-lead-times',
    'finance-overview', 'financial-approvals', 'analytics-profitability', 'analytics-collection-forecast',
    'financial-thresholds', 'team-management', 'team-members', 'roles-permissions', 'organization',
    'login-history', 'audit-trail', 'superadmin', 'api-keys', 'api-integration', 'webhooks',
    'email-templates', 'logs'
  ]
};

const REPORT_DEFINITIONS = [
  {
    id: 'lead-analytics',
    title: 'Lead & Conversion Analytics',
    desc: 'Pipeline conversion velocity, stage durations, lead acquisition sources, and sales representative closing performance.',
    category: 'sales',
    categoryLabel: 'Sales & Leads',
    icon: '🎯',
    to: '/analytics/leads',
    tabId: 'analytics-leads',
    permission: 'analytics:view_lead_analytics'
  },
  {
    id: 'leads-summary',
    title: 'Lead Pipeline & Activity Report',
    desc: 'Summary of active lead stages, conversion counts, source distribution, and scheduled follow-up activities.',
    category: 'sales',
    categoryLabel: 'Sales & Leads',
    icon: '📋',
    to: '/leads?view=list',
    tabId: 'leads',
    permission: 'leads:read'
  },
  {
    id: 'csat-report',
    title: 'Client Satisfaction (CSAT & NPS)',
    desc: 'Aggregated client feedback ratings, CSAT sentiment trends, NPS distribution, and client satisfaction benchmarks.',
    category: 'sales',
    categoryLabel: 'Sales & Leads',
    icon: '⭐',
    to: '/analytics/csat',
    tabId: 'analytics-csat',
    permission: 'analytics:view_lead_analytics'
  },
  {
    id: 'project-health',
    title: 'Project Portfolio Health',
    desc: 'Comprehensive project status, milestone velocity, on-time delivery percentages, and critical stage bottlenecks.',
    category: 'projects',
    categoryLabel: 'Projects',
    icon: '🏗️',
    to: '/projects',
    tabId: 'projects',
    permission: 'projects:read'
  },
  {
    id: 'tasks-summary',
    title: 'Task Completion & Overdue Report',
    desc: 'Breakdown of assigned tasks, completion velocity, overdue milestones, and priority task tracking.',
    category: 'projects',
    categoryLabel: 'Projects',
    icon: '◻',
    to: '/tasks',
    tabId: 'tasks',
    permission: 'tasks:read'
  },
  {
    id: 'delay-analysis',
    title: 'Project Delay & Variance Analysis',
    desc: 'Root cause taxonomy, delay severity analysis, contractor delay frequencies, and mitigation efficiency metrics.',
    category: 'projects',
    categoryLabel: 'Projects',
    icon: '⏱️',
    to: '/analytics/delay-analysis',
    tabId: 'analytics-delay',
    permission: 'analytics:view_project_analytics'
  },
  {
    id: 'boq-variance',
    title: 'BOQ & Budget Variance Report',
    desc: 'Baseline vs actual estimation variances, change order cost impacts, material cost escalations, and budget overruns.',
    category: 'projects',
    categoryLabel: 'Projects',
    icon: '📊',
    to: '/analytics/boq-variance',
    tabId: 'analytics-boq',
    permission: 'analytics:view_project_analytics'
  },
  {
    id: 'handover-dashboard',
    title: 'Handover & QC Readiness',
    desc: 'Quality inspection checklist progress, snag list clearance rates, client sign-off status, and project handover completion.',
    category: 'projects',
    categoryLabel: 'Projects',
    icon: '📋',
    to: '/projects/handover-dashboard',
    tabId: 'handover-dashboard',
    permission: 'projects:read'
  },
  {
    id: 'retention-dashboard',
    title: 'Client Retention & AMC Analytics',
    desc: 'Post-handover maintenance tracking, AMC renewals, warranty claims resolution, and repeat customer retention rates.',
    category: 'projects',
    categoryLabel: 'Projects',
    icon: '🤝',
    to: '/projects/retention-dashboard',
    tabId: 'retention-dashboard',
    permission: 'projects:read'
  },
  {
    id: 'profitability',
    title: 'Project Profitability & Margin Analysis',
    desc: 'Realized gross margins, cost-to-complete projections, material vs labour cost distribution, and ROI per project.',
    category: 'finance',
    categoryLabel: 'Financials',
    icon: '💰',
    to: '/analytics/profitability',
    tabId: 'analytics-profitability',
    permission: 'analytics:view_finance_analytics'
  },
  {
    id: 'collection-forecast',
    title: 'Payment & Collection Forecast',
    desc: 'Expected milestone cash inflows, payment aging brackets, overdue milestone escalations, and cash flow predictability.',
    category: 'finance',
    categoryLabel: 'Financials',
    icon: '📈',
    to: '/analytics/collection-forecast',
    tabId: 'analytics-collection-forecast',
    permission: 'analytics:view_finance_analytics'
  },
  {
    id: 'financial-approvals',
    title: 'Financial Approvals & Audit Log',
    desc: 'Audit trail of commercial approvals, change order authorisations, and PO threshold limit exceptions.',
    category: 'finance',
    categoryLabel: 'Financials',
    icon: '📝',
    to: '/financial-approvals',
    tabId: 'financial-approvals',
    permission: 'finance:read'
  },
  {
    id: 'resource-capacity',
    title: 'Team Capacity & Utilisation',
    desc: 'Workforce allocation, billable vs non-billable hours, team utilization rates, and future capacity forecasting.',
    category: 'resources',
    categoryLabel: 'Resources & Vendors',
    icon: '👤',
    to: '/analytics/resources',
    tabId: 'resource-capacity',
    permission: 'analytics:read'
  },
  {
    id: 'resource-workload',
    title: 'Team Workload Distribution',
    desc: 'Real-time task distribution across team members, bandwidth overload indicators, and workload rebalancing insights.',
    category: 'resources',
    categoryLabel: 'Resources & Vendors',
    icon: '👥',
    to: '/analytics/resource-workload',
    tabId: 'analytics-resource-workload',
    permission: 'analytics:read'
  },
  {
    id: 'vendor-performance',
    title: 'Vendor Performance Scorecard',
    desc: 'Contractor quality ratings, on-time delivery adherence, pricing consistency, and vendor dispute records.',
    category: 'resources',
    categoryLabel: 'Resources & Vendors',
    icon: '🤝',
    to: '/analytics/vendors',
    tabId: 'vendor-performance',
    permission: 'analytics:read'
  },
  {
    id: 'vendor-capacity',
    title: 'Vendor Capacity & Bandwidth',
    desc: 'Subcontractor active site allocations, trade capacity limits, and external partner availability tracking.',
    category: 'resources',
    categoryLabel: 'Resources & Vendors',
    icon: '⚖️',
    to: '/analytics/vendors-capacity',
    tabId: 'vendor-capacity',
    permission: 'analytics:read'
  },
  {
    id: 'team-roster',
    title: 'Team Members & Access Report',
    desc: 'Directory of active workspace team members, assigned organizational roles, and user access records.',
    category: 'resources',
    categoryLabel: 'Resources & Vendors',
    icon: '👥',
    to: '/team/members',
    tabId: 'team-members',
    permission: 'settings:read'
  }
];

export default function ReportsHubPage() {
  usePageTitle('Reports Hub');
  useBreadcrumbs([
    { label: 'Analytics', to: '/reports' },
    { label: 'Reports Hub' }
  ]);

  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Export Modal States
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf'); // 'pdf' | 'xlsx' | 'csv' | 'print'
  const [exportScope, setExportScope] = useState('all');
  const [customSelectedIds, setCustomSelectedIds] = useState([]);
  const [datePeriod, setDatePeriod] = useState('this_month');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [executiveRemarks, setExecutiveRemarks] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const isDeveloperWorkspace = 
    !user?.tenant || 
    user?.tenant?.slug === 'admin' || 
    user?.tenant?.slug === 'default' || 
    user?.tenant?.slug === 'platform' || 
    user?.tenant?.name?.toLowerCase() === 'admin' ||
    user?.tenant?.name?.toLowerCase() === 'developer' ||
    user?.is_platform_admin === true ||
    (user?.role?.name?.toLowerCase() === 'superadmin' && (user?.tenant?.slug === 'admin' || !user?.tenant?.plan));

  const isAdmin = isDeveloperWorkspace ||
                  user?.role === 'superadmin' || 
                  (typeof user?.role === 'object' && (user?.role?.name?.toLowerCase() === 'superadmin' || user?.role?.name?.toLowerCase() === 'admin'));

  const tenantPlan = (user?.tenant?.plan || 'starter').toLowerCase();
  const planTabs = (user?.sidebarConfig?.planTabs && Array.isArray(user.sidebarConfig.planTabs) && user.sidebarConfig.planTabs.length > 0)
    ? user.sidebarConfig.planTabs
    : (PLAN_DEFAULTS[tenantPlan] || PLAN_DEFAULTS.starter);

  useEffect(() => {
    fetchGlobalStats();
    if (user) {
      setCompanyName(user.tenant?.name || 'CRM Workspace');
      setPreparedBy(user.name || 'Executive Administrator');
    }
  }, [user]);

  const fetchGlobalStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/stats');
      if (res.data?.success || res.data?.data) {
        setStats(res.data?.data || res.data);
      }
    } catch (err) {
      console.error('Failed to load global statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission) => {
    if (isAdmin) return true;
    if (!permission) return true;
    const actions = user?.role?.permissions || [];
    const [mod] = permission.split(':');
    return actions.includes('*') || actions.includes(permission) || actions.includes(`${mod}:*`);
  };

  // 1. Filter reports available in this workspace based on Plan Tabs and Permissions
  const availableReports = REPORT_DEFINITIONS.filter(report => {
    // In developer/admin workspace, all reports are available to admin
    if (isDeveloperWorkspace && isAdmin) return true;

    // In client workspaces (like interior hub), report's tabId must be in the plan
    if (planTabs && Array.isArray(planTabs)) {
      if (report.tabId && !planTabs.includes(report.tabId)) return false;
    }

    return hasPermission(report.permission);
  });

  // 2. Filter available reports based on active Category tab and search query
  const filteredReports = availableReports.filter(report => {
    if (selectedCategory !== 'all' && report.category !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      report.title.toLowerCase().includes(query) ||
      report.desc.toLowerCase().includes(query) ||
      report.categoryLabel.toLowerCase().includes(query)
    );
  });

  // Calculate available categories for tabs toolbar
  const availableCategoryKeys = new Set(availableReports.map(r => r.category));

  const getCategoryClass = (category) => {
    switch (category) {
      case 'sales': return styles.sales;
      case 'projects': return styles.projects;
      case 'finance': return styles.finance;
      case 'resources': return styles.resources;
      default: return styles.projects;
    }
  };

  // Safe numerical extractions for KPI metrics
  const activeLeadsCount = typeof stats?.activeLeads === 'object'
    ? (stats.activeLeads?.count !== undefined ? stats.activeLeads.count : 0)
    : (stats?.activeLeads !== undefined ? stats.activeLeads : 0);

  const wonThisMonthValue = typeof stats?.wonThisMonth === 'object'
    ? (stats.wonThisMonth?.value !== undefined ? stats.wonThisMonth.value : (stats.wonThisMonth?.won_value || 0))
    : (stats?.wonThisMonth !== undefined ? stats.wonThisMonth : 0);

  const activeProjectsCount = typeof stats?.activeProjects === 'object'
    ? (stats.activeProjects?.count !== undefined ? stats.activeProjects.count : 0)
    : (stats?.activeProjects !== undefined ? stats.activeProjects : 0);

  const overdueTasksCount = typeof stats?.tasksDueToday === 'object'
    ? (stats.tasksDueToday?.overdueCount !== undefined ? stats.tasksDueToday.overdueCount : 0)
    : (stats?.tasksOverdue !== undefined ? stats.tasksOverdue : 0);

  const overdueProjectsCount = typeof stats?.activeProjects === 'object'
    ? (stats.activeProjects?.overdueCount !== undefined ? stats.activeProjects.overdueCount : 0)
    : (stats?.overdueProjects !== undefined ? stats.overdueProjects : 0);

  // Get selected reports for export
  const getExportReports = () => {
    if (exportScope === 'all') return availableReports;
    if (exportScope === 'custom') return availableReports.filter(r => customSelectedIds.includes(r.id));
    return availableReports.filter(r => r.category === exportScope);
  };

  const getPeriodLabel = () => {
    switch (datePeriod) {
      case 'this_month': return 'Current Month (MTD)';
      case 'last_30_days': return 'Last 30 Days';
      case 'qtd': return 'Current Quarter (QTD)';
      case 'ytd': return 'Year to Date (YTD)';
      case 'custom': return `${customDateFrom || 'Start'} to ${customDateTo || 'Current'}`;
      default: return 'Current Month';
    }
  };

  // Handle comprehensive report generation
  const handleExecuteExport = async (e) => {
    e.preventDefault();
    setIsExporting(true);

    try {
      const selectedReports = getExportReports();
      const timestamp = new Date().toISOString().split('T')[0];
      const periodText = getPeriodLabel();
      const orgText = companyName.trim() || 'Interior & Construction CRM';
      const authorText = preparedBy.trim() || 'System Administrator';

      if (exportFormat === 'print') {
        setIsExportOpen(false);
        setTimeout(() => {
          window.print();
        }, 300);
        return;
      }

      if (exportFormat === 'pdf') {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Header Background
        doc.setFillColor(30, 41, 59); // Slate 800
        doc.rect(0, 0, 210, 36, 'F');

        // Document Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(orgText.toUpperCase(), 14, 15);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(203, 213, 225);
        doc.text('EXECUTIVE INTELLIGENCE & PERFORMANCE SUMMARY REPORT', 14, 23);
        doc.text(`Reporting Window: ${periodText} | Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 30);

        // Metadata Callout Strip
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 42, 182, 16, 2, 2, 'FD');

        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        doc.text('Prepared By:', 18, 52);
        doc.setFont('helvetica', 'normal');
        doc.text(authorText, 42, 52);

        doc.setFont('helvetica', 'bold');
        doc.text('Report Scope:', 105, 52);
        doc.setFont('helvetica', 'normal');
        doc.text(`${selectedReports.length} Intelligence Modules Included`, 130, 52);

        // Executive KPIs Table
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('1. Key Performance Indicators (Live Database State)', 14, 68);

        const kpiRows = [
          ['Active Pipeline Leads', String(activeLeadsCount), 'Total active qualified leads in sales pipeline'],
          ['Won Value This Month', formatCurrency(wonThisMonthValue), 'Confirmed contract bookings achieved this month'],
          ['Active Projects', String(activeProjectsCount), 'Live interior & construction execution projects'],
          ['Overdue Tasks', String(overdueTasksCount), 'Milestone tasks needing immediate resolution'],
          ['Overdue Projects', String(overdueProjectsCount), 'Projects exceeding committed delivery schedule']
        ];

        autoTable(doc, {
          startY: 72,
          head: [['Metric', 'Value', 'Context / Description']],
          body: kpiRows,
          theme: 'striped',
          headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
          styles: { fontSize: 9, cellPadding: 3.5 },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 50 },
            1: { cellWidth: 40, fontStyle: 'bold', textColor: [15, 23, 42] },
            2: { cellWidth: 92 }
          }
        });

        // Report Modules Catalog Table
        const nextY = (doc.lastAutoTable?.finalY || 130) + 12;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('2. Intelligence Modules & Reporting Catalog', 14, nextY);

        const reportRows = selectedReports.map(r => [
          r.categoryLabel,
          r.title,
          r.desc
        ]);

        autoTable(doc, {
          startY: nextY + 4,
          head: [['Domain', 'Report Title', 'Executive Intelligence Delivered']],
          body: reportRows,
          theme: 'striped',
          headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
          styles: { fontSize: 8.5, cellPadding: 3 },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 42 },
            1: { fontStyle: 'bold', cellWidth: 50 },
            2: { cellWidth: 90 }
          }
        });

        // Optional Remarks Section
        if (executiveRemarks.trim()) {
          const notesY = (doc.lastAutoTable?.finalY || 200) + 10;
          if (notesY < 250) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text('3. Executive Remarks & Strategic Notes', 14, notesY);

            doc.setFillColor(254, 243, 199);
            doc.setDrawColor(245, 158, 11);
            doc.roundedRect(14, notesY + 3, 182, 20, 2, 2, 'FD');

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(120, 53, 15);
            doc.text(doc.splitTextToSize(executiveRemarks.trim(), 174), 18, notesY + 9);
          }
        }

        // Footer on all pages
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`CRM Interior & Construction Intelligence Suite | Page ${i} of ${pageCount}`, 14, 290);
          doc.text(`Confidential • For Internal & Stakeholder Use Only`, 140, 290);
        }

        doc.save(`Executive_Summary_Report_${timestamp}.pdf`);
        toast.success('Executive PDF summary generated and downloaded successfully!');
      } else if (exportFormat === 'xlsx') {
        const wb = XLSX.utils.book_new();

        // 1. KPIs Sheet
        const kpiData = [
          { Metric: 'Organization Name', Value: orgText, Description: 'Workspace Entity' },
          { Metric: 'Reporting Window', Value: periodText, Description: 'Report timeframe' },
          { Metric: 'Prepared By', Value: authorText, Description: 'Report Author' },
          { Metric: 'Generation Date', Value: timestamp, Description: 'Date generated' },
          { Metric: 'Active Pipeline Leads', Value: activeLeadsCount, Description: 'Live leads in pipeline' },
          { Metric: 'Won Value This Month', Value: wonThisMonthValue, Description: 'Closed deals revenue' },
          { Metric: 'Active Projects', Value: activeProjectsCount, Description: 'Ongoing projects execution' },
          { Metric: 'Overdue Tasks', Value: overdueTasksCount, Description: 'Tasks past deadline' },
          { Metric: 'Overdue Projects', Value: overdueProjectsCount, Description: 'Projects past target completion' }
        ];
        const wsKpi = XLSX.utils.json_to_sheet(kpiData);
        XLSX.utils.book_append_sheet(wb, wsKpi, 'Executive_KPIs');

        // 2. Report Catalog Sheet
        const catalogData = selectedReports.map(r => ({
          Domain: r.categoryLabel,
          'Report Title': r.title,
          'Intelligence Scope': r.desc,
          'System Route': r.to
        }));
        const wsCatalog = XLSX.utils.json_to_sheet(catalogData);
        XLSX.utils.book_append_sheet(wb, wsCatalog, 'Report_Catalog');

        // 3. Notes Sheet (if provided)
        if (executiveRemarks.trim()) {
          const notesData = [
            { Field: 'Executive Remarks', Details: executiveRemarks.trim() }
          ];
          const wsNotes = XLSX.utils.json_to_sheet(notesData);
          XLSX.utils.book_append_sheet(wb, wsNotes, 'Executive_Notes');
        }

        XLSX.writeFile(wb, `Executive_Summary_Report_${timestamp}.xlsx`);
        toast.success('Excel workbook exported successfully!');
      } else if (exportFormat === 'csv') {
        const rows = [
          ['=== EXECUTIVE INTELLIGENCE SUMMARY REPORT ==='],
          ['Organization', orgText],
          ['Reporting Window', periodText],
          ['Prepared By', authorText],
          ['Generated At', timestamp],
          [],
          ['=== LIVE DATABASE METRICS ==='],
          ['Metric', 'Value', 'Description'],
          ['Active Leads', String(activeLeadsCount), 'Total active qualified leads in pipeline'],
          ['Won Value This Month', String(wonThisMonthValue), 'Confirmed contract bookings this month'],
          ['Active Projects', String(activeProjectsCount), 'Live interior execution projects'],
          ['Overdue Tasks', String(overdueTasksCount), 'Milestone tasks past due date'],
          ['Overdue Projects', String(overdueProjectsCount), 'Projects exceeding committed delivery'],
          [],
          ['=== INCLUDED INTELLIGENCE MODULES ==='],
          ['Domain', 'Report Title', 'Description', 'Route'],
          ...selectedReports.map(r => [
            `"${r.categoryLabel}"`,
            `"${r.title}"`,
            `"${r.desc.replace(/"/g, '""')}"`,
            `"${r.to}"`
          ])
        ];

        if (executiveRemarks.trim()) {
          rows.push([]);
          rows.push(['=== EXECUTIVE REMARKS ===']);
          rows.push([`"${executiveRemarks.trim().replace(/"/g, '""')}"`]);
        }

        const csvContent = rows.map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Executive_Summary_Report_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('CSV dataset exported successfully!');
      }

      setIsExportOpen(false);
    } catch (err) {
      console.error('Export generation error:', err);
      toast.error('Failed to generate export file.');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleCustomReport = (id) => {
    setCustomSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.welcomeHeader}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className={styles.mainTitle}>📋 Reports & Intelligence Hub</h1>
            <p className={styles.mainSubtitle}>
              Access executive intelligence, live operational benchmarks, profitability metrics, and team performance reports.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Button variant="secondary" onClick={fetchGlobalStats} disabled={loading}>
              🔄 Refresh Data
            </Button>
            <Button 
              variant="primary" 
              onClick={() => setIsExportOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <span>📊</span>
              <span>Export Summary</span>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>🎯</div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Active Leads</span>
            <span className={styles.kpiVal}>
              {loading && !stats ? '--' : activeLeadsCount}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>💰</div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Won This Month</span>
            <span className={styles.kpiVal}>
              {loading && !stats ? '--' : formatCurrency(wonThisMonthValue, true)}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>🏗️</div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Active Projects</span>
            <span className={styles.kpiVal}>
              {loading && !stats ? '--' : activeProjectsCount}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>⏱️</div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Overdue Tasks</span>
            <span className={styles.kpiVal} style={{ color: overdueTasksCount > 0 ? 'var(--color-danger)' : 'inherit' }}>
              {loading && !stats ? '--' : overdueTasksCount}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>⚠️</div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiLabel}>Overdue Projects</span>
            <span className={styles.kpiVal} style={{ color: overdueProjectsCount > 0 ? 'var(--color-danger)' : 'inherit' }}>
              {loading && !stats ? '--' : overdueProjectsCount}
            </span>
          </div>
        </div>
      </div>

      {/* Control Filter Toolbar */}
      <div className={styles.controlRow}>
        <div className={styles.categoryTabs}>
          <button 
            type="button"
            className={`${styles.tabBtn} ${selectedCategory === 'all' ? styles.activeTab : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All Reports ({availableReports.length})
          </button>
          {availableCategoryKeys.has('sales') && (
            <button 
              type="button"
              className={`${styles.tabBtn} ${selectedCategory === 'sales' ? styles.activeTab : ''}`}
              onClick={() => setSelectedCategory('sales')}
            >
              🎯 Sales & Leads
            </button>
          )}
          {availableCategoryKeys.has('projects') && (
            <button 
              type="button"
              className={`${styles.tabBtn} ${selectedCategory === 'projects' ? styles.activeTab : ''}`}
              onClick={() => setSelectedCategory('projects')}
            >
              🏗️ Projects
            </button>
          )}
          {availableCategoryKeys.has('finance') && (
            <button 
              type="button"
              className={`${styles.tabBtn} ${selectedCategory === 'finance' ? styles.activeTab : ''}`}
              onClick={() => setSelectedCategory('finance')}
            >
              💰 Financials
            </button>
          )}
          {availableCategoryKeys.has('resources') && (
            <button 
              type="button"
              className={`${styles.tabBtn} ${selectedCategory === 'resources' ? styles.activeTab : ''}`}
              onClick={() => setSelectedCategory('resources')}
            >
              👥 Resources & Vendors
            </button>
          )}
        </div>

        <div className={styles.searchBox}>
          <input 
            type="text" 
            placeholder="Search reports by keyword, metric, or topic..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Report Cards Grid */}
      {filteredReports.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '60px 20px',
          textAlign: 'center',
          color: 'var(--color-text-secondary)'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-text)', marginBottom: '8px' }}>
            No matching reports found
          </h3>
          <p style={{ fontSize: '14px', maxWidth: '400px', margin: '0 auto 16px auto' }}>
            No reports match your current search query "{searchQuery}". Try searching for terms like "leads", "revenue", "variance", or select "All Reports".
          </p>
          <Button variant="secondary" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}>
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className={styles.reportGrid}>
          {filteredReports.map(report => (
            <div key={report.id} className={styles.reportCard}>
              <div className={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>{report.icon}</span>
                  <h3 className={styles.cardTitle}>{report.title}</h3>
                </div>
                <span className={`${styles.badge} ${getCategoryClass(report.category)}`}>
                  {report.categoryLabel}
                </span>
              </div>

              <p className={styles.cardDesc}>
                {report.desc}
              </p>

              <div className={styles.cardActions}>
                <Button 
                  variant="primary" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => navigate(report.to)}
                >
                  <span>Open Report</span>
                  <span>→</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* COMPREHENSIVE EXPORT SUMMARY MODAL */}
      <Modal
        isOpen={isExportOpen}
        onClose={() => !isExporting && setIsExportOpen(false)}
        title="📊 Export Executive Intelligence Summary"
        size="lg"
      >
        <form onSubmit={handleExecuteExport} className={styles.exportModalForm}>
          {/* Step 1: Select Format */}
          <div className={styles.exportSection}>
            <div className={styles.exportSectionTitle}>
              <span>📁</span>
              <span>1. Select Export Format</span>
            </div>
            <div className={styles.exportSectionDesc}>
              Choose the output format best suited for your stakeholder presentation or data analysis.
            </div>

            <div className={styles.formatGrid}>
              <div 
                className={`${styles.formatCard} ${exportFormat === 'pdf' ? styles.activeFormatCard : ''}`}
                onClick={() => setExportFormat('pdf')}
              >
                <div className={styles.formatIcon}>📄</div>
                <div className={styles.formatTitle}>PDF Document</div>
                <div className={styles.formatBadge}>Executive Brief</div>
              </div>

              <div 
                className={`${styles.formatCard} ${exportFormat === 'xlsx' ? styles.activeFormatCard : ''}`}
                onClick={() => setExportFormat('xlsx')}
              >
                <div className={styles.formatIcon}>📊</div>
                <div className={styles.formatTitle}>Excel (.xlsx)</div>
                <div className={styles.formatBadge}>Multi-Sheet</div>
              </div>

              <div 
                className={`${styles.formatCard} ${exportFormat === 'csv' ? styles.activeFormatCard : ''}`}
                onClick={() => setExportFormat('csv')}
              >
                <div className={styles.formatIcon}>📁</div>
                <div className={styles.formatTitle}>CSV Dataset</div>
                <div className={styles.formatBadge}>Raw Data</div>
              </div>

              <div 
                className={`${styles.formatCard} ${exportFormat === 'print' ? styles.activeFormatCard : ''}`}
                onClick={() => setExportFormat('print')}
              >
                <div className={styles.formatIcon}>🖨️</div>
                <div className={styles.formatTitle}>Print Layout</div>
                <div className={styles.formatBadge}>Direct Print</div>
              </div>
            </div>
          </div>

          {/* Step 2: Scope & Domain Selection */}
          <div className={styles.exportSection}>
            <div className={styles.exportSectionTitle}>
              <span>🎯</span>
              <span>2. Report Scope & Domains</span>
            </div>
            <div className={styles.exportSectionDesc}>
              Select which organizational intelligence chapters to include in this report.
            </div>

            <div className={styles.scopePillGroup}>
              <button 
                type="button" 
                className={`${styles.scopePill} ${exportScope === 'all' ? styles.activeScopePill : ''}`}
                onClick={() => setExportScope('all')}
              >
                🌐 Full Summary ({availableReports.length} Modules)
              </button>
              {availableCategoryKeys.has('sales') && (
                <button 
                  type="button" 
                  className={`${styles.scopePill} ${exportScope === 'sales' ? styles.activeScopePill : ''}`}
                  onClick={() => setExportScope('sales')}
                >
                  🎯 Sales & Leads
                </button>
              )}
              {availableCategoryKeys.has('projects') && (
                <button 
                  type="button" 
                  className={`${styles.scopePill} ${exportScope === 'projects' ? styles.activeScopePill : ''}`}
                  onClick={() => setExportScope('projects')}
                >
                  🏗️ Project Operations
                </button>
              )}
              {availableCategoryKeys.has('finance') && (
                <button 
                  type="button" 
                  className={`${styles.scopePill} ${exportScope === 'finance' ? styles.activeScopePill : ''}`}
                  onClick={() => setExportScope('finance')}
                >
                  💰 Financial Intelligence
                </button>
              )}
              {availableCategoryKeys.has('resources') && (
                <button 
                  type="button" 
                  className={`${styles.scopePill} ${exportScope === 'resources' ? styles.activeScopePill : ''}`}
                  onClick={() => setExportScope('resources')}
                >
                  👥 Resources & Vendors
                </button>
              )}
              <button 
                type="button" 
                className={`${styles.scopePill} ${exportScope === 'custom' ? styles.activeScopePill : ''}`}
                onClick={() => setExportScope('custom')}
              >
                ⚙️ Custom Selection ({customSelectedIds.length})
              </button>
            </div>

            {exportScope === 'custom' && (
              <div className={styles.checkboxGrid}>
                {availableReports.map(rep => (
                  <div key={rep.id} className={styles.checkboxItem}>
                    <Checkbox 
                      label={rep.title} 
                      checked={customSelectedIds.includes(rep.id)} 
                      onChange={() => toggleCustomReport(rep.id)} 
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Reporting Period */}
          <div className={styles.exportSection}>
            <div className={styles.exportSectionTitle}>
              <span>📅</span>
              <span>3. Reporting Window & Timeframe</span>
            </div>
            <div className={styles.exportSectionDesc}>
              Tag the report with the relevant analytics window or select custom date bounds.
            </div>

            <div className={styles.scopePillGroup} style={{ marginBottom: datePeriod === 'custom' ? '12px' : 0 }}>
              <button 
                type="button" 
                className={`${styles.scopePill} ${datePeriod === 'this_month' ? styles.activeScopePill : ''}`}
                onClick={() => setDatePeriod('this_month')}
              >
                Current Month
              </button>
              <button 
                type="button" 
                className={`${styles.scopePill} ${datePeriod === 'last_30_days' ? styles.activeScopePill : ''}`}
                onClick={() => setDatePeriod('last_30_days')}
              >
                Last 30 Days
              </button>
              <button 
                type="button" 
                className={`${styles.scopePill} ${datePeriod === 'qtd' ? styles.activeScopePill : ''}`}
                onClick={() => setDatePeriod('qtd')}
              >
                Current Quarter (QTD)
              </button>
              <button 
                type="button" 
                className={`${styles.scopePill} ${datePeriod === 'ytd' ? styles.activeScopePill : ''}`}
                onClick={() => setDatePeriod('ytd')}
              >
                Year to Date (YTD)
              </button>
              <button 
                type="button" 
                className={`${styles.scopePill} ${datePeriod === 'custom' ? styles.activeScopePill : ''}`}
                onClick={() => setDatePeriod('custom')}
              >
                Custom Date Range
              </button>
            </div>

            {datePeriod === 'custom' && (
              <div className={styles.formRow} style={{ marginTop: '12px' }}>
                <Input 
                  label="From Date" 
                  type="date" 
                  value={customDateFrom} 
                  onChange={e => setCustomDateFrom(e.target.value)} 
                />
                <Input 
                  label="To Date" 
                  type="date" 
                  value={customDateTo} 
                  onChange={e => setCustomDateTo(e.target.value)} 
                />
              </div>
            )}
          </div>

          {/* Step 4: Metadata & Executive Notes */}
          <div className={styles.exportSection}>
            <div className={styles.exportSectionTitle}>
              <span>📝</span>
              <span>4. Report Branding & Remarks (Optional)</span>
            </div>

            <div className={styles.formRow} style={{ marginBottom: '12px' }}>
              <Input 
                label="Organization / Brand Title"
                placeholder="e.g. Design Studio A"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
              />
              <Input 
                label="Prepared By"
                placeholder="e.g. Sarah Jenkins (Operations Director)"
                value={preparedBy}
                onChange={e => setPreparedBy(e.target.value)}
              />
            </div>

            <Textarea 
              label="Executive Remarks / Strategic Takeaways"
              placeholder="Add optional notes, next milestones, or key conclusions to embed into this export..."
              value={executiveRemarks}
              onChange={e => setExecutiveRemarks(e.target.value)}
              rows={2}
            />
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => setIsExportOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              disabled={isExporting || (exportScope === 'custom' && customSelectedIds.length === 0)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {isExporting ? (
                <>
                  <span>⏳</span>
                  <span>Generating Report...</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Generate & Export Summary ({exportFormat.toUpperCase()})</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
