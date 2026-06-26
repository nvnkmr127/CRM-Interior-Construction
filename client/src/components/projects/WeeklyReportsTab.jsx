import React, { useState, useEffect } from 'react';
import { Badge, Button } from '../ui';
import styles from './WeeklyReportsTab.module.css';
import { getPhases, getMilestones, getTasks, getProject } from '../../api/projects';
import { useToast } from '../../store/toastContext';

// Helper: Calculate difference in calendar days
function diffDays(d1, d2) {
  const oneDay = 24 * 60 * 60 * 1000;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  date1.setHours(0,0,0,0);
  date2.setHours(0,0,0,0);
  return Math.round((date1 - date2) / oneDay);
}

// Helper: Add days to Date
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Helper: Format Date to readable string
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Generates 8 reporting weeks (Monday to Sunday)
function getRecentWeeks() {
  const weeks = [];
  const today = new Date();
  
  // Find current week's Sunday
  const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday...
  const daysToSunday = currentDay === 0 ? 0 : 7 - currentDay;
  const thisSunday = new Date(today);
  thisSunday.setDate(today.getDate() + daysToSunday);
  thisSunday.setHours(23, 59, 59, 999);

  for (let i = 0; i < 8; i++) {
    const sunday = new Date(thisSunday);
    sunday.setDate(thisSunday.getDate() - (i * 7));
    
    const monday = new Date(sunday);
    monday.setDate(sunday.getDate() - 6);
    monday.setHours(0, 0, 0, 0);

    const label = `Week ${i === 0 ? '(Current) ' : ''}– ${monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${sunday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    weeks.push({
      start: monday,
      end: sunday,
      label,
      index: i
    });
  }
  return weeks;
}

export default function WeeklyReportsTab({ projectId }) {
  const toast = useToast();
  const weeksList = getRecentWeeks();

  // Core Data
  const [project, setProject] = useState(null);
  const [phases, setPhases] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selector State
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const selectedWeek = weeksList[selectedWeekIndex];

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Project
      const projRes = await getProject(projectId);
      setProject(projRes.data?.data || projRes.data || null);

      // 2. Fetch Phases
      const pRes = await getPhases(projectId);
      const rawPhases = pRes.data?.data || pRes.data || [];
      setPhases(rawPhases);

      // 3. Fetch Milestones for each phase
      const milestonesList = [];
      for (const ph of rawPhases) {
        try {
          const mRes = await getMilestones(ph.id);
          const rawMilestones = mRes.data?.data || mRes.data || [];
          for (const m of rawMilestones) {
            milestonesList.push({
              ...m,
              phaseId: ph.id
            });
          }
        } catch (e) {
          console.error(`Failed to fetch milestones for phase ${ph.id}`);
        }
      }
      setMilestones(milestonesList);

      // 4. Fetch all tasks
      const tRes = await getTasks(projectId, { allTasks: true, limit: 'all' });
      const rawTasks = tRes.data?.data || tRes.data || [];
      setTasks(rawTasks);

    } catch (e) {
      console.error(e);
      toast.error('Failed to generate progress report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadAllData();
    }
  }, [projectId]);

  if (loading) {
    return <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>Generating weekly progress report…</div>;
  }

  // Pre-calculate Milestone Lookup map
  const milestoneMap = {};
  for (const m of milestones) {
    milestoneMap[m.id] = m;
  }

  // Relate each task to a Phase
  const getTaskPhaseId = (t) => {
    if (t.milestone_id) {
      const m = milestoneMap[t.milestone_id];
      if (m) return m.phase_id;
    }
    // Fallback: Check if milestone_id is actually a phase_id in the db configuration
    return t.milestone_id;
  };

  // Compile Phase-wise Analytics
  const phaseReports = phases.map(phase => {
    const phaseTasks = tasks.filter(t => getTaskPhaseId(t) === phase.id);

    if (phaseTasks.length === 0) {
      return {
        ...phase,
        totalTasksCount: 0,
        plannedPercentage: 0,
        actualPercentage: 0,
        variance: 0,
        statusLabel: 'No Tasks'
      };
    }

    // Planned: due_date is on or before end of week
    const plannedTasks = phaseTasks.filter(t => {
      if (!t.due_date) return false;
      return new Date(t.due_date) <= selectedWeek.end;
    });

    // Actual: completed on or before end of week
    const actualTasks = phaseTasks.filter(t => {
      if (t.status !== 'done') return false;
      const compDate = t.updated_at ? new Date(t.updated_at) : new Date();
      return compDate <= selectedWeek.end;
    });

    const total = phaseTasks.length;
    const plannedPercentage = Math.round((plannedTasks.length / total) * 100);
    const actualPercentage = Math.round((actualTasks.length / total) * 100);
    const variance = actualPercentage - plannedPercentage;

    let statusLabel = 'On Track';
    if (variance < -10) statusLabel = 'Critical Delay';
    else if (variance < 0) statusLabel = 'Slight Delay';
    else if (variance > 5) statusLabel = 'Ahead';

    return {
      ...phase,
      totalTasksCount: total,
      plannedPercentage,
      actualPercentage,
      variance,
      statusLabel
    };
  });

  // Compile Delayed Tasks (due_date in past relative to end of reporting week, and status not done by then)
  const delayedActivities = tasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    
    // Must be due by or before the end of the reporting week
    if (dueDate > selectedWeek.end) return false;

    // Was not completed or completed after end of reporting week
    if (t.status === 'done') {
      const compDate = t.updated_at ? new Date(t.updated_at) : new Date();
      return compDate > selectedWeek.end;
    }
    
    return true;
  }).map(t => {
    const endRange = new Date() < selectedWeek.end ? new Date() : selectedWeek.end;
    const delay = diffDays(endRange, new Date(t.due_date));
    
    // Find phase name
    const phaseId = getTaskPhaseId(t);
    const phaseName = phases.find(p => p.id === phaseId)?.name || 'General';

    return {
      ...t,
      phaseName,
      delayDays: Math.max(0, delay)
    };
  }).sort((a, b) => b.delayDays - a.delayDays);

  // Compile Upcoming Milestones (Due in next 14 days from the reporting week start)
  const upcomingMilestones = milestones.filter(m => {
    if (!m.due_date) return false;
    const dDate = new Date(m.due_date);
    return dDate >= selectedWeek.start && dDate <= addDays(selectedWeek.end, 14) && m.status !== 'completed';
  }).map(m => {
    const phaseName = phases.find(p => p.id === m.phaseId)?.name || 'General';
    return {
      ...m,
      phaseName
    };
  });

  // Calculate Overall Progress KPI
  const completedTasks = tasks.filter(t => t.status === 'done');
  const overallProgress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  
  const completedBeforeDue = tasks.filter(t => {
    if (t.status !== 'done' || !t.due_date) return false;
    const comp = t.updated_at ? new Date(t.updated_at) : new Date();
    return comp <= new Date(t.due_date);
  });
  const onTimeRate = completedTasks.length > 0 ? Math.round((completedBeforeDue.length / completedTasks.length) * 100) : 0;

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // WhatsApp Summary block formatting
  const generateWhatsAppSummary = () => {
    const prName = project?.name || 'Interior Construction Project';
    
    let summaryText = `*Weekly Project Update - ${prName}*\n`;
    summaryText += `*Reporting Week:* ${formatDate(selectedWeek.start)} to ${formatDate(selectedWeek.end)}\n`;
    summaryText += `*Overall Progress:* ${overallProgress}% Completed\n`;
    summaryText += `*On-Time Task Rate:* ${onTimeRate}%\n\n`;

    summaryText += `*Phase Completion (Planned vs Actual):*\n`;
    phaseReports.forEach(r => {
      const varText = r.variance >= 0 ? `+${r.variance}%` : `${r.variance}%`;
      const emoji = r.variance >= 5 ? '🚀' : r.variance < -10 ? '🚨' : r.variance < 0 ? '⚠️' : '✅';
      summaryText += `${emoji} *${r.name}:* Actual ${r.actualPercentage}% (Planned: ${r.plannedPercentage}% | Var: ${varText})\n`;
    });

    if (delayedActivities.length > 0) {
      summaryText += `\n*Delayed Activities:* \n`;
      delayedActivities.slice(0, 3).forEach(d => {
        summaryText += `- ⚠️ _${d.title}_ (Delayed by ${d.delayDays} days)\n`;
      });
      if (delayedActivities.length > 3) {
        summaryText += `- ...and ${delayedActivities.length - 3} other tasks.\n`;
      }
    } else {
      summaryText += `\n*Delayed Activities:* None 🎉\n`;
    }

    if (upcomingMilestones.length > 0) {
      summaryText += `\n*Upcoming Milestones:* \n`;
      upcomingMilestones.slice(0, 3).forEach(m => {
        const paymentLabel = m.triggers_payment ? ' [₹ Payment]' : '';
        summaryText += `- 💎 _${m.name}_ (Target: ${formatDate(m.due_date)}${paymentLabel})\n`;
      });
    }

    navigator.clipboard.writeText(summaryText);
    toast.success('WhatsApp Progress Summary copied to clipboard!');
  };

  const whatsAppMessage = `*Weekly Project Update - ${project?.name || 'CRM Project'}*\n*Period:* ${formatDate(selectedWeek.start)} to ${formatDate(selectedWeek.end)}\n*Overall Progress:* ${overallProgress}% Complete\n\n*Phase-wise Variance:*\n` + 
    phaseReports.map(r => `- ${r.name}: Actual ${r.actualPercentage}% (Planned ${r.plannedPercentage}% | ${r.variance >= 0 ? `+${r.variance}%` : `${r.variance}%`})`).join('\n') +
    (delayedActivities.length > 0 ? `\n\n*Top Delayed:* \n` + delayedActivities.slice(0,3).map(d => `- ${d.title} (${d.delayDays} days late)`).join('\n') : '\n\nNo active delays!') +
    (upcomingMilestones.length > 0 ? `\n\n*Key Upcoming:* \n` + upcomingMilestones.slice(0,3).map(m => `- ${m.name} (${formatDate(m.due_date)})`).join('\n') : '');

  return (
    <div className={styles.container}>
      {/* Top Selector Panel */}
      <div className={styles.toolbar}>
        <div className={styles.titleSection}>
          <div className={styles.title}>Weekly Progress Analyzer</div>
          <div className={styles.subtitle}>Select a reporting period to auto-calculate milestones, delays, and progress variances.</div>
        </div>

        <div className={styles.actions}>
          <select 
            className={styles.selectInput}
            value={selectedWeekIndex}
            onChange={(e) => setSelectedWeekIndex(parseInt(e.target.value, 10))}
          >
            {weeksList.map((w) => (
              <option key={w.index} value={w.index}>
                {w.label}
              </option>
            ))}
          </select>

          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handlePrint}>
            🖨 Print / Save PDF
          </button>

          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={generateWhatsAppSummary}>
            💬 Copy WhatsApp Update
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Overall Progress</span>
          <span className={styles.cardValue}>{overallProgress}%</span>
          <span className={styles.cardSubtext}>Total tasks completed against total planned scope.</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>On-Time Completion Rate</span>
          <span className={styles.cardValue}>{onTimeRate}%</span>
          <span className={styles.cardSubtext}>Completed tasks finished on or before their due dates.</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Delayed Activities</span>
          <span className={styles.cardValue}>{delayedActivities.length}</span>
          <span className={styles.cardSubtext}>Overdue items at the end of the reporting week.</span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Upcoming Milestones</span>
          <span className={styles.cardValue}>{upcomingMilestones.length}</span>
          <span className={styles.cardSubtext}>Incomplete milestones due in the next 14 days.</span>
        </div>
      </div>

      {/* Planned vs Actual per Phase */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Planned vs. Actual Completion per Phase</span>
          <Badge variant="neutral" size="sm">Phase Statistics</Badge>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Phase Name</th>
                <th>Total Scope Tasks</th>
                <th>Planned Completion %</th>
                <th>Actual Completion %</th>
                <th>Progress Variance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {phaseReports.map((ph) => {
                const isAhead = ph.variance >= 5;
                const isLate = ph.variance < 0;
                
                let varianceClass = styles.varianceNeutral;
                if (isAhead) varianceClass = styles.variancePositive;
                if (isLate) varianceClass = styles.varianceNegative;

                let badgeVariant = 'neutral';
                if (ph.statusLabel === 'Ahead') badgeVariant = 'success';
                if (ph.statusLabel === 'Critical Delay') badgeVariant = 'danger';
                if (ph.statusLabel === 'Slight Delay') badgeVariant = 'warning';

                return (
                  <tr key={ph.id}>
                    <td><b>{ph.name}</b></td>
                    <td>{ph.totalTasksCount} tasks</td>
                    <td>
                      <div className={styles.progressBarContainer}>
                        <div className={`${styles.progressBar} ${styles.progressPrimary}`} style={{ width: `${ph.plannedPercentage}%` }} />
                      </div>
                      {ph.plannedPercentage}%
                    </td>
                    <td>
                      <div className={styles.progressBarContainer}>
                        <div className={`${styles.progressBar} ${styles.progressSuccess}`} style={{ width: `${ph.actualPercentage}%` }} />
                      </div>
                      {ph.actualPercentage}%
                    </td>
                    <td>
                      <span className={`${styles.varianceText} ${varianceClass}`}>
                        {ph.variance >= 0 ? `+${ph.variance}%` : `${ph.variance}%`}
                      </span>
                    </td>
                    <td>
                      <Badge variant={badgeVariant} size="sm">
                        {ph.statusLabel}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delayed Activities List */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Delayed Activities / Tasks</span>
          <Badge variant="danger" size="sm">Action Required</Badge>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Task Title</th>
                <th>Phase</th>
                <th>Original Due Date</th>
                <th>Status</th>
                <th>Current Delay</th>
              </tr>
            </thead>
            <tbody>
              {delayedActivities.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px 0', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                    No delayed activities. Everything is running on track! 🎉
                  </td>
                </tr>
              ) : (
                delayedActivities.map((task) => (
                  <tr key={task.id} className={styles.delayRow}>
                    <td><b>{task.title}</b></td>
                    <td>{task.phaseName}</td>
                    <td>{formatDate(task.due_date)}</td>
                    <td>
                      <Badge variant={task.status === 'blocked' ? 'danger' : 'warning'} size="sm">
                        {task.status?.toUpperCase()}
                      </Badge>
                    </td>
                    <td>
                      <span className={styles.delayBadge}>
                        {task.delayDays} days late
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming Milestones */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Upcoming Payment & Project Milestones (Next 14 Days)</span>
          <Badge variant="warning" size="sm">Timeline Outlook</Badge>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Milestone Name</th>
                <th>Phase</th>
                <th>Target Due Date</th>
                <th>Billing Trigger</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcomingMilestones.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px 0', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                    No upcoming milestones in the next 14 days.
                  </td>
                </tr>
              ) : (
                upcomingMilestones.map((m) => (
                  <tr key={m.id}>
                    <td><b>{m.name}</b></td>
                    <td>{m.phaseName}</td>
                    <td>{formatDate(m.due_date)}</td>
                    <td>
                      {m.triggers_payment ? (
                        <Badge variant="success" size="sm">₹ Payment Trigger</Badge>
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>None</span>
                      )}
                    </td>
                    <td>
                      <Badge variant="neutral" size="sm">
                        {m.status?.toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick WhatsApp Exporter Preview Area */}
      <div className={styles.whatsappBox}>
        <div className={styles.whatsappTitle}>
          <span>📱 WhatsApp Site Update Draft Preview</span>
        </div>
        <textarea 
          readOnly
          className={styles.whatsappTextarea}
          value={whatsAppMessage}
        />
        <div style={{ fontSize: '11px', color: '#15803d' }}>
          *Tip:* Click "Copy WhatsApp Update" in the top bar to instantly format and copy the block to your clipboard.
        </div>
      </div>
    </div>
  );
}
