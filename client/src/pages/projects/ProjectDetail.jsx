import React, { useState, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Badge } from '../../components/ui';
import styles from './ProjectDetail.module.css';

// Lazy load tabs
const PhaseTimeline = React.lazy(() => import('../../components/projects/PhaseTimeline'));
const TaskKanban = React.lazy(() => import('../../components/tasks/TaskKanban'));
const DocumentPanel = React.lazy(() => import('../../components/projects/DocumentPanel'));
const PaymentsTab = React.lazy(() => import('./PaymentsTab'));
const SnagsDashboard = React.lazy(() => import('./SnagsDashboard'));
const HandoverChecklist = React.lazy(() => import('./HandoverChecklist'));

export default function ProjectDetail() {
  const { id: projectId } = useParams();
  const [activeTab, setActiveTab] = useState('Phases');

  const tabs = ['Overview', 'Phases', 'Tasks', 'Documents', 'Payments', 'Snags', 'Handover'];

  const project = {
    name: 'Villa Renovation',
    clientName: 'Aditya Birla',
    status: 'Active',
    value: '₹12.5L',
    pmName: 'Rahul Sharma',
    designerName: 'Priya Desai',
    startDate: '10 Aug 2026',
    targetDate: '15 Nov 2026',
    address: 'Plot 42, Jubilee Hills',
    taskProgress: { done: 14, total: 20 },
    currentPhase: 'Execution (Phase 3)',
    daysRemaining: 23,
    payments: { collected: '₹3.2L', total: '₹8.5L' }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Phases': return <PhaseTimeline projectId={projectId} />;
      case 'Tasks': return <TaskKanban projectId={projectId} />;
      case 'Documents': return <DocumentPanel projectId={projectId} />;
      case 'Payments': return <PaymentsTab projectId={projectId} />;
      case 'Snags': return <SnagsDashboard projectId={projectId} />;
      case 'Handover': return <HandoverChecklist projectId={projectId} />;
      default: return <div>{activeTab} Content (Coming Soon)</div>;
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <a href="/projects">Projects</a> &gt; <span>{project.name}</span>
      </div>

      <div className={styles.headerCard}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <div className={styles.projName}>
              {project.name} <Badge variant="info" dot>{project.status}</Badge>
            </div>
            <div className={styles.clientName}>{project.clientName}</div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.value}>{project.value}</div>
            <Button variant="outline" size="sm">Edit</Button>
          </div>
        </div>

        <div className={styles.headerBottom}>
          <div className={styles.metaItem}><div className={styles.avatar}>{project.pmName.charAt(0)}</div> PM: {project.pmName}</div>
          <div className={styles.metaItem}><div className={styles.avatar}>{project.designerName.charAt(0)}</div> Designer: {project.designerName}</div>
          <div className={styles.metaItem}>📅 {project.startDate} → {project.targetDate}</div>
          <div className={styles.metaItem}>📍 {project.address}</div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Task Progress</span>
          <span className={styles.statValue}>
            {project.taskProgress.done}/{project.taskProgress.total} 
            <span style={{color: 'var(--color-text-secondary)', fontSize: '14px'}}>
              ({Math.round(project.taskProgress.done/project.taskProgress.total*100)}%)
            </span>
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Current Phase</span>
          <span className={styles.statValue}>{project.currentPhase}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Days Remaining</span>
          <span className={project.daysRemaining < 0 ? `${styles.statValue} ${styles.statDanger}` : styles.statValue}>
            {project.daysRemaining < 0 ? `Overdue ${Math.abs(project.daysRemaining)} days` : `${project.daysRemaining} days`}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Payment Collected</span>
          <span className={styles.statValue}>{project.payments.collected} of {project.payments.total}</span>
        </div>
      </div>

      <div className={styles.tabs}>
        {tabs.map(t => (
          <button key={t} className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`} onClick={() => setActiveTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        <Suspense fallback={<div>Loading tab...</div>}>
          {renderTabContent()}
        </Suspense>
      </div>
    </div>
  );
}
