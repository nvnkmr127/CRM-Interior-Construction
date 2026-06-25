import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Badge } from '../../components/ui';
import styles from './ProjectDetail.module.css';
import { getProject, deleteProject, updateProject } from '../../api/projects';
import ProjectForm from '../../components/projects/ProjectForm';

// Lazy load tabs
const PhaseTimeline = React.lazy(() => import('../../components/projects/PhaseTimeline'));
const TaskKanban = React.lazy(() => import('../../components/tasks/TaskKanban'));
const DocumentPanel = React.lazy(() => import('../../components/projects/DocumentPanel'));
const PaymentsTab = React.lazy(() => import('./PaymentsTab'));
const SnagsDashboard = React.lazy(() => import('./SnagsDashboard'));
const HandoverChecklist = React.lazy(() => import('./HandoverChecklist'));

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatValue(val) {
  if (!val) return '—';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.]/g, ''));
  if (isNaN(num)) return val;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
}

function daysRemaining(targetDate) {
  if (!targetDate) return null;
  const diff = Math.ceil((new Date(targetDate) - Date.now()) / 86400000);
  return diff;
}

function OverviewTab({ project }) {
  const days = daysRemaining(project.target_date);

  // custom_fields may hold advance_amount, payment_terms, etc from conversion form
  const cf = project.custom_fields || {};

  const fields = [
    { label: 'Project Type',    value: project.project_type ? project.project_type.replace(/_/g, ' ') : '—' },
    { label: 'Site Address',    value: project.site_address || '—' },
    { label: 'Start Date',      value: formatDate(project.start_date) },
    { label: 'Target Date',     value: formatDate(project.target_date) },
    { label: 'Contract Value',  value: formatValue(project.contract_value) },
    { label: 'Status',          value: project.status ? project.status.replace(/_/g, ' ') : '—' },
    { label: 'Client Phone',    value: project.client_phone || '—' },
    { label: 'Client Email',    value: project.client_email || '—' },
    { label: 'Booking Amount',  value: project.booking_amount ? formatValue(project.booking_amount) : (cf.advance_amount ? formatValue(cf.advance_amount) : '—') },
    { label: 'Payment Terms',   value: project.payment_terms ? project.payment_terms.replace(/_/g, ' – ') : (cf.payment_terms ? cf.payment_terms.replace(/_/g, ' – ') : '—') },
    { label: 'Agreement Signed By', value: project.agreement_signed_by || '—' },
    { label: 'Agreement Signed Date', value: formatDate(project.agreement_signed_at) },
    { label: 'Signature Method', value: project.agreement_signature_method ? project.agreement_signature_method.replace(/_/g, ' ') : '—' },
  ];

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
        }}>
          {days < 0
            ? `Project is overdue by ${Math.abs(days)} days`
            : days === 0
            ? 'Due today'
            : `${days} days remaining until target date`}
        </div>
      )}

      {/* Key details grid */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          Project Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 0 }}>
          {fields.map((f, i) => (
            <div key={f.label} style={{
              padding: '14px 20px',
              borderBottom: i < fields.length - 2 ? '1px solid var(--color-border)' : 'none',
              borderRight: (i % 2 === 0) ? '1px solid var(--color-border)' : 'none',
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

      {/* Team */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
          Team
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          {[
            { role: 'Project Manager', name: project.pm_name },
            { role: 'Designer', name: project.designer_name },
          ].filter(m => m.name).map(member => (
            <div key={member.role} style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 200px', borderRight: '1px solid var(--color-border)' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--color-accent)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 'var(--text-sm)', flexShrink: 0,
              }}>
                {(member.name || '?').charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{member.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{member.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-Conversion Checklist — only shown for converted leads */}
      {project.lead_id && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Pre-Conversion Checklist
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {[
              { key: 'booking_received',      label: 'Booking amount received' },
              { key: 'floor_plan',            label: 'Floor plan attached' },
              { key: 'scope_finalized',       label: 'Scope finalized' },
              { key: 'contract_signed',       label: 'Signed contract attached' },
              { key: 'site_address_confirmed',label: 'Site address confirmed' },
            ].map((item, i) => {
              const checked = cf[item.key] === true || cf[item.key] === 'true';
              return (
                <div key={item.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 20px',
                  borderBottom: i < 4 ? '1px solid var(--color-border)' : 'none',
                  borderRight: (i % 2 === 0) ? '1px solid var(--color-border)' : 'none',
                }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: checked ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                    color: checked ? 'var(--color-success)' : 'var(--color-danger)',
                    fontWeight: 700, fontSize: 13, flexShrink: 0,
                  }}>
                    {checked ? '✓' : '✗'}
                  </span>
                  <span style={{ fontSize: 'var(--text-sm)', color: checked ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {project.notes && (
        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: '16px 20px' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 8 }}>Notes</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{project.notes}</div>
        </div>
      )}
    </div>
  );
}


export default function ProjectDetail() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject(projectId);
        navigate('/projects');
      } catch (e) {
        console.error('Failed to delete project', e);
      }
    }
  };

  const handleLockScope = async () => {
    if (window.confirm('Are you sure you want to lock the design scope? Once locked, execution can proceed.')) {
      try {
        await updateProject(projectId, { is_scope_locked: true });
        setProject(prev => ({ ...prev, is_scope_locked: true }));
      } catch (e) {
        console.error('Failed to lock scope', e);
        alert('Failed to lock scope. Please ensure all conditions are met.');
      }
    }
  };

  const tabs = ['Overview', 'Phases', 'Tasks', 'Documents', 'Payments', 'Snags', 'Handover'];

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getProject(projectId)
      .then(res => setProject(res.data?.data || res.data || null))
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Overview': return project ? <OverviewTab project={project} /> : null;
      case 'Phases': return <PhaseTimeline projectId={projectId} />;
      case 'Tasks': return <TaskKanban projectId={projectId} />;
      case 'Documents': return <DocumentPanel projectId={projectId} />;
      case 'Payments': return <PaymentsTab projectId={projectId} />;
      case 'Snags': return <SnagsDashboard projectId={projectId} />;
      case 'Handover': return <HandoverChecklist projectId={projectId} />;
      default: return <div>{activeTab} Content (Coming Soon)</div>;
    }
  };

  const days = project ? daysRemaining(project.target_date) : null;

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
            {!project.is_scope_locked && (
              <Button size="sm" onClick={handleLockScope}>Lock Scope</Button>
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
            <div className={styles.metaItem}>📍 {project.site_address}</div>
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
            {formatValue(project.contract_value)}
          </span>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map(t => (
          <button
            key={t}
            className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        <Suspense fallback={<div style={{ padding: 24, color: 'var(--color-text-muted)' }}>Loading…</div>}>
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
    </div>
  );
}
