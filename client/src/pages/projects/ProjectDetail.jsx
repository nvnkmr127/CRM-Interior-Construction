import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Badge } from '../../components/ui';
import styles from './ProjectDetail.module.css';
import { getProject, deleteProject, updateProject, archiveProject } from '../../api/projects';
import ProjectForm from '../../components/projects/ProjectForm';
import ReopenProjectModal from '../../components/projects/ReopenProjectModal';

// Lazy load tabs
const PhaseTimeline = React.lazy(() => import('../../components/projects/PhaseTimeline'));
const GanttChart = React.lazy(() => import('../../components/projects/GanttChart'));
const TaskKanban = React.lazy(() => import('../../components/tasks/TaskKanban'));
const DocumentPanel = React.lazy(() => import('../../components/projects/DocumentPanel'));
const DrawingRegisterTab = React.lazy(() => import('../../components/projects/DrawingRegisterTab'));
const PaymentsTab = React.lazy(() => import('./PaymentsTab'));
const SnagsDashboard = React.lazy(() => import('./SnagsDashboard'));
const HandoverChecklist = React.lazy(() => import('./HandoverChecklist'));
const WarrantiesTab = React.lazy(() => import('./WarrantiesTab'));
const AmcsTab = React.lazy(() => import('./AmcsTab'));
const ProjectClosureTab = React.lazy(() => import('./ProjectClosureTab'));
const ProjectRetrospectiveTab = React.lazy(() => import('./ProjectRetrospectiveTab'));
const BookingTab = React.lazy(() => import('./BookingTab'));
const CommercialApprovalTab = React.lazy(() => import('./CommercialApprovalTab'));
const CoordinationTab = React.lazy(() => import('./CoordinationTab'));
const HandoverReadinessTab = React.lazy(() => import('./HandoverReadinessTab'));
const ServiceTicketsTab = React.lazy(() => import('./ServiceTicketsTab'));
const CustomerRetentionTab = React.lazy(() => import('./CustomerRetentionTab'));
const BaselineAssessmentTab = React.lazy(() => import('./BaselineAssessmentTab'));

const DesignRequirements = React.lazy(() => import('../../components/projects/DesignRequirements'));
const DesignAssetsTab = React.lazy(() => import('../../components/projects/DesignAssetsTab'));
const DesignReviewsTab = React.lazy(() => import('../../components/projects/DesignReviewsTab'));
const MaterialPalettesTab = React.lazy(() => import('../../components/projects/MaterialPalettesTab'));
const ChangeOrdersTab = React.lazy(() => import('../../components/projects/ChangeOrdersTab'));
const BOQVarianceTab = React.lazy(() => import('../../components/projects/BOQVarianceTab'));
const ProjectQuotationsTab = React.lazy(() => import('../../components/projects/ProjectQuotationsTab'));
const BudgetTab = React.lazy(() => import('../../components/projects/BudgetTab'));
const PurchaseRequestsTab = React.lazy(() => import('../../components/projects/PurchaseRequestsTab'));
const PurchaseOrdersTab = React.lazy(() => import('../../components/projects/PurchaseOrdersTab'));
      case 'Handovers': return <HandoverHistoryTab projectId={projectId} />;
      case 'Design Brief': return <DesignRequirements projectId={projectId} />;
      case 'Design Assets': return <DesignAssetsTab projectId={projectId} />;
      case 'Design Reviews': return <DesignReviewsTab projectId={projectId} />;
      case 'Material Palettes': return <MaterialPalettesTab projectId={projectId} />;
      case 'Quotations & BOQ': return <ProjectQuotationsTab projectId={projectId} />;
      case 'Commercial Approval': return <CommercialApprovalTab projectId={projectId} projectStatus={project?.status} onProjectUpdated={reloadProject} />;
      case 'Change Orders': return <ChangeOrdersTab projectId={projectId} />;
      case 'BOQ Variance': return <BOQVarianceTab projectId={projectId} />;
      case 'Budget': return <BudgetTab projectId={projectId} />;
      case 'Profitability': return <ProjectProfitability projectId={projectId} />;
      case 'Purchase Requests': return <PurchaseRequestsTab projectId={projectId} />;
      case 'Purchase Orders': return <PurchaseOrdersTab projectId={projectId} />;
      case 'Material Deliveries': return <MaterialDeliveriesTab projectId={projectId} />;
      case 'Vendor Payments': return <VendorPaymentsTab projectId={projectId} />;
      case 'Substitutions': return <MaterialSubstitutionsTab projectId={projectId} />;
      case 'Factory Production': return <FactoryProductionTab projectId={projectId} />;
      case 'Coordination': return <CoordinationTab projectId={projectId} projectStatus={project?.status} onProjectUpdated={reloadProject} />;
      case 'Phases': return <PhaseTimeline projectId={projectId} />;
      case 'Gantt Chart': return <GanttChart projectId={projectId} project={project} />;
      case 'Work Activities': return <WorkActivitiesTab projectId={projectId} project={project} />;
      case 'Room Progress': return <RoomProgressTab projectId={projectId} />;
      case 'Tasks': return <TaskKanban projectId={projectId} />;
      case 'Daily Site Reports': return <DailySiteReportsTab projectId={projectId} />;
      case 'Weekly Reports': return <WeeklyReportsTab projectId={projectId} />;
      case 'Documents': return <DocumentPanel projectId={projectId} />;
      case 'Drawing Register': return <DrawingRegisterTab projectId={projectId} />;
      case 'MEP Checklist': return <MepChecklistTab projectId={projectId} />;
      case 'Payments': return <PaymentsTab projectId={projectId} />;
      case 'Execution QC': return <ExecutionQCTab projectId={projectId} project={project} />;
      case 'Snags': return <SnagsDashboard projectId={projectId} />;
      case 'Handover': return <HandoverChecklist projectId={projectId} />;
      case 'Punch List': return <PunchListTab projectId={projectId} />;
      case 'Warranties': return <WarrantiesTab projectId={projectId} />;
      case 'AMCs': return <AmcsTab projectId={projectId} />;
      case 'Handover Readiness': return <HandoverReadinessTab projectId={projectId} />;
      case 'Service Tickets': return <ServiceTicketsTab projectId={projectId} />;
      case 'Customer Retention': return <CustomerRetentionTab projectId={projectId} />;
      case 'Project Closure': return <ProjectClosureTab projectId={projectId} projectStatus={project.status} onProjectUpdated={reloadProject} />;
      case 'Retrospective': return <ProjectRetrospectiveTab projectId={projectId} projectStatus={project.status} />;
      default: return <div>{activeTab} Content (Coming Soon)</div>;
    }
  };

  const detailBaseTargetDate = project?.target_date ? new Date(project.target_date) : null;
  const detailTimelineImpact = project?.stats?.approvedTimelineImpactDays || 0;
  const detailRevisedTargetDate = detailBaseTargetDate && detailTimelineImpact > 0 
    ? new Date(detailBaseTargetDate.getTime() + detailTimelineImpact * 24 * 60 * 60 * 1000) 
    : null;
  const days = project ? daysRemaining(detailRevisedTargetDate || project.target_date) : null;

  if (loading) {
    return (
      <div className={styles.page}>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Loading project…
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.page}>
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-danger)' }}>
          Project not found.{' '}
          <button onClick={() => navigate('/projects')} style={{ color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const taskDone  = project.stats?.completedTasks ?? 0;
  const taskTotal = project.stats?.totalTasks     ?? 0;
  const currentPhase = project.phases?.find(p => p.status !== 'completed')?.name
    || project.phases?.[project.phases.length - 1]?.name
    || '—';

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <a href="/projects">Projects</a> &gt; <span>{project.name}</span>
      </div>

      <div className={styles.headerCard}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <div className={styles.projName}>
              {project.name}{' '}
              <Badge variant={project.status === 'active' ? 'info' : project.status === 'completed' ? 'success' : 'warning'} dot>
                {project.status || 'Unknown'}
              </Badge>{' '}
              {project.is_scope_locked ? (
                <Badge variant="success">🔒 Scope Locked</Badge>
              ) : (
                <Badge variant="warning">🔓 Scope Unlocked</Badge>
              )}
            </div>
            <div className={styles.clientName}>{project.client_name || '—'}</div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.value}>{formatValue(project.contract_value)}</div>
            {!project.is_scope_locked && project.status === 'active' && (
              <Button size="sm" onClick={handleLockScope}>Lock Scope</Button>
            )}
            {(project.status === 'completed' || project.status === 'cancelled') && (
              <Button variant="outline" size="sm" onClick={handleArchive} disabled={archiving}>
                {archiving ? 'Archiving...' : 'Archive'}
              </Button>
            )}
            {(project.status === 'completed' || project.status === 'cancelled' || project.status === 'archived') && (
              <Button variant="primary" size="sm" onClick={() => setIsReopenModalOpen(true)}>
                Reopen Project
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit</Button>
            <Button variant="outline" size="sm" style={{color: 'var(--color-danger)', borderColor: 'var(--color-danger)'}} onClick={handleDelete}>Delete</Button>
          </div>
        </div>

        <div className={styles.headerBottom}>
          {project.pm_name && (
            <div className={styles.metaItem}>
              <div className={styles.avatar}>{project.pm_name.charAt(0)}</div> PM: {project.pm_name}
            </div>
          )}
          {project.designer_name && (
            <div className={styles.metaItem}>
              <div className={styles.avatar}>{project.designer_name.charAt(0)}</div> Designer: {project.designer_name}
            </div>
          )}
          {(project.start_date || project.target_date) && (
            <div className={styles.metaItem}>📅 {formatDate(project.start_date)} → {formatDate(project.target_date)}</div>
          )}
          {project.site_address && (
            <div className={styles.metaItem} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              📍 {project.site_address}
              {project.latitude && project.longitude && (
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${project.latitude},${project.longitude}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginLeft: '8px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    background: 'var(--color-primary-bg, #e0f2fe)',
                    color: 'var(--color-primary, #0284c7)',
                    textDecoration: 'none'
                  }}
                  title="Navigate on Google Maps"
                >
                  🗺️ Navigate
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Task Progress</span>
          <span className={styles.statValue}>
            {taskDone}/{taskTotal}
            {taskTotal > 0 && (
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                {' '}({Math.round((taskDone / taskTotal) * 100)}%)
              </span>
            )}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Current Phase</span>
          <span className={styles.statValue}>{currentPhase}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Days Remaining</span>
          <span className={days !== null && days < 0 ? `${styles.statValue} ${styles.statDanger}` : styles.statValue}>
            {days === null ? '—' : days < 0 ? `Overdue ${Math.abs(days)} days` : `${days} days`}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Payment Collected</span>
          <span className={styles.statValue}>
            {formatValue(project.stats?.collectedPayment)}
            {' of '}
            {formatValue(project.stats?.netContractValue || project.contract_value)}
          </span>
        </div>
      </div>

      {/* Project Financial Summary Dashboard Panel */}
      <div className={styles.financialPanel}>
        <div className={styles.financialPanelHeader}>Financial Overview</div>
        <div className={styles.financialGrid}>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Contract Value (Net)</span>
            <span className={styles.financialValue}>
              {formatValue(project.stats?.netContractValue || project.contract_value)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Billed (Net)</span>
            <span className={styles.financialValue}>
              {formatValue(project.stats?.netBilled !== undefined ? project.stats.netBilled : project.stats?.totalPayment)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Collected (Net)</span>
            <span className={styles.financialValue} style={{ color: 'var(--color-success, #22c55e)' }}>
              {formatValue(project.stats?.netCollections !== undefined ? project.stats.netCollections : project.stats?.collectedPayment)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Outstanding Balance</span>
            <span className={styles.financialValue} style={{ color: 'var(--color-accent, #3b82f6)' }}>
              {formatValue(project.stats?.outstandingBalance !== undefined ? project.stats.outstandingBalance : (project.stats?.totalPayment - project.stats?.collectedPayment))}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Overdue Amount</span>
            <span className={`${styles.financialValue} ${project.stats?.overduePayments > 0 ? styles.financialDanger : ''}`}>
              {formatValue(project.stats?.overduePayments || 0)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Pending Invoices</span>
            <span className={styles.financialValue} style={{ color: 'var(--color-info, #0ea5e9)' }}>
              {formatValue(project.stats?.pendingInvoices || 0)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Total Cost</span>
            <span className={styles.financialValue} style={{ color: 'var(--color-danger, #ef4444)' }}>
              {formatValue(project.stats?.totalActualCost || 0)}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Gross Profit</span>
            <span className={styles.financialValue} style={{ color: (project.stats?.grossProfit || 0) >= 0 ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)' }}>
              {formatValue(project.stats?.grossProfit !== undefined ? project.stats.grossProfit : (project.stats?.netContractValue || project.contract_value))}
            </span>
          </div>
          <div className={styles.financialCard}>
            <span className={styles.financialLabel}>Gross Margin</span>
            <span className={styles.financialValue} style={{ color: (project.stats?.grossMarginPct || 0) >= 20 ? 'var(--color-success, #22c55e)' : (project.stats?.grossMarginPct || 0) >= 0 ? 'var(--color-warning, #eab308)' : 'var(--color-danger, #ef4444)' }}>
              {project.stats?.grossMarginPct !== undefined ? `${project.stats.grossMarginPct}%` : '100%'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map(t => {
          const isPendingBooking = project?.status === 'pending_booking';
          const isAllowedTab = t === 'Overview' || t === 'Booking';
          const isDisabled = isPendingBooking && !isAllowedTab;
          return (
            <button
              key={t}
              className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
              onClick={() => !isDisabled && setActiveTab(t)}
              disabled={isDisabled}
              style={{
                opacity: isDisabled ? 0.5 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer'
              }}
            >
              {isDisabled ? `🔒 ${t}` : t}
            </button>
          );
        })}
      </div>

      <div className={styles.tabContent}>
        <Suspense fallback={<div style={{ padding: 24, color: 'var(--color-text-muted)' }}>Loading…</div>}>
          {['Design Brief', 'Design Assets', 'Design Reviews'].includes(activeTab) && (
            <DesignStageHeader projectId={projectId} />
          )}
          {renderTabContent()}
        </Suspense>
      </div>

      {isEditing && (
        <ProjectForm 
          project={project} 
          onClose={() => setIsEditing(false)} 
          onSave={(updatedProject) => {
            setProject({...project, ...updatedProject});
            setIsEditing(false);
          }} 
        />
      )}

      {isReopenModalOpen && (
        <ReopenProjectModal
          projectId={project.id}
          currentStartDate={project.start_date}
          currentTargetDate={project.target_date}
          isOpen={isReopenModalOpen}
          onClose={() => setIsReopenModalOpen(false)}
          onSuccess={reloadProject}
        />
      )}
    </div>
  );
}


