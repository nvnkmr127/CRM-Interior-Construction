/* eslint-disable no-undef, react-hooks/set-state-in-effect */
import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Badge, PermissionButton } from '../../components/ui';
import { usePagePermissions } from '../../hooks/usePagePermissions';
import styles from './ProjectDetail.module.css';
import { getProject, deleteProject, updateProject, archiveProject } from '../../api/projects';
import { getProjectCoverages } from '../../api/leaveApi';
import { useAuth } from '../../store/authContext';
import { useToast } from '../../store/toastContext';
import ProjectForm from '../../components/projects/ProjectForm';
import ReopenProjectModal from '../../components/projects/ReopenProjectModal';
import CancelProjectModal from '../../components/projects/CancelProjectModal';
import PauseProjectModal from '../../components/projects/PauseProjectModal';
import ResumeProjectModal from '../../components/projects/ResumeProjectModal';
import ArchiveProjectModal from '../../components/projects/ArchiveProjectModal';
import DeleteProjectModal from '../../components/projects/DeleteProjectModal';
import { useConfirm } from '../../store/confirmContext';
import { PAYMENT_TEMPLATE_NAMES } from '../../constants/paymentTemplates';

// Lazy load tabs
const PhaseTimeline = React.lazy(() => import('../../components/projects/PhaseTimeline'));
const GanttChart = React.lazy(() => import('../../components/projects/GanttChart'));
const ProjectTasksTab = React.lazy(() => import('../../components/projects/ProjectTasksTab'));
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

const DesignPhaseTab = React.lazy(() => import('../../components/projects/DesignPhaseTab'));

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
const MaterialDeliveriesTab = React.lazy(() => import('../../components/projects/MaterialDeliveriesTab'));
const VendorPaymentsTab = React.lazy(() => import('../../components/projects/VendorPaymentsTab'));
const MaterialSubstitutionsTab = React.lazy(() => import('../../components/projects/MaterialSubstitutionsTab'));
const FactoryProductionTab = React.lazy(() => import('../../components/projects/FactoryProductionTab'));
const WorkActivitiesTab = React.lazy(() => import('../../components/projects/WorkActivitiesTab'));
const DailySiteReportsTab = React.lazy(() => import('../../components/projects/DailySiteReportsTab'));
const WeeklyReportsTab = React.lazy(() => import('../../components/projects/WeeklyReportsTab'));
const MepChecklistTab = React.lazy(() => import('../../components/projects/MepChecklistTab'));
const RoomProgressTab = React.lazy(() => import('../../components/projects/RoomProgressTab'));
const HandoverHistoryTab = React.lazy(() => import('../../components/projects/HandoverHistoryTab'));
const MeetingNotesTab = React.lazy(() => import('../../components/projects/MeetingNotesTab'));
const SiteVisitsTab = React.lazy(() => import('../../components/projects/SiteVisitsTab'));
const DelayNotificationsTab = React.lazy(() => import('../../components/projects/DelayNotificationsTab'));
const PunchListTab = React.lazy(() => import('../../components/projects/PunchListTab'));
const ExecutionQCTab = React.lazy(() => import('../../components/projects/qc/ExecutionQCTab'));
const VendorsTab = React.lazy(() => import('../../components/projects/VendorsTab'));
import HandoverModal from '../../components/projects/HandoverModal';
import DesignStageHeader from '../../components/projects/DesignStageHeader';
import ActivityLogsTab from '../../components/projects/ActivityLogsTab';
import LeadDrawer from '../../components/leads/LeadDrawer';

import FinancialOverviewPanel from '../../components/projects/FinancialOverviewPanel';

// New Editable Tabs
const TeamAndRolesTab = React.lazy(() => import('../../components/projects/TeamAndRolesTab'));
const ClientProfileTab = React.lazy(() => import('../../components/projects/ClientProfileTab'));
const SiteDetailsTab = React.lazy(() => import('../../components/projects/SiteDetailsTab'));


function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatValue(val) {
  if (val === undefined || val === null || val === '') return '—';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return val;
  if (num === 0) return '₹0';
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
}

function daysRemaining(targetDate) {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  const now = new Date();
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((targetDay - today) / (1000 * 60 * 60 * 24));
  return diff;
}

const OverviewTab = React.memo(function OverviewTab({ project, onRefresh, onEdit }) {
  const { user } = useAuth();
  const toast = useToast();
  const baseTargetDate = project.target_date ? new Date(project.target_date) : null;
  const timelineImpact = project.stats?.approvedTimelineImpactDays || 0;
  const revisedTargetDate = baseTargetDate && timelineImpact > 0 ? new Date(baseTargetDate.getTime() + timelineImpact * 24 * 60 * 60 * 1000) : null;
  const days = daysRemaining(revisedTargetDate || project.target_date);
  const [handoverState, setHandoverState] = useState({
    isOpen: false,
    role: 'pm',
    currentResourceId: '',
    currentResourceName: ''
  });
  const [projectCoverages, setProjectCoverages] = useState([]);
  const [showPastCoverages, setShowPastCoverages] = useState(false);

  useEffect(() => {
    if (!project?.id) return;
    getProjectCoverages(project.id)
      .then(data => setProjectCoverages(Array.isArray(data) ? data : []))
      .catch(() => setProjectCoverages([]));
  }, [project?.id]);

  const activeCoverages = React.useMemo(() => {
    return (projectCoverages || []).filter(cov => {
      if (!cov.end_date) return true;
      const end = new Date(cov.end_date);
      end.setHours(23, 59, 59, 999);
      return end.getTime() >= Date.now();
    });
  }, [projectCoverages]);

  const pastCoverages = React.useMemo(() => {
    return (projectCoverages || []).filter(cov => {
      if (!cov.end_date) return false;
      const end = new Date(cov.end_date);
      end.setHours(23, 59, 59, 999);
      return end.getTime() < Date.now();
    });
  }, [projectCoverages]);

  // custom_fields may hold advance_amount, payment_terms, etc from conversion form
  const parsedCf = React.useMemo(() => {
    if (!project?.custom_fields) return {};
    if (typeof project.custom_fields === 'string') {
      try {
        return JSON.parse(project.custom_fields);
      } catch {
        return {};
      }
    }
    return project.custom_fields;
  }, [project?.custom_fields]);

  const cf = parsedCf;

  const totalScheduleDays = React.useMemo(() => {
    if (!project?.start_date || !project?.target_date) return null;
    const s = new Date(project.start_date);
    const t = new Date(project.target_date);
    const diff = Math.round((t - s) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  }, [project?.start_date, project?.target_date]);

  const fields = React.useMemo(() => [
    { label: 'Project Type',    value: (project.type || project.project_type) ? (project.type || project.project_type).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '—' },
    { label: 'City',            value: project.city || '—' },
    { label: 'Project Category', value: project.project_category ? project.project_category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '—' },
    { label: 'Start Date',      value: formatDate(project.start_date) },
    { label: 'Target Date',     value: formatDate(project.target_date) },
    ...(totalScheduleDays ? [{ label: 'Total Schedule', value: `${totalScheduleDays} Days` }] : []),
    ...(timelineImpact > 0 && revisedTargetDate ? [{ label: 'Revised Target Date', value: formatDate(revisedTargetDate) }] : []),
    { label: 'Base Contract Value (Original Scope)', value: formatValue(project.stats?.originalScopeTotal || project.contract_value) },
    { label: 'Scope Additions (Change Orders)', value: formatValue(project.stats?.additionsTotal || 0) },
    { label: 'Scope Reductions (Change Orders)', value: formatValue(project.stats?.reductionsTotal || 0) },
    { label: 'Net Contract Value', value: formatValue(project.stats?.netContractValue || project.contract_value) },
    { label: 'Booking Amount',  value: project.booking_amount ? formatValue(project.booking_amount) : (cf.advance_amount ? formatValue(cf.advance_amount) : '—') },
    { label: 'Payment Terms',   value: (project.payment_terms && PAYMENT_TEMPLATE_NAMES[project.payment_terms]) || (project.payment_terms ? project.payment_terms.replace(/_/g, ' – ') : (cf.payment_terms ? (PAYMENT_TEMPLATE_NAMES[cf.payment_terms] || cf.payment_terms.replace(/_/g, ' – ')) : '—')) },
    { label: 'Status',          value: project.status ? project.status.replace(/_/g, ' ') : '—' },
  ], [project, timelineImpact, revisedTargetDate, cf, totalScheduleDays]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Timeline summary */}
      {days !== null && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: days < 0 ? 'var(--color-danger-bg)' : days <= 14 ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
          color: days < 0 ? 'var(--color-danger)' : days <= 14 ? 'var(--color-warning)' : 'var(--color-success)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <span>
            {days < 0
              ? `Project is overdue by ${Math.abs(days)} days`
              : days === 0
              ? 'Due today'
              : `${days} days remaining until target date`}
          </span>
          {totalScheduleDays && (
            <span style={{ fontSize: 'var(--text-xs)', opacity: 0.9 }}>
              Total Schedule: {totalScheduleDays} days
            </span>
          )}
        </div>
      )}

      {/* Key details grid */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Project Details
          </div>
          <Button variant="outline" size="sm" onClick={() => onEdit('details')}>
            ✏️ Edit
          </Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 0, marginRight: '-1px', marginBottom: '-1px' }}>
          {fields.map((f) => (
            <div key={f.label} style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--color-border)',
              borderRight: '1px solid var(--color-border)',
              boxSizing: 'border-box',
              minWidth: 0,
            }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {f.label}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)', textTransform: 'capitalize' }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client Profile Section */}
      <React.Suspense fallback={<div style={{ padding: '20px', color: 'var(--color-text-muted)' }}>Loading Client Profile…</div>}>
        <ClientProfileTab project={project} onRefresh={onRefresh} />
      </React.Suspense>

      {/* Site Details Section */}
      <React.Suspense fallback={<div style={{ padding: '20px', color: 'var(--color-text-muted)' }}>Loading Site Details…</div>}>
        <SiteDetailsTab project={project} onRefresh={onRefresh} />
      </React.Suspense>

      {/* Design Stage Revisions Tracker */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>Project Revision Controls & Stage Limits</h3>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Global project revision caps and active consumption per design stage.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onEdit('revisions')}>
            ✏️ Edit
          </Button>
        </div>

        {/* Global Revision Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
          <div style={{ background: 'var(--color-accent-bg, #eff6ff)', border: '1px solid var(--color-accent, #3b82f6)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allowed Design Revisions</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
              {project.allowed_design_revisions !== undefined && project.allowed_design_revisions !== null ? project.allowed_design_revisions : 3}
            </div>
          </div>
          <div style={{ background: 'var(--color-surface-hover, #f8fafc)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Design Revisions</div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
              {project.current_design_revisions !== undefined && project.current_design_revisions !== null ? project.current_design_revisions : 0}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {[
            'Requirement Gathering',
            'Concept Presentation',
            'Concept Approval',
            'Detailed Design',
            'Client Review',
            'Revision Rounds',
            'Design Freeze'
          ].map(stage => {
            const limit = project.stage_revision_limits?.[stage] ?? 3;
            const count = project.stage_revision_counts?.[stage] ?? 0;
            const isExceeded = count > limit;
            const isApproaching = count === limit - 1 && limit > 1;

            let cardBg = 'var(--color-surface-hover, #fafafa)';
            let borderColor = 'var(--color-border)';
            let textColor = 'var(--color-text)';

            if (isExceeded) {
              cardBg = 'var(--color-danger-bg, #fef2f2)';
              borderColor = 'var(--color-danger, #ef4444)';
              textColor = 'var(--color-danger, #b91c1c)';
            } else if (isApproaching) {
              cardBg = 'var(--color-warning-bg, #fef9c3)';
              borderColor = 'var(--color-warning, #eab308)';
              textColor = 'var(--color-warning, #854d0e)';
            }

            return (
              <div key={stage} style={{
                background: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                position: 'relative'
              }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  {stage}
                </div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: textColor, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  {count} <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-muted)' }}>/ {limit} allowed</span>
                </div>
                {isExceeded && (
                  <span style={{ fontSize: '9px', fontWeight: 600, color: '#b91c1c', textTransform: 'uppercase', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start', marginTop: '4px' }}>
                    Limit Exceeded
                  </span>
                )}
                {isApproaching && (
                  <span style={{ fontSize: '9px', fontWeight: 600, color: '#854d0e', textTransform: 'uppercase', background: '#fef9c3', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start', marginTop: '4px' }}>
                    1 Round Left
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Team & Roles Section */}
      <React.Suspense fallback={<div style={{ padding: '20px', color: 'var(--color-text-muted)' }}>Loading Team & Roles…</div>}>
        <TeamAndRolesTab project={project} onRefresh={onRefresh} />
      </React.Suspense>

      {/* Active Colleague Handover & Coverage Banner */}
      {activeCoverages.length > 0 && (
        <div style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--color-border, #e5e1d8)',
          borderLeft: '4px solid var(--color-accent, #e8935a)',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))'
        }}>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-sm, 14px)', color: 'var(--color-text, #1c1c1e)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🌴 Temporary Colleague Handover & Coverage</span>
              <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>Active Delegation</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted, #9ca3af)', fontWeight: 500 }}>
              {activeCoverages.length} {activeCoverages.length === 1 ? 'delegation' : 'delegations'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeCoverages.map(cov => {
              const isCovering = String(user?.id) === String(cov.covering_user_id);
              return (
                <div key={cov.id} style={{ fontSize: 'var(--text-sm, 13px)', color: 'var(--color-text-secondary, #4b5563)', background: isCovering ? 'var(--color-accent-bg, #eff6ff)' : 'var(--color-surface-2, #f9fafb)', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${isCovering ? 'var(--color-accent, #bfdbfe)' : 'var(--color-border, #e5e7eb)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ color: 'var(--color-text, #111827)' }}>{cov.covering_user_name}</strong> ({cov.covering_role || 'Team Member'}) is covering for <strong style={{ color: 'var(--color-text, #111827)' }}>{cov.on_leave_user_name}</strong> ({cov.on_leave_role || 'Colleague on Leave'})
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--color-text-muted, #9ca3af)' }}>
                        ({new Date(cov.start_date).toLocaleDateString()} – {new Date(cov.end_date).toLocaleDateString()})
                      </span>
                    </div>
                    {isCovering && (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: '4px' }}>
                        You are covering this
                      </span>
                    )}
                  </div>
                  {cov.handover_notes && (
                    <div style={{ marginTop: '6px', fontStyle: 'italic', fontSize: '13px', color: 'var(--color-text, #374151)', background: 'var(--color-surface, #ffffff)', padding: '6px 10px', borderRadius: '4px', border: '1px dashed var(--color-border, #e5e7eb)' }}>
                      Handover Notes: "{cov.handover_notes}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed / Past Delegations History (Collapsible) */}
      {pastCoverages.length > 0 && (
        <div style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid var(--color-border, #e5e1d8)',
          padding: '12px 18px',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.03))'
        }}>
          <div 
            onClick={() => setShowPastCoverages(!showPastCoverages)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary, #6b7280)' }}>
              <span>📜 Completed Coverage History ({pastCoverages.length})</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {showPastCoverages ? '▲ Hide History' : '▼ View History'}
            </span>
          </div>

          {showPastCoverages && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border, #e5e7eb)' }}>
              {pastCoverages.map(cov => (
                <div key={cov.id} style={{ fontSize: '12px', color: 'var(--color-text-muted, #6b7280)', background: 'var(--color-surface-2, #f9fafb)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border, #e5e7eb)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <div>
                    <strong>{cov.covering_user_name}</strong> covered for <strong>{cov.on_leave_user_name}</strong> ({cov.on_leave_role || 'Team Member'})
                    <span style={{ marginLeft: '8px', fontSize: '11px' }}>
                      ({new Date(cov.start_date).toLocaleDateString()} – {new Date(cov.end_date).toLocaleDateString()})
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', background: '#f3f4f6', color: '#6b7280', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    Expired / Completed
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stakeholders & Contacts */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Project Stakeholders & Contacts
          </div>
          <Button variant="outline" size="sm" onClick={() => onEdit('contacts')}>
            ✏️ Edit
          </Button>
        </div>
        {project.contacts && project.contacts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {project.contacts.map((contact, i) => (
              <div key={contact.id || i} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: i < project.contacts.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--color-accent-bg, #eff6ff)', color: 'var(--color-accent, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 'var(--text-xs)',
                  }}>
                    👤
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{contact.name}</span>
                      <span style={{
                        padding: '1px 6px',
                        fontSize: '10px',
                        borderRadius: '4px',
                        background: 'var(--color-accent-bg, #eff6ff)',
                        color: 'var(--color-accent, #3b82f6)',
                        fontWeight: 600,
                        textTransform: 'capitalize'
                      }}>
                        {contact.role ? contact.role.replace(/_/g, ' ') : 'Stakeholder'}
                      </span>
                      <span style={{
                        padding: '1px 6px',
                        fontSize: '10px',
                        borderRadius: '4px',
                        background: 'var(--color-success-bg, #f0fdf4)',
                        color: 'var(--color-success, #22c55e)',
                        fontWeight: 600
                      }}>
                        {contact.decision_authority || 'Influencer'}
                      </span>
                      {contact.contact_preference && (
                        <span style={{
                          padding: '1px 6px',
                          fontSize: '10px',
                          borderRadius: '4px',
                          background: 'var(--color-info-bg, #e0f2fe)',
                          color: 'var(--color-info, #0284c7)',
                          fontWeight: 600
                        }}>
                          💬 {contact.contact_preference}
                        </span>
                      )}
                      {contact.approval_authority_level && (
                        <span style={{
                          padding: '1px 6px',
                          fontSize: '10px',
                          borderRadius: '4px',
                          background: 'var(--color-warning-bg, #fef9c3)',
                          color: 'var(--color-warning, #854d0e)',
                          fontWeight: 600
                        }}>
                          🔑 {contact.approval_authority_level}
                        </span>
                      )}
                    </div>
                    {contact.relationship_notes && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                        📝 {contact.relationship_notes}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                  {contact.phone && <div>📞 {contact.phone}</div>}
                  {contact.email && <div>✉️ {contact.email}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            No additional stakeholders recorded for this project. Click "Edit" to add contacts.
          </div>
        )}
      </div>


      {/* Project Notes */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>Project Notes & Special Instructions</div>
          <Button variant="outline" size="sm" onClick={() => onEdit('details')}>
            ✏️ Edit
          </Button>
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: project.notes ? 'var(--color-text-secondary)' : 'var(--color-text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {project.notes || 'No specific notes or special instructions recorded for this project.'}
        </div>
      </div>

      {project && (
        <HandoverModal
          projectId={project.id}
          role={handoverState.role}
          currentResourceId={handoverState.currentResourceId}
          currentResourceName={handoverState.currentResourceName}
          isOpen={handoverState.isOpen}
          onClose={() => setHandoverState(prev => ({ ...prev, isOpen: false }))}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
});

const ALL_PROJECT_TABS = [
  // 1. Initiation & Setup (Scratch)
  'Overview', 'Phases & Schedule', 'Client Profile', 'Site Details', 'Team & Roles', 'Booking', 'Baseline Assessment',
  
  // 2. Design, Planning & Architectural Drawings
  'Design & Approvals', 'Drawing Register', 'Design Brief', 'Design Assets', 'Design Reviews', 'Material Palettes', 'Substitutions', 'Coordination',
  
  // 3. Financials, Budget & Client Cash Flow
  'Financial Overview', 'Budget', 'Quotations & Budget', 'Payments', 'Change Orders', 'Budget Variance', 'Commercial Approval',
  
  // 4. Procurement & Vendor Sourcing
  'Purchase Requests', 'Purchase Orders', 'Vendors', 'Material Deliveries', 'Factory Production',
  
  // 5. Execution & Site Monitoring
  'Tasks', 'Room Progress', 'Site Visits', 'Daily Site Reports', 'Weekly Reports', 'Documents', 'Meeting Notes', 'Delay Notifications', 'MEP Checklist',
  
  // 6. Quality Control, Snags & Readiness (Pre-Handover)
  'Snags', 'Handover Readiness', 'Handovers',
  
  // 7. Property Handover (Completion)
  'Handover',
  
  // 8. Project Closure & Retrospective
  'Project Closure', 'Retrospective',
  
  // 9. Post-Handover & Maintenance
  'Warranties', 'AMCs', 'Service Tickets', 'Customer Retention',
  
  // 10. Audit & Activity Logs
  'Activity Logs'
];

export default function ProjectDetail() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const navRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { canAccessPage } = usePagePermissions('projects');
  const allowedTabs = ALL_PROJECT_TABS.filter(tab => canAccessPage(tab));
  const tabs = allowedTabs;
  const currentTabParam = searchParams.get('tab');
  const savedMainTab = (() => {
    try {
      return sessionStorage.getItem(`tab:proj:${projectId}:main_tab`);
    } catch (e) { return null; }
  })();
  const effectiveTab = currentTabParam || savedMainTab || 'Overview';
  const activeTab = (allowedTabs.includes(effectiveTab) || canAccessPage(effectiveTab)) ? effectiveTab : 'Overview';

  useEffect(() => {
    try {
      sessionStorage.setItem(`tab:proj:${projectId}:main_tab`, activeTab);
    } catch (e) {}
    if (!currentTabParam && activeTab) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', activeTab);
        return next;
      }, { replace: true });
    }
  }, [projectId, activeTab, currentTabParam, setSearchParams]);
  
  const setActiveTab = (tab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      try {
        const savedSub = sessionStorage.getItem(`tab:proj:${projectId}:${tab}:subtab`);
        if (savedSub) {
          next.set('subtab', savedSub);
        } else {
          next.delete('subtab');
        }
      } catch (e) {}
      return next;
    }, { replace: true });

    try {
      sessionStorage.setItem(`tab:proj:${projectId}:main_tab`, tab);
    } catch (e) {}
  };
  
  useEffect(() => {
    if (navRef.current) {
      const activeElement = navRef.current.querySelector(`.${styles.headerNavItemActive}`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);
  
  const cacheKey = `crm:proj:${projectId}`;
  const [project, setProject] = useState(() => {
    try {
      const saved = sessionStorage.getItem(cacheKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [loading, setLoading] = useState(!project);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSection, setEditingSection] = useState('all');
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeLeadDrawerId, setActiveLeadDrawerId] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const { confirm } = useConfirm();

  const handleOpenLeadClick = async () => {
    let targetLeadId = project?.lead_id;
    if (!targetLeadId) {
      const searchName = project?.client_name || project?.name;
      if (searchName) {
        try {
          const res = await api.get(`/leads?search=${encodeURIComponent(searchName)}&limit=10`);
          const list = res.data?.data || res.data || [];
          if (Array.isArray(list) && list.length > 0) {
            const match = list.find(l => l.name?.toLowerCase() === searchName.toLowerCase()) || list[0];
            targetLeadId = match.id;
          }
        } catch (err) {
          console.error('Failed to search lead by client name:', err);
        }
      }
    }

    if (targetLeadId) {
      navigate(`/leads?leadId=${targetLeadId}`);
    } else if (project?.client_name) {
      navigate(`/leads?search=${encodeURIComponent(project.client_name)}`);
    } else {
      toast.error('Lead details not found for this project');
    }
  };

  const handleArchive = () => {
    setIsArchiveModalOpen(true);
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handleLockScope = async () => {
    const isConfirmed = await confirm({
      title: 'Lock Design Scope',
      message: 'Are you sure you want to lock the design scope? Once locked, execution can proceed.',
      confirmText: 'Lock Scope',
      cancelText: 'Cancel'
    });
    if (isConfirmed) {
      try {
        await updateProject(projectId, { is_scope_locked: true });
        setProject(prev => ({ ...prev, is_scope_locked: true }));
      } catch (e) {
        console.error('Failed to lock scope', e);
        alert('Failed to lock scope. Please ensure all conditions are met.');
      }
    }
  };


  const reloadProject = () => {
    if (!projectId) return;
    getProject(projectId)
      .then(res => {
        const data = res.data?.data || res.data || null;
        setProject(data);
        if (data) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
        }
      })
      .catch((err) => {
        console.error('Failed to reload project details:', err);
        setProject(null);
      });
  };

  useEffect(() => {
    if (!projectId) return;
    if (!project || project.id !== projectId) setLoading(true);
    getProject(projectId)
      .then(res => {
        const data = res.data?.data || res.data || null;
        setProject(data);
        if (data) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
        }
      })
      .catch((err) => {
        console.error('Failed to load project details:', err);
        if (!project || project.id !== projectId) setProject(null);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    const handleDbChange = () => {
      reloadProject();
    };
    window.addEventListener('app:mock-db-change', handleDbChange);
    return () => window.removeEventListener('app:mock-db-change', handleDbChange);
  }, [projectId]);

  useEffect(() => {
    if (navRef.current) {
      const activeElement = navRef.current.querySelector(`.${styles.headerNavItemActive}`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);


  const renderTabContent = () => {
    switch (activeTab) {
      case 'Overview': return project ? <OverviewTab project={project} onRefresh={reloadProject} onEdit={(section = 'all') => { setEditingSection(section); setIsEditing(true); }} /> : null;
      case 'Phases & Schedule': return <PhaseTimeline projectId={projectId} project={project} onNavigateTab={setActiveTab} onProjectUpdate={reloadProject} />;
      case 'Team & Roles': return <TeamAndRolesTab project={project} onRefresh={reloadProject} />;
      case 'Client Profile': return <ClientProfileTab project={project} onRefresh={reloadProject} />;
      case 'Site Details': return <SiteDetailsTab project={project} onRefresh={reloadProject} />;
      case 'Activity Logs': return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">Activity Logs</h3>
          </div>
          <div className="p-6">
            <ActivityLogsTab projectId={projectId} />
          </div>
        </div>
      );
      case 'Financial Overview': return <FinancialOverviewPanel project={project} projectId={projectId} />;
      case 'Booking': return <BookingTab projectId={projectId} projectStatus={project?.status} onProjectUpdated={reloadProject} />;
      case 'Meeting Notes': return <MeetingNotesTab projectId={projectId} projectStatus={project?.status} />;
      case 'Site Visits': return <SiteVisitsTab projectId={projectId} projectStatus={project?.status} />;
      case 'Vendors': return <VendorsTab projectId={projectId} />;
      case 'Baseline Assessment': return <BaselineAssessmentTab projectId={projectId} />;
      case 'Delay Notifications': return <DelayNotificationsTab projectId={projectId} />;
      case 'Handovers': return <HandoverHistoryTab projectId={projectId} />;
      case 'Design & Approvals': return <DesignPhaseTab projectId={projectId} project={project} onRefresh={reloadProject} />;
      case 'Change Orders': return <ChangeOrdersTab projectId={projectId} />;
      case 'Budget Variance': return <BOQVarianceTab projectId={projectId} />;
      case 'Budget': return <BudgetTab projectId={projectId} />;
      case 'Purchase Requests': return <PurchaseRequestsTab projectId={projectId} />;
      case 'Purchase Orders & Vendor Payments':
      case 'Purchase Orders': return <PurchaseOrdersTab projectId={projectId} />;
      case 'Material Deliveries': return <MaterialDeliveriesTab projectId={projectId} />;
      case 'Vendor Payments': return <VendorPaymentsTab projectId={projectId} />;
      case 'Substitutions': return <MaterialSubstitutionsTab projectId={projectId} />;
      case 'Factory Production': return <FactoryProductionTab projectId={projectId} />;
      case 'Coordination': return <CoordinationTab projectId={projectId} projectStatus={project?.status} onProjectUpdated={reloadProject} />;
      case 'Work Activities': return <WorkActivitiesTab projectId={projectId} project={project} />;
      case 'Room Progress': return <RoomProgressTab projectId={projectId} />;
      case 'Tasks': return <ProjectTasksTab projectId={projectId} project={project} onTaskUpdated={reloadProject} />;
      case 'daily Site Reports':
      case 'Daily Site Reports': return <DailySiteReportsTab projectId={projectId} />;
      case 'Weekly Reports': return <WeeklyReportsTab projectId={projectId} />;
      case 'Documents': return <DocumentPanel projectId={projectId} projectStatus={project?.status} />;
      case 'Drawing Register': return <DrawingRegisterTab projectId={projectId} />;
      case 'MEP Checklist': return <MepChecklistTab projectId={projectId} />;
      case 'Payments': return <PaymentsTab projectId={projectId} project={project} onProjectUpdated={reloadProject} />;
      case 'Snags': return <SnagsDashboard projectId={projectId} projectStatus={project?.status} />;
      case 'Handover': return <HandoverChecklist projectId={projectId} />;
      case 'Punch List': return <PunchListTab projectId={projectId} projectStatus={project?.status} />;
      case 'Warranties': return <WarrantiesTab projectId={projectId} />;
      case 'AMCs': return <AmcsTab projectId={projectId} />;
      case 'Handover Readiness': return <HandoverReadinessTab projectId={projectId} />;
      case 'Service Tickets': return <ServiceTicketsTab projectId={projectId} />;
      case 'Customer Retention': return <CustomerRetentionTab projectId={projectId} onNavigateTab={setActiveTab} />;
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
  const isBookingPaid = project.payment_milestones?.some(m => 
    (/booking|advance|token/i.test(m.name || '') || m.sort_order === 1) && 
    (m.status === 'paid' || Number(m.paid_amount || 0) > 0)
  );
  const effectiveStatus = (project.status === 'pending_booking' && isBookingPaid) ? 'active' : (project.status || 'active');
  const currentPhase = project.status === 'completed'
    ? 'Completed'
    : (project.phases?.find(p => p.status !== 'completed')?.name
       || project.phases?.[project.phases.length - 1]?.name
       || (effectiveStatus ? effectiveStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '—'));

  if (!canAccessPage(activeTab)) {
    return (
      <div className={styles.page}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>Access Denied</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
            You do not have permission to view the <strong>{activeTab}</strong> page.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {allowedTabs.length > 0 && (
              <Button variant="primary" onClick={() => setActiveTab(allowedTabs[0])}>
                Go to {allowedTabs[0]}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/projects')}>
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <a href="/projects">Projects</a> &gt; <span>{project.name}</span>
      </div>

      {/* Status Banners */}
      {project.status === 'on_hold' && (
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          marginBottom: '20px',
          color: '#92400e',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>
            <span>⏸️</span> Project is Paused (On Hold)
          </div>
          <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div><strong>Reason:</strong> {project.on_hold_reason || 'No reason provided.'}</div>
            {project.expected_resume_date && (
              <div><strong>Expected Resume Date:</strong> {new Date(project.expected_resume_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            )}
            {project.resource_release_instructions && (
              <div><strong>Resource Instructions:</strong> {project.resource_release_instructions}</div>
            )}
            {project.site_security_plan && (
              <div><strong>Site Security Plan:</strong> {project.site_security_plan}</div>
            )}
          </div>
        </div>
      )}

      {project.status === 'archived' && (
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          marginBottom: '20px',
          color: '#1e40af',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>
            <span>📦</span> Project is Archived
          </div>
          <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div><strong>Reason:</strong> {project.archive_reason || 'No reason provided.'}</div>
            {project.archived_at && (
              <div><strong>Archived At:</strong> {new Date(project.archived_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            )}
          </div>
        </div>
      )}

      {project.deleted_at && (
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          marginBottom: '20px',
          color: '#991b1b',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>
            <span>🗑️</span> Project is Deleted
          </div>
          <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div><strong>Reason:</strong> {project.delete_reason || 'No reason provided.'}</div>
            <div><strong>Deleted At:</strong> {new Date(project.deleted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      )}

      <div className={styles.headerCard}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <div className={styles.projName}>
              {project.name}{' '}
              <Badge variant={effectiveStatus === 'active' ? 'info' : effectiveStatus === 'completed' ? 'success' : 'warning'} dot>
                {effectiveStatus ? effectiveStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown'}
              </Badge>{' '}
              {project.is_scope_locked ? (
                <Badge variant="success">🔒 Scope Locked</Badge>
              ) : (
                <Badge variant="warning">🔓 Scope Unlocked</Badge>
              )}
            </div>
            <div className={styles.clientName} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleOpenLeadClick}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  color: 'var(--color-accent, #2563eb)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: 'inherit'
                }}
                title={`View Lead details for ${project.client_name || 'client'}`}
              >
                {project.client_name || 'View Lead'}
              </button>
              {(project.type || project.project_type) && (
                <span style={{ 
                  background: 'var(--color-surface-hover, #f1f5f9)', 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary, #475569)',
                  border: '1px solid var(--color-border, #e2e8f0)'
                }}>
                  {(project.type || project.project_type).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              )}
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.value}>{formatValue(project.stats?.netContractValue || project.contract_value)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PermissionButton module="projects" action="edit">
                <Button variant="outline" size="sm" onClick={() => { setEditingSection('all'); setIsEditing(true); }}>
                  ✏️ Edit
                </Button>
              </PermissionButton>
              
              <div style={{ position: 'relative' }}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setActionsOpen(!actionsOpen)}
                >
                  Actions ▾
                </Button>
              
              {actionsOpen && (
                <>
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
                    onClick={() => setActionsOpen(false)} 
                  />
                  <div style={{ 
                    position: 'absolute', 
                    right: 0, 
                    top: 'calc(100% + 4px)', 
                    background: 'var(--color-surface, #fff)', 
                    border: '1px solid var(--color-border)', 
                    borderRadius: 'var(--radius-md)', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                    zIndex: 50,
                    minWidth: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '4px 0',
                    overflow: 'hidden'
                  }}>
                    <style>{`
                      .action-dropdown-item {
                        padding: 8px 16px;
                        background: none;
                        border: none;
                        text-align: left;
                        width: 100%;
                        cursor: pointer;
                        font-size: 13px;
                        color: var(--color-text);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                      }
                      .action-dropdown-item:hover {
                        background: var(--color-surface-hover, #f3f4f6);
                      }
                    `}</style>
                    {!project.is_scope_locked && project.status === 'active' && (
                      <PermissionButton module="projects" action="edit">
                        <button className="action-dropdown-item" onClick={() => { setActionsOpen(false); handleLockScope(); }}>
                          🔒 Lock Scope
                        </button>
                      </PermissionButton>
                    )}
                    {project.status === 'active' && (
                      <button className="action-dropdown-item" onClick={() => { setActionsOpen(false); setIsPauseModalOpen(true); }}>
                        ⏸️ Pause Project
                      </button>
                    )}
                    {project.status === 'on_hold' && (
                      <button className="action-dropdown-item" onClick={() => { setActionsOpen(false); setIsResumeModalOpen(true); }}>
                        ▶️ Resume Project
                      </button>
                    )}
                    {(project.status === 'completed' || project.status === 'cancelled') && (
                      <PermissionButton module="projects" action="archive">
                        <button className="action-dropdown-item" onClick={() => { setActionsOpen(false); handleArchive(); }} disabled={archiving}>
                          📦 {archiving ? 'Archiving...' : 'Archive Project'}
                        </button>
                      </PermissionButton>
                    )}
                    {(project.status === 'completed' || project.status === 'cancelled' || project.status === 'archived') && (
                      <button className="action-dropdown-item" onClick={() => { setActionsOpen(false); setIsReopenModalOpen(true); }}>
                        🔄 Reopen Project
                      </button>
                    )}
                    
                    <div style={{ height: '1px', background: 'var(--color-border)', margin: '4px 0' }} />
                    
                    {(project.status === 'active' || project.status === 'on_hold') && (
                      <PermissionButton module="projects" action="cancel">
                        <button className="action-dropdown-item" style={{ color: 'var(--color-danger)' }} onClick={() => { setActionsOpen(false); setIsCancelModalOpen(true); }}>
                          🚫 Cancel Project
                        </button>
                      </PermissionButton>
                    )}
                    <PermissionButton module="projects" action="delete">
                      <button className="action-dropdown-item" style={{ color: 'var(--color-danger)' }} onClick={() => { setActionsOpen(false); handleDelete(); }}>
                          🗑️ Delete Project
                      </button>
                    </PermissionButton>
                  </div>
                </>
              )}
            </div>
            </div>
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
          {(project.site_address || (project.latitude && project.longitude) || project.street) && (
            <div className={styles.metaItem} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              📍 {project.site_address || [project.flat_number, project.building_name, project.street, project.city].filter(Boolean).join(', ')}
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${
                  project.latitude && project.longitude
                    ? `${project.latitude},${project.longitude}`
                    : encodeURIComponent(project.site_address || [project.flat_number, project.building_name, project.street, project.landmark, project.city, project.pincode].filter(Boolean).join(', '))
                }`} 
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
            </div>
          )}
        </div>

        {/* Stats Grid */}
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
              {formatValue(project.stats?.collectedPayment || 0)}
              {' of '}
              {formatValue(project.stats?.netContractValue || Number(project.contract_value || 0) || (Number(project.booking_amount || 0) > 0 ? Number(project.booking_amount) * 10 : 0) || 0)}
            </span>
          </div>
        </div>

        <div className={styles.headerNav} ref={navRef}>
          {[
            // 1. Initiation & Master Schedule (Scratch)
            { id: 'Overview', icon: '📝', label: 'Overview' },
            { id: 'Phases & Schedule', icon: '📅', label: 'Phases & Schedule' },

            // 2. Design & Architectural Drawings
            { id: 'Design & Approvals', icon: '🎨', label: 'Design & Approvals' },
            { id: 'Drawing Register', icon: '📐', label: 'Drawing Register' },

            // 3. Commercials, Budget & Client Cash Flow
            { id: 'Budget', icon: '📊', label: 'Budget' },
            { id: 'Payments', icon: '💸', label: 'Payments' },
            { id: 'Change Orders', icon: '📝', label: 'Change Orders' },

            // 4. Procurement & Vendor Sourcing
            { id: 'Purchase Orders', icon: '🛒', label: 'Purchase Orders' },

            // 5. Site Execution & Field Monitoring
            { id: 'Tasks', icon: '✅', label: 'Tasks' },
            { id: 'Room Progress', icon: '🚪', label: 'Room Progress' },
            { id: 'Site Visits', icon: '🚶', label: 'Site Visits' },
            { id: 'Daily Site Reports', icon: '📋', label: 'Daily Site Reports' },
            { id: 'Weekly Reports', icon: '📈', label: 'Weekly Reports' },
            { id: 'Documents', icon: '📁', label: 'Documents' },

            // 6. Quality Control, Snags & Readiness (Pre-Handover)
            { id: 'Snags', icon: '⚠️', label: 'Snags' },
            { id: 'Handover Readiness', icon: '🚦', label: 'Handover Readiness' },

            // 7. Property Handover (Completion)
            { id: 'Handover', icon: '📦', label: 'Handover Checklist' },

            // 8. Project Closure & Retrospective
            { id: 'Project Closure', icon: '🔑', label: 'Project Closure' },
            { id: 'Retrospective', icon: '💡', label: 'Retrospective' },

            // 9. Post-Handover & Maintenance
            { id: 'Warranties', icon: '🛡️', label: 'Warranties' },
            { id: 'AMCs', icon: '🛠️', label: 'AMCs' },
            { id: 'Service Tickets', icon: '🎫', label: 'Service Tickets' },
            { id: 'Customer Retention', icon: '🔄', label: 'Customer Retention' },

            // 10. Audit & Activity Logs
            { id: 'Activity Logs', icon: '📜', label: 'Activity Logs' }
          ].filter(tab => canAccessPage(tab.id)).map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`${styles.headerNavItem} ${isActive ? styles.headerNavItemActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className={styles.headerNavIcon}>{tab.icon}</span>
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>





      <div className={styles.tabContent}>
        <Suspense fallback={<div style={{ padding: 24, color: 'var(--color-text-muted)' }}>Loading…</div>}>

          {renderTabContent()}
        </Suspense>
      </div>

      {isEditing && (
        <ProjectForm 
          editSection={editingSection}
          isOpen={true}
          project={project} 
          onClose={() => setIsEditing(false)} 
          onSave={() => {
            setIsEditing(false);
            reloadProject();
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

      {isPauseModalOpen && (
        <PauseProjectModal
          projectId={project.id}
          isOpen={isPauseModalOpen}
          onClose={() => setIsPauseModalOpen(false)}
          onSuccess={reloadProject}
        />
      )}

      {isResumeModalOpen && (
        <ResumeProjectModal
          projectId={project.id}
          isOpen={isResumeModalOpen}
          onClose={() => setIsResumeModalOpen(false)}
          onSuccess={reloadProject}
        />
      )}

      {isCancelModalOpen && (
        <CancelProjectModal
          projectId={project.id}
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          onSuccess={reloadProject}
        />
      )}

      {isArchiveModalOpen && (
        <ArchiveProjectModal
          projectId={project.id}
          isOpen={isArchiveModalOpen}
          onClose={() => setIsArchiveModalOpen(false)}
          onSuccess={reloadProject}
        />
      )}

      {isDeleteModalOpen && (
        <DeleteProjectModal
          projectId={project.id}
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onSuccess={() => navigate('/projects')}
        />
      )}

      {activeLeadDrawerId && (
        <LeadDrawer
          leadId={activeLeadDrawerId}
          isOpen={Boolean(activeLeadDrawerId)}
          onClose={() => setActiveLeadDrawerId(null)}
          onLeadUpdated={reloadProject}
        />
      )}
    </div>
  );
}
