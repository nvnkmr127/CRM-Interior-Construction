/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from 'react';
import { Badge, Button } from '../ui';
import styles from './WeeklyReportsTab.module.css';
import { getPhases, getMilestones, getTasks, getProject, getDailyReports } from '../../api/projects';
import { useToast } from '../../store/toastContext';

const TRADES_MAP = {
  civil: { label: 'Civil / Demolition', icon: '🧱' },
  electrical: { label: 'Electrical Work', icon: '⚡' },
  plumbing: { label: 'Plumbing Work', icon: '🚰' },
  false_ceiling: { label: 'False Ceiling', icon: '📐' },
  flooring: { label: 'Flooring & Tiling', icon: '🏁' },
  painting: { label: 'Painting & Putty', icon: '🎨' },
  carpentry: { label: 'Carpentry & Modular', icon: '🔨' },
  glass_metal: { label: 'Glass & Metal Work', icon: '🪟' },
  furnishing: { label: 'Soft Furnishing', icon: '🛋️' }
};

// Helper: Calculate difference in calendar days
function diffDays(d1, d2) {
  const oneDay = 24 * 60 * 60 * 1000;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  date1.setHours(0, 0, 0, 0);
  date2.setHours(0, 0, 0, 0);
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
  const weeksList = useMemo(() => getRecentWeeks(), []);

  // Core Data
  const [project, setProject] = useState(null);
  const [phases, setPhases] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selector State
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const selectedWeek = weeksList[selectedWeekIndex] || weeksList[0];

  // Active View: 'schedule' | 'site_diary' | 'executive_whatsapp'
  const [activeView, setActiveView] = useState('schedule');

  // Lightbox Modal for Weekly Photos
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

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

      // 4. Fetch Tasks
      const tRes = await getTasks(projectId, { allTasks: true, limit: 'all' });
      const rawTasks = tRes.data?.data || tRes.data || [];
      setTasks(rawTasks);

      // 5. Fetch Daily Site Reports (DSR)
      try {
        const dsrRes = await getDailyReports(projectId);
        const rawDsr = dsrRes.data?.data || dsrRes.data || [];
        setDailyReports(Array.isArray(rawDsr) ? rawDsr : []);
      } catch (err) {
        console.warn('Could not load daily site reports for weekly rollup', err);
      }

    } catch (e) {
      console.error(e);
      toast.error('Failed to generate weekly progress report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadAllData();
    }
  }, [projectId]);

  // Milestone lookup map
  const milestoneMap = useMemo(() => {
    const map = {};
    for (const m of milestones) {
      map[m.id] = m;
    }
    return map;
  }, [milestones]);

  // Relate each task to a Phase
  const getTaskPhaseId = (t) => {
    if (t.milestone_id) {
      const m = milestoneMap[t.milestone_id];
      if (m) return m.phase_id;
    }
    return t.milestone_id;
  };

  // Compile Phase-wise Analytics
  const phaseReports = useMemo(() => {
    return phases.map(phase => {
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

      // Planned: due_date is on or before end of reporting week
      const plannedTasks = phaseTasks.filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) <= selectedWeek.end;
      });

      // Actual: completed on or before end of reporting week
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
  }, [phases, tasks, selectedWeek, milestoneMap]);

  // Delayed Tasks (due_date in past relative to end of reporting week, and status not done by then)
  const delayedActivities = useMemo(() => {
    return tasks.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      if (dueDate > selectedWeek.end) return false;

      if (t.status === 'done') {
        const compDate = t.updated_at ? new Date(t.updated_at) : new Date();
        return compDate > selectedWeek.end;
      }
      return true;
    }).map(t => {
      const endRange = new Date() < selectedWeek.end ? new Date() : selectedWeek.end;
      const delay = diffDays(endRange, new Date(t.due_date));
      const phaseId = getTaskPhaseId(t);
      const phaseName = phases.find(p => p.id === phaseId)?.name || 'General';

      return {
        ...t,
        phaseName,
        delayDays: Math.max(0, delay)
      };
    }).sort((a, b) => b.delayDays - a.delayDays);
  }, [tasks, selectedWeek, phases, milestoneMap]);

  // Upcoming Milestones (Due in next 21 days from reporting week start)
  const upcomingMilestones = useMemo(() => {
    return milestones.filter(m => {
      if (!m.due_date) return false;
      const dDate = new Date(m.due_date);
      return dDate >= selectedWeek.start && dDate <= addDays(selectedWeek.end, 21) && m.status !== 'completed';
    }).map(m => {
      const phaseName = phases.find(p => p.id === m.phaseId)?.name || 'General';
      return {
        ...m,
        phaseName
      };
    }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  }, [milestones, selectedWeek, phases]);

  // Overall KPI Progress
  const completedTasks = useMemo(() => tasks.filter(t => t.status === 'done'), [tasks]);
  const overallProgress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const completedBeforeDue = useMemo(() => {
    return tasks.filter(t => {
      if (t.status !== 'done' || !t.due_date) return false;
      const comp = t.updated_at ? new Date(t.updated_at) : new Date();
      return comp <= new Date(t.due_date);
    });
  }, [tasks]);

  const onTimeRate = completedTasks.length > 0 ? Math.round((completedBeforeDue.length / completedTasks.length) * 100) : 0;

  // Project Health Evaluation
  const plannedTasksCount = useMemo(() => {
    return tasks.filter(t => t.due_date && new Date(t.due_date) <= selectedWeek.end).length;
  }, [tasks, selectedWeek]);

  const plannedProgress = tasks.length > 0 ? Math.round((plannedTasksCount / tasks.length) * 100) : 0;
  const overallVariance = overallProgress - plannedProgress;

  let healthStatus = 'On Track';
  let healthBadgeClass = styles.healthBadgeOnTrack;
  if (overallVariance >= 5) {
    healthStatus = 'Ahead of Schedule';
    healthBadgeClass = styles.healthBadgeAhead;
  } else if (overallVariance < -10) {
    healthStatus = 'Critical Delay';
    healthBadgeClass = styles.healthBadgeDelay;
  } else if (overallVariance < 0) {
    healthStatus = 'Slight Delay';
    healthBadgeClass = styles.healthBadgeWarning;
  }

  // Next Payment Trigger Milestone
  const nextPaymentMilestone = useMemo(() => {
    return upcomingMilestones.find(m => m.triggers_payment) || upcomingMilestones[0] || null;
  }, [upcomingMilestones]);

  // --- Filter DSR Data for the Selected Week ---
  const weekDSRs = useMemo(() => {
    return dailyReports.filter(r => {
      if (!r.report_date) return false;
      const d = new Date(r.report_date);
      return d >= selectedWeek.start && d <= selectedWeek.end;
    }).sort((a, b) => new Date(b.report_date) - new Date(a.report_date));
  }, [dailyReports, selectedWeek]);

  // Weekly Manpower Count
  const weekManpowerTotal = useMemo(() => {
    return weekDSRs.reduce((sum, r) => {
      const dayWorkers = (r.manpower || []).reduce((s, m) => s + (Number(m.count) || 0), 0);
      return sum + dayWorkers;
    }, 0);
  }, [weekDSRs]);

  // Weekly Trade Rollup
  const weekTrades = useMemo(() => {
    const counts = {};
    weekDSRs.forEach(r => {
      (r.manpower || []).forEach(m => {
        const key = m.trade || 'civil';
        counts[key] = (counts[key] || 0) + (Number(m.count) || 0);
      });
    });
    return counts;
  }, [weekDSRs]);

  // Weekly Photos Collection
  const weekPhotos = useMemo(() => {
    const list = [];
    weekDSRs.forEach(r => {
      if (Array.isArray(r.photos)) {
        r.photos.forEach(photoKey => {
          list.push({
            key: photoKey,
            date: r.report_date,
            supervisor: r.submitted_by_name || r.supervisor_signature || 'Site Incharge',
            workDone: r.work_done
          });
        });
      }
    });
    return list;
  }, [weekDSRs]);

  // Weekly Site Issues/Blockers from DSRs
  const weekBlockers = useMemo(() => {
    return weekDSRs.filter(r => Boolean(r.issues_encountered && r.issues_encountered.trim())).map(r => ({
      date: r.report_date,
      issue: r.issues_encountered,
      supervisor: r.submitted_by_name || r.supervisor_signature || 'Site Supervisor'
    }));
  }, [weekDSRs]);

  const resolvePhotoUrl = (key) => {
    if (!key) return '';
    if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('data:')) return key;
    if (key.includes('mock-dsr-photo') || key.includes('photo-')) {
      return 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80';
    }
    return key;
  };

  // WhatsApp Summary Generator
  const generateWhatsAppSummary = () => {
    const prName = project?.name || 'Interior Construction Project';

    let summaryText = `*📋 WEEKLY PROJECT REPORT — ${prName}*\n`;
    summaryText += `*Period:* ${formatDate(selectedWeek.start)} to ${formatDate(selectedWeek.end)}\n`;
    summaryText += `*Status:* ${healthStatus} (${overallProgress}% Overall Progress)\n`;
    summaryText += `*On-Time Task Delivery:* ${onTimeRate}%\n`;
    if (weekDSRs.length > 0) {
      summaryText += `*Site Presence:* ${weekDSRs.length} DSRs logged | ${weekManpowerTotal} total worker-days\n`;
    }
    summaryText += `\n*🏗️ Phase Execution Progress:*\n`;
    phaseReports.forEach(r => {
      const varText = r.variance >= 0 ? `+${r.variance}%` : `${r.variance}%`;
      const emoji = r.variance >= 5 ? '🚀' : r.variance < -10 ? '🚨' : r.variance < 0 ? '⚠️' : '✅';
      summaryText += `${emoji} *${r.name}:* ${r.actualPercentage}% Done (Planned: ${r.plannedPercentage}% | ${varText})\n`;
    });

    if (Object.keys(weekTrades).length > 0) {
      summaryText += `\n*👷 Manpower Deployed This Week:*\n`;
      Object.entries(weekTrades).forEach(([tradeKey, count]) => {
        const trObj = TRADES_MAP[tradeKey];
        summaryText += `- ${trObj?.icon || '🔨'} ${trObj?.label || tradeKey}: ${count} worker-days\n`;
      });
    }

    if (delayedActivities.length > 0) {
      summaryText += `\n*⚠️ Delayed Tasks / Attention Required:*\n`;
      delayedActivities.slice(0, 3).forEach(d => {
        summaryText += `- ⚠️ _${d.title}_ (${d.phaseName}) — ${d.delayDays} days late\n`;
      });
      if (delayedActivities.length > 3) {
        summaryText += `- ...and ${delayedActivities.length - 3} other items.\n`;
      }
    } else {
      summaryText += `\n*Delayed Tasks:* None 🎉 All deliverables on track!\n`;
    }

    if (weekBlockers.length > 0) {
      summaryText += `\n*🚧 Site Blockers Encountered:*\n`;
      weekBlockers.slice(0, 2).forEach(b => {
        summaryText += `- ${formatDate(b.date)}: ${b.issue}\n`;
      });
    }

    if (upcomingMilestones.length > 0) {
      summaryText += `\n*🎯 Key Upcoming Milestones:*\n`;
      upcomingMilestones.slice(0, 3).forEach(m => {
        const payTag = m.triggers_payment ? ' [₹ Payment Trigger]' : '';
        summaryText += `- 💎 _${m.name}_ (${formatDate(m.due_date)})${payTag}\n`;
      });
    }

    summaryText += `\n_Generated via Digicloudify Interior CRM_`;

    navigator.clipboard.writeText(summaryText);
    toast.success('Weekly WhatsApp Progress Digest copied to clipboard!');
  };

  const whatsAppPreview = useMemo(() => {
    const prName = project?.name || 'Interior Construction Project';
    let text = `*WEEKLY PROJECT REPORT — ${prName}*\n`;
    text += `*Period:* ${formatDate(selectedWeek.start)} to ${formatDate(selectedWeek.end)}\n`;
    text += `*Overall Progress:* ${overallProgress}% (${healthStatus})\n\n`;
    text += `*Phase Status:*\n`;
    phaseReports.forEach(r => {
      text += `- ${r.name}: ${r.actualPercentage}% (Planned: ${r.plannedPercentage}%)\n`;
    });
    if (weekManpowerTotal > 0) {
      text += `\n*Weekly Site Manpower:* ${weekManpowerTotal} worker-days across ${weekDSRs.length} site reports\n`;
    }
    if (delayedActivities.length > 0) {
      text += `\n*Top Delays:*\n` + delayedActivities.slice(0, 3).map(d => `- ${d.title} (${d.delayDays} days late)`).join('\n');
    }
    if (nextPaymentMilestone) {
      text += `\n\n*Next Milestone:* ${nextPaymentMilestone.name} (${formatDate(nextPaymentMilestone.due_date)})${nextPaymentMilestone.triggers_payment ? ' [Billing Trigger]' : ''}`;
    }
    return text;
  }, [project, selectedWeek, overallProgress, healthStatus, phaseReports, weekManpowerTotal, weekDSRs, delayedActivities, nextPaymentMilestone]);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Generating comprehensive weekly progress digest…</div>;
  }

  return (
    <div className={styles.container}>
      {/* --- Top Toolbar & Period Selector --- */}
      <div className={styles.toolbar}>
        <div className={styles.titleSection}>
          <div className={styles.titleRow}>
            <span className={styles.title}>Weekly Progress Analyzer</span>
            {selectedWeekIndex === 0 && <span className={styles.currentBadge}>Current Week</span>}
          </div>
          <div className={styles.subtitle}>
            Reporting Period: <strong>{formatDate(selectedWeek.start)} to {formatDate(selectedWeek.end)}</strong> • Auto-aggregates milestone schedule and site execution logs.
          </div>
        </div>

        <div className={styles.actions}>
          <div className={styles.weekNav}>
            <button
              className={styles.navArrowBtn}
              onClick={() => setSelectedWeekIndex(prev => Math.min(weeksList.length - 1, prev + 1))}
              disabled={selectedWeekIndex >= weeksList.length - 1}
              title="Previous Week"
            >
              ◀
            </button>
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
            <button
              className={styles.navArrowBtn}
              onClick={() => setSelectedWeekIndex(prev => Math.max(0, prev - 1))}
              disabled={selectedWeekIndex <= 0}
              title="Next Week"
            >
              ▶
            </button>
          </div>

          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => window.print()}>
            🖨️ Print / Save PDF
          </button>

          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={generateWhatsAppSummary}>
            💬 Copy WhatsApp Update
          </button>

          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={loadAllData} title="Refresh latest data">
            🔄
          </button>
        </div>
      </div>

      {/* --- Executive KPI Ribbon --- */}
      <div className={styles.statsGrid}>
        {/* Card 1: Overall Progress */}
        <div className={styles.card}>
          <div className={`${styles.cardAccent} ${styles.cardAccentInfo}`} />
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Overall Progress</span>
            <span className={styles.cardIcon}>📊</span>
          </div>
          <div className={styles.cardValueRow}>
            <span className={styles.cardValue}>{overallProgress}%</span>
          </div>
          <div className={styles.cardSubtext}>
            {completedTasks.length} of {tasks.length} total tasks delivered to date.
          </div>
        </div>

        {/* Card 2: Schedule Health (SPI) */}
        <div className={styles.card}>
          <div className={`${styles.cardAccent} ${overallVariance >= 0 ? styles.cardAccentSuccess : styles.cardAccentWarning}`} />
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Schedule Health</span>
            <span className={styles.cardIcon}>⏱️</span>
          </div>
          <div className={styles.cardValueRow}>
            <span className={`${styles.healthBadge} ${healthBadgeClass}`}>
              {overallVariance >= 0 ? `+${overallVariance}%` : `${overallVariance}%`} {healthStatus}
            </span>
          </div>
          <div className={styles.cardSubtext}>
            Planned progress: {plannedProgress}% vs Actual: {overallProgress}%.
          </div>
        </div>

        {/* Card 3: Weekly Site Presence */}
        <div className={styles.card}>
          <div className={`${styles.cardAccent} ${styles.cardAccentSuccess}`} />
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Weekly Site Presence</span>
            <span className={styles.cardIcon}>👷</span>
          </div>
          <div className={styles.cardValueRow}>
            <span className={styles.cardValue}>{weekManpowerTotal}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Man-Days</span>
          </div>
          <div className={styles.cardSubtext}>
            Logged across {weekDSRs.length} daily site reports this week.
          </div>
        </div>

        {/* Card 4: Delayed Activities */}
        <div className={styles.card}>
          <div className={`${styles.cardAccent} ${delayedActivities.length > 0 ? styles.cardAccentDanger : styles.cardAccentSuccess}`} />
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Delays & Blockers</span>
            <span className={styles.cardIcon}>⚠️</span>
          </div>
          <div className={styles.cardValueRow}>
            <span className={styles.cardValue} style={{ color: delayedActivities.length > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {delayedActivities.length}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Overdue Tasks</span>
          </div>
          <div className={styles.cardSubtext}>
            {weekBlockers.length > 0 ? `${weekBlockers.length} on-site blockers logged this week.` : 'Zero reported site bottlenecks.'}
          </div>
        </div>

        {/* Card 5: Next Milestone */}
        <div className={styles.card}>
          <div className={`${styles.cardAccent} ${styles.cardAccentWarning}`} />
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Next Milestone Target</span>
            <span className={styles.cardIcon}>💎</span>
          </div>
          <div className={styles.cardValueRow}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
              {nextPaymentMilestone ? nextPaymentMilestone.name : 'All Milestones Met'}
            </span>
          </div>
          <div className={styles.cardSubtext}>
            {nextPaymentMilestone ? (
              <span>Target: <strong>{formatDate(nextPaymentMilestone.due_date)}</strong> {nextPaymentMilestone.triggers_payment && '• 💰 Triggers Billing'}</span>
            ) : (
              'No pending milestones in the immediate horizon.'
            )}
          </div>
        </div>
      </div>

      {/* --- View Mode Switcher --- */}
      <div className={styles.viewTabs}>
        <button
          className={`${styles.viewTabBtn} ${activeView === 'schedule' ? styles.viewTabBtnActive : ''}`}
          onClick={() => setActiveView('schedule')}
        >
          <span>📑 Phase & Schedule Performance</span>
        </button>
        <button
          className={`${styles.viewTabBtn} ${activeView === 'site_diary' ? styles.viewTabBtnActive : ''}`}
          onClick={() => setActiveView('site_diary')}
        >
          <span>📸 Weekly Site Diary & Photos Rollup</span>
          <span className={styles.viewTabCount}>{weekPhotos.length}</span>
        </button>
        <button
          className={`${styles.viewTabBtn} ${activeView === 'executive_whatsapp' ? styles.viewTabBtnActive : ''}`}
          onClick={() => setActiveView('executive_whatsapp')}
        >
          <span>💬 Client WhatsApp & Executive Briefing</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: PHASE & SCHEDULE PERFORMANCE */}
      {/* ========================================================================= */}
      {activeView === 'schedule' && (
        <>
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
                    <th>Scope Tasks</th>
                    <th>Planned Completion</th>
                    <th>Actual Completion</th>
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
                        <td><strong>{ph.name}</strong></td>
                        <td>{ph.totalTasksCount} tasks</td>
                        <td>
                          <div className={styles.progressBarContainer}>
                            <div className={`${styles.progressBar} ${styles.progressPrimary}`} style={{ width: `${ph.plannedPercentage}%` }} />
                          </div>
                          <span style={{ fontWeight: 600 }}>{ph.plannedPercentage}%</span>
                        </td>
                        <td>
                          <div className={styles.progressBarContainer}>
                            <div className={`${styles.progressBar} ${styles.progressSuccess}`} style={{ width: `${ph.actualPercentage}%` }} />
                          </div>
                          <span style={{ fontWeight: 600 }}>{ph.actualPercentage}%</span>
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
              <span>Delayed Activities & Critical Overdue Tasks</span>
              <Badge variant={delayedActivities.length > 0 ? 'danger' : 'success'} size="sm">
                {delayedActivities.length} {delayedActivities.length === 1 ? 'Task Overdue' : 'Tasks Overdue'}
              </Badge>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Task Title</th>
                    <th>Phase</th>
                    <th>Original Target Due</th>
                    <th>Status</th>
                    <th>Current Delay</th>
                  </tr>
                </thead>
                <tbody>
                  {delayedActivities.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        <div className={styles.emptyState}>
                          <div className={styles.emptyIcon}>🎉</div>
                          <strong>Zero Delayed Activities!</strong>
                          <span>All planned deliverables are running strictly on schedule for this reporting cycle.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    delayedActivities.map((task) => (
                      <tr key={task.id} className={styles.delayRow}>
                        <td><strong>{task.title}</strong></td>
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
              <span>Upcoming Milestones & Billing Triggers (Next 21 Days)</span>
              <Badge variant="warning" size="sm">Cash Flow Outlook</Badge>
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
                      <td colSpan="5">
                        <div className={styles.emptyState}>
                          <div className={styles.emptyIcon}>💎</div>
                          <span>No upcoming milestones scheduled in the next 21 days.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    upcomingMilestones.map((m) => (
                      <tr key={m.id}>
                        <td><strong>{m.name}</strong></td>
                        <td>{m.phaseName}</td>
                        <td>{formatDate(m.due_date)}</td>
                        <td>
                          {m.triggers_payment ? (
                            <Badge variant="success" size="sm">💰 Billing Trigger</Badge>
                          ) : (
                            <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>Standard Milestone</span>
                          )}
                        </td>
                        <td>
                          <Badge variant="neutral" size="sm">
                            {m.status?.toUpperCase() || 'PLANNED'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: WEEKLY SITE DIARY & PHOTOS ROLLUP */}
      {/* ========================================================================= */}
      {activeView === 'site_diary' && (
        <>
          {/* Manpower by Trade */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span>Weekly Manpower Deployed by Trade</span>
              <Badge variant="neutral" size="sm">{weekManpowerTotal} Total Man-Days</Badge>
            </div>

            {Object.keys(weekTrades).length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👷</div>
                <span>No daily site reports logged during this specific calendar week.</span>
              </div>
            ) : (
              <div className={styles.tradeGrid}>
                {Object.entries(weekTrades).map(([tradeKey, count]) => {
                  const trObj = TRADES_MAP[tradeKey];
                  return (
                    <div key={tradeKey} className={styles.tradeCard}>
                      <div className={styles.tradeIcon}>{trObj?.icon || '🔨'}</div>
                      <div className={styles.tradeInfo}>
                        <span className={styles.tradeCount}>{count} man-days</span>
                        <span className={styles.tradeName}>{trObj?.label || tradeKey}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekly Progress Photos Gallery */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span>Weekly Site Progress Photos Gallery</span>
              <Badge variant="neutral" size="sm">{weekPhotos.length} Captured</Badge>
            </div>

            {weekPhotos.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📸</div>
                <span>No site photos were uploaded in the daily reports during this week.</span>
              </div>
            ) : (
              <div className={styles.photoGrid}>
                {weekPhotos.map((photo, idx) => (
                  <div
                    key={idx}
                    className={styles.photoCard}
                    onClick={() => setLightboxPhoto(photo)}
                    title="Click to view full photo"
                  >
                    <img
                      src={resolvePhotoUrl(photo.key)}
                      alt="Site Progress"
                      className={styles.photoImg}
                      loading="lazy"
                    />
                    <div className={styles.photoOverlay}>
                      <span className={styles.photoDateBadge}>📅 {formatDate(photo.date)}</span>
                      <span className={styles.photoCaption}>
                        {photo.workDone || `Uploaded by ${photo.supervisor}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Site Issues / Blockers from DSR */}
          {weekBlockers.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span>Reported On-Site Issues & Blockers</span>
                <Badge variant="warning" size="sm">{weekBlockers.length} Logged</Badge>
              </div>

              <div className={styles.issueList}>
                {weekBlockers.map((b, idx) => (
                  <div key={idx} className={styles.issueItem}>
                    <div className={styles.issueHeader}>
                      <span>📅 {formatDate(b.date)} • Logged by {b.supervisor}</span>
                      <span>⚠️ Ground Issue</span>
                    </div>
                    <div className={styles.issueText}>{b.issue}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Site Reports Strip */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span>Daily Site Logs (DSR Entries for This Week)</span>
              <Badge variant="neutral" size="sm">{weekDSRs.length} Entries</Badge>
            </div>

            {weekDSRs.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📋</div>
                <span>No DSRs logged for this period. Use the "Daily Site Reports" tab to submit entries.</span>
              </div>
            ) : (
              <div className={styles.dsrLogsStrip}>
                {weekDSRs.map((dsr) => {
                  const workers = (dsr.manpower || []).reduce((s, m) => s + (Number(m.count) || 0), 0);
                  const photosCount = Array.isArray(dsr.photos) ? dsr.photos.length : 0;

                  return (
                    <div key={dsr.id} className={styles.dsrLogItem}>
                      <div className={styles.dsrLogDate}>
                        📅 {new Date(dsr.report_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {dsr.submitted_by_name || dsr.supervisor_signature || 'Supervisor'}
                        </div>
                      </div>
                      <div className={styles.dsrLogWork}>
                        <strong>Work Done:</strong> {dsr.work_done}
                        {dsr.tomorrows_plan && (
                          <div style={{ marginTop: '4px', color: 'var(--color-accent)' }}>
                            <strong>Next Day Plan:</strong> {dsr.tomorrows_plan}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        {workers > 0 && <Badge variant="neutral" size="sm">👥 {workers} Workers</Badge>}
                        {photosCount > 0 && <Badge variant="neutral" size="sm">📸 {photosCount} Photos</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: CLIENT WHATSAPP & EXECUTIVE BRIEFING */}
      {/* ========================================================================= */}
      {activeView === 'executive_whatsapp' && (
        <div className={styles.whatsappBox}>
          <div className={styles.whatsappTitle}>
            <span>📱 Formatted WhatsApp Progress Digest Preview</span>
            <Button variant="primary" size="sm" onClick={generateWhatsAppSummary}>
              💬 Copy Digest to Clipboard
            </Button>
          </div>
          <textarea
            readOnly
            className={styles.whatsappTextarea}
            value={whatsAppPreview}
          />
          <div style={{ fontSize: '12px', color: '#15803d', lineHeight: 1.5 }}>
            💡 <strong>Executive Tip:</strong> Click <em>"Copy WhatsApp Update"</em> to paste directly into the client WhatsApp or Slack group. The digest summarizes overall progress, phase milestones, on-site manpower, and upcoming deliverables.
          </div>
        </div>
      )}

      {/* --- Fullscreen Lightbox Modal --- */}
      {lightboxPhoto && (
        <div className={styles.lightboxBackdrop} onClick={() => setLightboxPhoto(null)}>
          <div className={styles.lightboxModal} onClick={e => e.stopPropagation()}>
            <button className={styles.lightboxClose} onClick={() => setLightboxPhoto(null)}>✕</button>
            <img
              src={resolvePhotoUrl(lightboxPhoto.key)}
              alt="Site Progress High Res"
              className={styles.lightboxImg}
            />
            <div className={styles.lightboxCaption}>
              <div>📅 <strong>{new Date(lightboxPhoto.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong> • Logged by {lightboxPhoto.supervisor}</div>
              <div style={{ marginTop: 4, opacity: 0.85 }}>{lightboxPhoto.workDone}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
