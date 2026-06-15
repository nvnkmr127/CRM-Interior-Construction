import React, { useState, useEffect } from 'react';
import { Button, Badge, Skeleton, EmptyState } from '../../components/ui';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [projects, setProjects] = useState(null);
  const [payments, setPayments] = useState(null);
  
  const [activityError, setActivityError] = useState(false);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Simulated mock data since backend might not have these specific routes yet
        setTimeout(() => {
          setStats({
            activeLeads: { val: 42, trend: 5 },
            wonMonth: { val: 8, valRupees: '₹14.2L', trend: -2 },
            activeProjects: { val: 12, overdue: 2 },
            tasksDueToday: { val: 15, overdue: 4 }
          });
          setStatsError(false);
          
          setActivity([
            { id: 1, user: 'Priya Desai', action: 'moved', text: 'Sharma Residence to Execution phase', time: '10 mins ago' },
            { id: 2, user: 'Rahul Sharma', action: 'uploaded', text: 'v2 of Kitchen Layout PDF', time: '1 hour ago' },
            { id: 3, user: 'Ananya Rao', action: 'logged', text: 'a call with Gupta Family', time: '2 hours ago' },
            { id: 4, user: 'Naveen K.', action: 'moved', text: 'Villa Fitout to Design Concept', time: '4 hours ago' }
          ]);

          setPipeline([
            { id: 1, name: 'New', count: 12, color: '#3B82F6' },
            { id: 2, name: 'Contacted', count: 8, color: '#8B5CF6' },
            { id: 3, name: 'Qualified', count: 5, color: '#F59E0B' },
            { id: 4, name: 'Site Visit', count: 3, color: '#EC4899' },
            { id: 5, name: 'Proposal', count: 2, color: '#10B981' },
            { id: 6, name: 'Won', count: 1, color: '#059669' }
          ]);

          setTasks([
            { id: 1, title: 'Finalize layout drawing', project: 'Sharma Residence', due: '2026-06-12', overdue: true, done: false },
            { id: 2, title: 'Call client for budget', project: 'Gupta Family', due: '2026-06-15', overdue: false, done: false },
            { id: 3, title: 'Send quotation', project: 'Villa 42', due: '2026-06-16', overdue: false, done: false },
          ]);

          setProjects([
            { id: 1, name: 'Sharma Residence', client: 'Mr. Sharma', progress: 65, phase: 'Execution' },
            { id: 2, name: 'Villa Fitout', client: 'Aditya Birla', progress: 20, phase: 'Design Concept' }
          ]);

          setPayments([
            { id: 1, project: 'Sharma Residence', milestone: 'Material Sourcing', amount: '₹2.5L', due: '2026-06-10', overdue: true },
            { id: 2, project: 'Villa 42', milestone: 'Advance', amount: '₹1.5L', due: '2026-06-20', overdue: false }
          ]);

          setLoading(false);
        }, 1000);
      } catch (err) {
        setStatsError(true);
        setActivityError(true);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const handleTaskToggle = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const renderVerb = (action) => {
    switch(action) {
      case 'moved': return <span className={styles.verbInfo}>moved</span>;
      case 'uploaded': return <span className={styles.verbAccent}>uploaded</span>;
      case 'logged': return <span className={styles.verbSuccess}>logged</span>;
      default: return <span>{action}</span>;
    }
  };

  const maxPipeline = pipeline ? Math.max(...pipeline.map(p => p.count)) : 1;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.greeting}>Good morning, Naveen 👋</div>
          <div className={styles.dateText}>{today}</div>
        </div>
        <div className={styles.headerRight}>
          <Button variant="secondary" onClick={() => navigate('/projects')}>+ New Project</Button>
          <Button variant="primary" onClick={() => navigate('/leads')}>+ New Lead</Button>
        </div>
      </div>

      <div className={styles.kpiRow}>
        {/* KPI 1 */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap}>
            <div className={styles.kpiIcon}>👥</div>
          </div>
          <div className={styles.kpiLabel}>Active Leads</div>
          {loading ? <Skeleton height="36px" width="60px" /> : statsError ? <div className={styles.errorState}>—<br/>Unable to load</div> : (
            <>
              <div className={styles.kpiValue}>{stats.activeLeads.val}</div>
              {stats.activeLeads.trend > 0 ? (
                <div className={styles.trendPos}>↑ {Math.abs(stats.activeLeads.trend)} from last week</div>
              ) : (
                <div className={styles.trendNeg}>↓ {Math.abs(stats.activeLeads.trend)} from last week</div>
              )}
            </>
          )}
        </div>

        {/* KPI 2 */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap}>
            <div className={styles.kpiIcon} style={{background: 'var(--color-success-bg)', color: 'var(--color-success)'}}>🏆</div>
          </div>
          <div className={styles.kpiLabel}>Won This Month</div>
          {loading ? <Skeleton height="36px" width="60px" /> : statsError ? <div className={styles.errorState}>—<br/>Unable to load</div> : (
            <>
              <div className={styles.kpiValue}>
                {stats.wonMonth.val}
                <span className={styles.kpiSubValue}>{stats.wonMonth.valRupees}</span>
              </div>
              {stats.wonMonth.trend > 0 ? (
                <div className={styles.trendPos}>↑ {Math.abs(stats.wonMonth.trend)} from last week</div>
              ) : (
                <div className={styles.trendNeg}>↓ {Math.abs(stats.wonMonth.trend)} from last week</div>
              )}
            </>
          )}
        </div>

        {/* KPI 3 */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap}>
            <div className={styles.kpiIcon} style={{background: '#E0E7FF', color: '#4F46E5'}}>🏗️</div>
            {stats?.activeProjects?.overdue > 0 && <Badge variant="danger" className={styles.kpiBadge}>{stats.activeProjects.overdue} overdue</Badge>}
          </div>
          <div className={styles.kpiLabel}>Active Projects</div>
          {loading ? <Skeleton height="36px" width="60px" /> : statsError ? <div className={styles.errorState}>—<br/>Unable to load</div> : (
            <div className={styles.kpiValue}>{stats.activeProjects.val}</div>
          )}
        </div>

        {/* KPI 4 */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap}>
            <div className={styles.kpiIcon} style={{background: '#FEF3C7', color: '#D97706'}}>✅</div>
            {stats?.tasksDueToday?.overdue > 0 && <Badge variant="danger" className={styles.kpiBadge}>{stats.tasksDueToday.overdue} overdue</Badge>}
          </div>
          <div className={styles.kpiLabel}>Tasks Due Today</div>
          {loading ? <Skeleton height="36px" width="60px" /> : statsError ? <div className={styles.errorState}>—<br/>Unable to load</div> : (
            <div className={styles.kpiValue}>{stats.tasksDueToday.val}</div>
          )}
        </div>
      </div>

      <div className={styles.mainGrid}>
        {/* LEFT COLUMN */}
        <div className={styles.column}>
          
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>Recent Activity</div>
              <a href="#" className={styles.viewAll}>View all →</a>
            </div>
            <div className={styles.cardBodyNoPad}>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className={styles.actRow}>
                    <Skeleton circle width="28px" height="28px" />
                    <div style={{flex: 1}}><Skeleton height="16px" width="80%" /><Skeleton height="12px" width="40%" style={{marginTop: '4px'}} /></div>
                  </div>
                ))
              ) : activityError ? (
                <EmptyState title="Could not load activity" />
              ) : activity?.length === 0 ? (
                <div style={{padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-secondary)'}}>No activity yet today.</div>
              ) : (
                activity.map(act => (
                  <div key={act.id} className={styles.actRow}>
                    <div className={styles.actAvatar}>{act.user.charAt(0)}</div>
                    <div className={styles.actContent}>
                      <b>{act.user}</b> {renderVerb(act.action)} {act.text}
                      <div className={styles.actTime}>{act.time}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>Lead Pipeline</div>
            </div>
            <div className={styles.cardBody}>
              {loading ? (
                Array(5).fill(0).map((_, i) => <Skeleton key={i} height="24px" width="100%" />)
              ) : (
                pipeline?.map(stage => (
                  <div key={stage.id} className={styles.pipeRow}>
                    <div className={styles.pipeLabel}>{stage.name}</div>
                    <div className={styles.pipeBarWrap} onClick={() => navigate(`/leads?stageId=${stage.id}`)}>
                      <div className={styles.pipeBar} style={{width: `${Math.max((stage.count / maxPipeline) * 100, 5)}%`, backgroundColor: stage.color}} />
                      <div className={styles.pipeCount}>{stage.count}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.column}>
          
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>My Tasks</div>
              <a href="#" className={styles.viewAll}>View all →</a>
            </div>
            <div className={styles.cardBodyNoPad}>
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className={styles.taskRow}><Skeleton circle width="16px" height="16px" /><Skeleton height="16px" width="100%" /></div>
                ))
              ) : tasks?.length === 0 ? (
                <div style={{padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-success)', fontWeight: 600}}>🎉 All caught up!</div>
              ) : (
                tasks?.map(task => (
                  <div key={task.id} className={`${styles.taskRow} ${task.done ? styles.taskRowDone : ''}`}>
                    <input type="checkbox" checked={task.done} onChange={() => handleTaskToggle(task.id)} style={{marginTop: '4px'}} />
                    <div className={styles.taskContent}>
                      <div className={styles.taskTitle} style={{textDecoration: task.done ? 'line-through' : 'none'}}>{task.title}</div>
                      <div className={styles.taskMeta}>
                        <span className={styles.taskProject}>{task.project}</span>
                        <span className={`${styles.taskDate} ${task.overdue && !task.done ? styles.taskDateOverdue : ''}`}>{task.due}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>Projects in Progress</div>
            </div>
            <div className={styles.cardBodyNoPad}>
              {loading ? (
                Array(3).fill(0).map((_, i) => <div key={i} style={{padding: '12px 20px'}}><Skeleton height="32px" width="100%" /></div>)
              ) : (
                projects?.map(proj => (
                  <div key={proj.id} className={styles.projRow} onClick={() => navigate(`/projects/${proj.id}`)}>
                    <div className={styles.projTop}>
                      <span className={styles.projName}>{proj.name}</span>
                      <span className={styles.projClient}>{proj.client}</span>
                    </div>
                    <div className={styles.projProgWrap}>
                      <div className={styles.projProgTrack}>
                        <div className={styles.projProgFill} style={{width: `${proj.progress}%`}} />
                      </div>
                      <span className={styles.projPhase}>{proj.phase}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>Payments Due</div>
            </div>
            <div className={styles.cardBodyNoPad}>
              {loading ? (
                Array(2).fill(0).map((_, i) => <div key={i} style={{padding: '12px 20px'}}><Skeleton height="32px" width="100%" /></div>)
              ) : (
                payments?.map(pay => (
                  <div key={pay.id} className={`${styles.payRow} ${pay.overdue ? styles.payRowOverdue : ''}`}>
                    <div className={styles.payTop}>
                      <span className={styles.payProj}>{pay.project}</span>
                      <span className={styles.payVal}>{pay.amount}</span>
                    </div>
                    <div className={styles.payBot}>
                      <span className={styles.payMile}>{pay.milestone}</span>
                      <span className={`${styles.payDate} ${pay.overdue ? styles.payDateOverdue : ''}`}>{pay.due}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
