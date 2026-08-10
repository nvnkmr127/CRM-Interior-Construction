import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { useAuth } from '../../store/authContext';
import { Input, Button } from '../../components/ui';
import styles from './ReportsHubPage.module.css';

const REPORT_CATEGORIES = [
  {
    id: 'sales',
    title: 'Sales & Leads',
    icon: '🎯',
    permission: 'analytics:view_lead_analytics',
    reports: [
      {
        id: 'lead_analytics',
        title: 'Lead Analytics',
        desc: 'Pipeline overview, conversion rates, funnel analysis, and rep performance.',
        icon: '▲',
        to: '/analytics/leads'
      },
      {
        id: 'csat',
        title: 'Client Satisfaction',
        desc: 'NPS, CSAT scores, and customer feedback trends.',
        icon: '⭐',
        to: '/analytics/csat'
      }
    ]
  },
  {
    id: 'projects',
    title: 'Project Operations',
    icon: '🏗️',
    permission: 'analytics:view_project_analytics',
    reports: [
      {
        id: 'project_health',
        title: 'Project Health',
        desc: 'Overall status of all ongoing projects and milestone completion.',
        icon: '◉',
        to: '/analytics/projects'
      },
      {
        id: 'delay_analysis',
        title: 'Delay Analysis',
        desc: 'Analyze root causes, frequency, and impact of project delays.',
        icon: '⏱️',
        to: '/analytics/delay-analysis'
      },
      {
        id: 'boq_variance',
        title: 'BOQ Variance',
        desc: 'Track deviations between baseline BOQ and actuals.',
        icon: '📊',
        to: '/analytics/boq-variance'
      }
    ]
  },
  {
    id: 'finance',
    title: 'Financials',
    icon: '💰',
    permission: 'analytics:view_finance_analytics',
    reports: [
      {
        id: 'profitability',
        title: 'Project Profitability',
        desc: 'Analyze margins, revenue vs cost across projects.',
        icon: '💎',
        to: '/analytics/profitability'
      },
      {
        id: 'collection_forecast',
        title: 'Collection Forecast',
        desc: 'Expected cash inflows and overdue payments.',
        icon: '📈',
        to: '/analytics/collection-forecast'
      }
    ]
  },
  {
    id: 'resources_vendors',
    title: 'Resources & Vendors',
    icon: '👥',
    reports: [
      {
        id: 'resource_utilisation',
        title: 'Resource Utilisation',
        desc: 'Billable hours, capacity, and workforce efficiency.',
        icon: '👤',
        to: '/analytics/resources'
      },
      {
        id: 'resource_workload',
        title: 'Resource Workload',
        desc: 'Current workload distribution across team members.',
        icon: '👥',
        to: '/analytics/resource-workload'
      },
      {
        id: 'vendor_performance',
        title: 'Vendor Performance',
        desc: 'Quality, timeliness, and reliability of vendors.',
        icon: '🤝',
        to: '/analytics/vendors'
      },
      {
        id: 'vendor_capacity',
        title: 'Vendor Capacity',
        desc: 'Availability and limits of external contractors.',
        icon: '⚖️',
        to: '/analytics/vendors-capacity'
      }
    ]
  }
];

export default function ReportsHubPage() {
  usePageTitle('Reports & Analytics Hub');
  useBreadcrumbs([
    { label: 'Analytics', href: '/analytics/hub' },
    { label: 'Reports Hub' }
  ]);

  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const isAdmin = user?.role?.name === 'superadmin';
  const hasPermission = (perm) => {
    if (isAdmin) return true;
    if (!perm) return true;
    const [mod] = perm.split(':');
    return user?.role?.permissions?.includes(perm) || user?.role?.permissions?.includes(`${mod}:*`);
  };

  const filteredCategories = REPORT_CATEGORIES.map(category => {
    if (!hasPermission(category.permission)) return null;
    
    const matchedReports = category.reports.filter(r => 
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.desc.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (matchedReports.length === 0) return null;

    return { ...category, reports: matchedReports };
  }).filter(Boolean);

  const getLinkWithFilters = (baseTo) => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('from', dateFrom);
    if (dateTo) params.append('to', dateTo);
    const qs = params.toString();
    return qs ? `${baseTo}?${qs}` : baseTo;
  };

  return (
    <div className={styles.container}>
      {/* Standard CRM Header Layout */}
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <h1>
            <span className={styles.titleIcon}>📑</span>
            Reports Hub
          </h1>
          <p className={styles.subtitle}>
            Centralized insights across sales, projects, finance, and operations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button variant="primary" icon="➕" onClick={() => alert('Custom Report Builder coming soon!')}>
            Custom Report
          </Button>
        </div>
      </div>

      {/* Toolbar for Search & Global Filters */}
      <div className={styles.toolbar}>
        <div style={{ width: '300px' }}>
          <Input 
            placeholder="Search reports..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon="🔍"
          />
        </div>
        <div className={styles.dateFilters} style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Apply Global Date Filter:</span>
          <Input 
            type="date" 
            value={dateFrom} 
            onChange={(e) => setDateFrom(e.target.value)} 
          />
          <span style={{ color: 'var(--text-secondary)' }}>to</span>
          <Input 
            type="date" 
            value={dateTo} 
            onChange={(e) => setDateTo(e.target.value)} 
          />
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className={styles.content}>
        {filteredCategories.length === 0 ? (
          <div className={styles.emptyState}>
            <span style={{ fontSize: '2rem', marginBottom: '1rem' }}>📭</span>
            <h3>No reports found</h3>
            <p>Try adjusting your search criteria.</p>
          </div>
        ) : (
          filteredCategories.map(category => (
            <div key={category.id} className={styles.categorySection}>
              <div className={styles.categoryHeader}>
                <span className={styles.categoryIcon}>{category.icon}</span>
                <h2>{category.title}</h2>
              </div>
              
              <div className={styles.grid}>
                {category.reports.map(report => (
                  <Link to={getLinkWithFilters(report.to)} key={report.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardIcon}>{report.icon}</div>
                      <div>
                        <h3 className={styles.cardTitle}>{report.title}</h3>
                        <p className={styles.cardDesc}>{report.desc}</p>
                      </div>
                    </div>
                    <div className={styles.cardFooter}>
                      <span>View Report</span>
                      <span className={styles.arrow}>→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
