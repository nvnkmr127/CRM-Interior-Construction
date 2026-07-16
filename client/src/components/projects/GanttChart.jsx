/* eslint-disable no-unused-vars, react-hooks/purity, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, no-useless-assignment */
import React, { useState, useEffect, useRef } from 'react';
import { Badge, Button } from '../ui';
import styles from './GanttChart.module.css';
import { 
  getPhases, 
  getMilestones, 
  getTasks, 
  getTaskDependencies, 
  bulkUpdateTasks, 
  bulkUpdateTaskDependencies,
  getScheduleRevisions
} from '../../api/projects';
import { useToast } from '../../store/toastContext';

// Helper: Format Date to readable Indian format
function formatDateReadable(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Helper: ISO Date string YYYY-MM-DD
function toIsoDateStr(d) {
  if (!d) return '';
  return new Date(d).toISOString().split('T')[0];
}

// Helper: Add days to Date
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Helper: Calculate difference in calendar days
function diffDays(d1, d2) {
  const oneDay = 24 * 60 * 60 * 1000;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  // Reset time to ensure accurate calendar day difference
  date1.setHours(0,0,0,0);
  date2.setHours(0,0,0,0);
  return Math.round((date1 - date2) / oneDay);
}

export default function GanttChart({ projectId, project }) {
  const toast = useToast();
  
  // Loading & Data states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phases, setPhases] = useState([]);
  const [milestones, setMilestones] = useState([]);
  
  // Core lists
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  
  // Backup / Original states to check for edits or discard
  const [originalTasks, setOriginalTasks] = useState([]);
  const [originalDependencies, setOriginalDependencies] = useState([]);

  // UI state
  const [zoom, setZoom] = useState('days'); // 'days' or 'weeks'
  const [isWhatIfMode, setIsWhatIfMode] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // Task ID or object being edited in modal
  const [revisions, setRevisions] = useState([]);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  
  // Timeline dates
  const [timelineStart, setTimelineStart] = useState(new Date());
  const [timelineEnd, setTimelineEnd] = useState(new Date());
  const [dateList, setDateList] = useState([]);

  // Refs for sync scrolling
  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);
  const rightHeaderRef = useRef(null);

  // Topological sorting helper
  function getTopologicalOrder(tasksList, depsList) {
    const adj = {};
    const inDegree = {};
    const taskIds = tasksList.map(t => t.id);
    
    for (const id of taskIds) {
      adj[id] = [];
      inDegree[id] = 0;
    }

    for (const dep of depsList) {
      if (adj[dep.dependsOnTaskId] && inDegree[dep.taskId] !== undefined) {
        adj[dep.dependsOnTaskId].push(dep.taskId);
        inDegree[dep.taskId]++;
      }
    }

    const queue = [];
    for (const id of taskIds) {
      if (inDegree[id] === 0) {
        queue.push(id);
      }
    }

    const order = [];
    while (queue.length > 0) {
      const u = queue.shift();
      order.push(u);
      const neighbors = adj[u] || [];
      for (const v of neighbors) {
        inDegree[v]--;
        if (inDegree[v] === 0) {
          queue.push(v);
        }
      }
    }

    // In case of cycles, append unvisited nodes to ensure all nodes are scheduled
    if (order.length < taskIds.length) {
      const visited = new Set(order);
      for (const id of taskIds) {
        if (!visited.has(id)) {
          order.push(id);
        }
      }
    }

    return order;
  }

  // Date propagation algorithm
  function propagateSchedule(tasksList, depsList) {
    const order = getTopologicalOrder(tasksList, depsList);
    const taskMap = {};
    for (const t of tasksList) {
      taskMap[t.id] = { ...t };
    }

    for (const u of order) {
      const t = taskMap[u];
      if (!t) continue;
      
      const predecessors = depsList.filter(dep => dep.taskId === u);
      let earliestStart = new Date(t.startDate || t.start_date || project?.start_date || Date.now());

      for (const pred of predecessors) {
        const parent = taskMap[pred.dependsOnTaskId];
        if (parent) {
          const parentEnd = new Date(parent.dueDate || parent.due_date);
          const parentStart = new Date(parent.startDate || parent.start_date);
          
          if (pred.dependencyType === 'finish-to-start') {
            const minStart = addDays(parentEnd, 1);
            if (minStart > earliestStart) {
              earliestStart = minStart;
            }
          } else if (pred.dependencyType === 'start-to-start') {
            if (parentStart > earliestStart) {
              earliestStart = parentStart;
            }
          }
        }
      }

      t.startDate = toIsoDateStr(earliestStart);
      const duration = t.durationDays || 1;
      t.dueDate = toIsoDateStr(addDays(earliestStart, duration - 1));
    }

    return Object.values(taskMap);
  }

  // Critical Path Method (CPM) solver
  function solveCPM(tasksList, depsList) {
    if (tasksList.length === 0) return {};

    const taskMap = {};
    for (const t of tasksList) {
      taskMap[t.id] = {
        id: t.id,
        duration: t.durationDays || 1,
        predecessors: [],
        successors: [],
        es: 0, ef: 0, ls: 0, lf: 0, slack: 0
      };
    }

    for (const dep of depsList) {
      const parent = taskMap[dep.dependsOnTaskId];
      const child = taskMap[dep.taskId];
      if (parent && child) {
        child.predecessors.push({ id: dep.dependsOnTaskId, type: dep.dependencyType });
        parent.successors.push({ id: dep.taskId, type: dep.dependencyType });
      }
    }

    const order = getTopologicalOrder(tasksList, depsList);

    // Forward Pass
    for (const tId of order) {
      const t = taskMap[tId];
      if (!t) continue;
      let maxES = 0;
      for (const pred of t.predecessors) {
        const pNode = taskMap[pred.id];
        if (pNode) {
          if (pred.type === 'finish-to-start') {
            maxES = Math.max(maxES, pNode.ef + 1);
          } else if (pred.type === 'start-to-start') {
            maxES = Math.max(maxES, pNode.es);
          }
        }
      }
      t.es = maxES;
      t.ef = t.es + t.duration - 1;
    }

    // Backward Pass
    const maxEF = order.length > 0 ? Math.max(...order.map(id => taskMap[id]?.ef || 0)) : 0;
    const revOrder = [...order].reverse();

    for (const tId of revOrder) {
      const t = taskMap[tId];
      if (!t) continue;
      if (t.successors.length === 0) {
        t.lf = maxEF;
        t.ls = t.lf - t.duration + 1;
      } else {
        let minLF = Infinity;
        for (const succ of t.successors) {
          const sNode = taskMap[succ.id];
          if (sNode) {
            if (succ.type === 'finish-to-start') {
              minLF = Math.min(minLF, sNode.ls - 1);
            } else if (succ.type === 'start-to-start') {
              minLF = Math.min(minLF, sNode.ls + t.duration - 1);
            }
          }
        }
        t.lf = minLF === Infinity ? maxEF : minLF;
        t.ls = t.lf - t.duration + 1;
      }
      t.slack = t.ls - t.es;
    }

    return taskMap;
  }

  // Load project components
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Phases
      const pRes = await getPhases(projectId);
      const rawPhases = pRes.data?.data || pRes.data || [];
      
      // 2. Fetch Milestones in parallel
      const milestonesWithPhase = [];
      const phasesList = [];

      for (const ph of rawPhases) {
        phasesList.push({
          id: ph.id,
          name: ph.name,
          status: ph.status,
          isExecution: ph.is_execution,
          startDate: ph.starts_at ? toIsoDateStr(ph.starts_at) : null,
          endDate: ph.ends_at ? toIsoDateStr(ph.ends_at) : null
        });

        try {
          const mRes = await getMilestones(ph.id);
          const rawMilestones = mRes.data?.data || mRes.data || [];
          for (const m of rawMilestones) {
            milestonesWithPhase.push({
              id: m.id,
              name: m.name,
              status: m.status,
              dueDate: m.due_date ? toIsoDateStr(m.due_date) : null,
              phaseId: ph.id,
              triggersPayment: m.triggers_payment
            });
          }
        } catch (e) {
          console.error(`Failed to fetch milestones for phase ${ph.id}`);
        }
      }

      setPhases(phasesList);
      setMilestones(milestonesWithPhase);

      // 3. Fetch Tasks
      const tRes = await getTasks(projectId, { allTasks: true, limit: 'all' });
      const rawTasks = tRes.data?.data || tRes.data || [];
      const parsedTasks = rawTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        milestoneId: t.milestone_id,
        parentTaskId: t.parent_task_id,
        startDate: t.start_date ? toIsoDateStr(t.start_date) : (t.due_date ? toIsoDateStr(t.due_date) : project?.start_date ? toIsoDateStr(project.start_date) : toIsoDateStr(Date.now())),
        dueDate: t.due_date ? toIsoDateStr(t.due_date) : (t.start_date ? toIsoDateStr(t.start_date) : project?.target_date ? toIsoDateStr(project.target_date) : toIsoDateStr(Date.now())),
        durationDays: t.duration_days || 1,
        roomName: t.room_name,
        baselineStartDate: t.baseline_start_date ? toIsoDateStr(t.baseline_start_date) : null,
        baselineDueDate: t.baseline_due_date ? toIsoDateStr(t.baseline_due_date) : null
      }));

      // Adjust durations if they differ
      for (const t of parsedTasks) {
        t.durationDays = Math.max(1, diffDays(t.dueDate, t.startDate) + 1);
      }

      setTasks(parsedTasks);
      setOriginalTasks(JSON.parse(JSON.stringify(parsedTasks)));

      // 4. Fetch Dependencies
      const dRes = await getTaskDependencies(projectId);
      const rawDeps = dRes.data?.data || dRes.data || [];
      const parsedDeps = rawDeps.map(d => ({
        id: d.id,
        taskId: d.task_id,
        dependsOnTaskId: d.depends_on_task_id,
        dependencyType: d.dependency_type || 'finish-to-start'
      }));

      setDependencies(parsedDeps);
      setOriginalDependencies(JSON.parse(JSON.stringify(parsedDeps)));

    } catch (e) {
      console.error(e);
      toast.error('Failed to load visual schedule data');
    } finally {
      setLoading(false);
    }
  };

  const loadRevisionLog = async () => {
    try {
      const res = await getScheduleRevisions(projectId);
      setRevisions(res.data?.data || res.data || []);
      setShowRevisionModal(true);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load schedule revisions');
    }
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  // Recalculate timeline columns when tasks change
  useEffect(() => {
    if (tasks.length === 0) return;

    // Find min start and max end of tasks and project
    const pStart = project?.start_date ? new Date(project.start_date) : new Date();
    const pEnd = project?.target_date ? new Date(project.target_date) : new Date();

    const minDate = new Date(Math.min(
      pStart,
      ...tasks.map(t => new Date(t.startDate))
    ));
    const maxDate = new Date(Math.max(
      pEnd,
      ...tasks.map(t => new Date(t.dueDate))
    ));

    // Pad dates
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 14);

    setTimelineStart(minDate);
    setTimelineEnd(maxDate);

    // Build dates list
    const dates = [];
    let current = new Date(minDate);
    while (current <= maxDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    setDateList(dates);
  }, [tasks, project]);

  // Handle scroll syncing
  const handleScrollRight = (e) => {
    if (rightHeaderRef.current) {
      rightHeaderRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // Toggle What-If Draft mode
  const handleToggleWhatIf = () => {
    if (isWhatIfMode) {
      // Discarding draft changes
      setTasks(JSON.parse(JSON.stringify(originalTasks)));
      setDependencies(JSON.parse(JSON.stringify(originalDependencies)));
      setIsWhatIfMode(false);
      toast.info('Draft schedule discarded');
    } else {
      setIsWhatIfMode(true);
      toast.warning('Draft mode activated! Shift dates, adjust durations, and review downstream impacts.');
    }
  };

  // Run auto-scheduling propagation
  const handleAutoSchedule = () => {
    if (!isWhatIfMode) return;
    const propagated = propagateSchedule(tasks, dependencies);
    setTasks(propagated);
    toast.success('Tasks rescheduled successfully based on dependency constraints!');
  };

  // Save changes
  const handleSaveSchedule = async () => {
    setSaving(true);
    try {
      // 1. Save Tasks
      const tasksToUpdate = [];
      for (const t of tasks) {
        const orig = originalTasks.find(o => o.id === t.id);
        if (!orig || orig.startDate !== t.startDate || orig.dueDate !== t.dueDate || orig.durationDays !== t.durationDays) {
          tasksToUpdate.push(t);
        }
      }

      if (tasksToUpdate.length > 0) {
        await bulkUpdateTasks(projectId, tasksToUpdate);
      }

      // 2. Save Dependencies
      const depsChanged = JSON.stringify(originalDependencies) !== JSON.stringify(dependencies);
      if (depsChanged) {
        await bulkUpdateTaskDependencies(projectId, dependencies);
      }

      toast.success('Project schedule updated successfully!');
      
      // Update original states
      setOriginalTasks(JSON.parse(JSON.stringify(tasks)));
      setOriginalDependencies(JSON.parse(JSON.stringify(dependencies)));
      setIsWhatIfMode(false);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error?.message || 'Failed to save schedule changes');
    } finally {
      setSaving(false);
    }
  };

  // Update a single task in What-If list
  const handleUpdateTaskField = (taskId, field, value) => {
    let updatedTasks = tasks.map(t => {
      if (t.id !== taskId) return t;
      
      const draft = { ...t };
      if (field === 'startDate') {
        draft.startDate = value;
        // recalculate end date using duration
        const start = new Date(value);
        const dur = draft.durationDays || 1;
        draft.dueDate = toIsoDateStr(addDays(start, dur - 1));
      } else if (field === 'durationDays') {
        const dur = parseInt(value, 10) || 1;
        draft.durationDays = dur;
        const start = new Date(draft.startDate);
        draft.dueDate = toIsoDateStr(addDays(start, dur - 1));
      } else if (field === 'dueDate') {
        draft.dueDate = value;
        // recalculate duration
        draft.durationDays = Math.max(1, diffDays(value, draft.startDate) + 1);
      } else if (field === 'title') {
        draft.title = value;
      }
      return draft;
    });

    // Run propagation to shift successor dates immediately
    updatedTasks = propagateSchedule(updatedTasks, dependencies);
    setTasks(updatedTasks);
  };

  // Manage predecessors
  const handleAddPredecessor = (taskId, parentId, depType = 'finish-to-start') => {
    if (taskId === parentId) return;
    // Check if link already exists
    const exists = dependencies.some(d => d.taskId === taskId && d.dependsOnTaskId === parentId);
    if (exists) return;

    // Check for cycles
    const proposed = [...dependencies, { taskId, dependsOnTaskId: parentId, dependencyType: depType }];
    const adj = {};
    for (const d of proposed) {
      if (!adj[d.taskId]) adj[d.taskId] = [];
      adj[d.taskId].push(d.dependsOnTaskId);
    }

    const visited = new Set();
    const recStack = new Set();
    const hasCycle = (node) => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      recStack.add(node);
      const neighbors = adj[node] || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true;
      }
      recStack.delete(node);
      return false;
    };

    let containsCycle = false;
    for (const node of Object.keys(adj)) {
      if (hasCycle(node)) {
        containsCycle = true;
        break;
      }
    }

    if (containsCycle) {
      toast.error('Cannot add dependency: this would introduce a circular reference!');
      return;
    }

    const newDeps = [...dependencies, {
      taskId,
      dependsOnTaskId: parentId,
      dependencyType: depType
    }];
    setDependencies(newDeps);
    
    // Propagate shifts immediately
    const propagated = propagateSchedule(tasks, newDeps);
    setTasks(propagated);
    toast.success('Dependency added successfully');
  };

  const handleRemovePredecessor = (taskId, parentId) => {
    const newDeps = dependencies.filter(d => !(d.taskId === taskId && d.dependsOnTaskId === parentId));
    setDependencies(newDeps);
    
    // Propagate shifts immediately
    const propagated = propagateSchedule(tasks, newDeps);
    setTasks(propagated);
    toast.success('Dependency removed');
  };

  // Solve Critical Path
  const cpmNodes = solveCPM(tasks, dependencies, project?.start_date);
  
  // Calculate max task end date to determine schedule completion
  const completionDateStr = tasks.reduce((max, t) => {
    if (!max) return t.dueDate;
    return new Date(t.dueDate) > new Date(max) ? t.dueDate : max;
  }, '');

  const projectTarget = project?.target_date ? toIsoDateStr(project.target_date) : '';
  const isBreached = completionDateStr && projectTarget && new Date(completionDateStr) > new Date(projectTarget);
  const overrunDays = isBreached ? diffDays(completionDateStr, projectTarget) : 0;

  // Render variables for scale
  const colWidth = zoom === 'days' ? 32 : 12; // px per day in weeks zoom
  const dayOffsetPixels = (date) => {
    const diff = diffDays(date, timelineStart);
    return diff * colWidth;
  };

  const timelineWidth = dateList.length * colWidth;

  // Flattened grid hierarchy list
  const gridRows = [];
  
  // Group tasks by Phase -> Milestone -> Tasks
  for (const ph of phases) {
    gridRows.push({ type: 'phase', id: ph.id, data: ph });
    
    const phMilestones = milestones.filter(m => m.phaseId === ph.id);
    for (const m of phMilestones) {
      gridRows.push({ type: 'milestone', id: m.id, data: m });
      
      const mTasks = tasks.filter(t => t.milestoneId === m.id);
      for (const t of mTasks) {
        gridRows.push({ type: 'task', id: t.id, data: t });
      }
    }

    // Phase tasks without milestone
    const orphanTasks = tasks.filter(t => {
      if (t.parentTaskId) return false; // filter out subtasks for linear scheduling view
      const milestone = milestones.find(m => m.id === t.milestoneId);
      return !milestone && phases.find(p => p.id === ph.id) && t.milestoneId === ph.id; // fallback checks
    });
    
    for (const t of orphanTasks) {
      gridRows.push({ type: 'task', id: t.id, data: t });
    }
  }

  // Fallback: Tasks with no milestones or phase matches
  const unassignedTasks = tasks.filter(t => !t.milestoneId && !t.parentTaskId);
  if (unassignedTasks.length > 0 && phases.length > 0) {
    gridRows.push({ type: 'phase', id: 'unassigned', data: { name: 'Unscheduled Tasks', id: 'unassigned' } });
    for (const t of unassignedTasks) {
      gridRows.push({ type: 'task', id: t.id, data: t });
    }
  }

  // Check if draft has changes
  const hasChanges = isWhatIfMode && (
    JSON.stringify(originalTasks) !== JSON.stringify(tasks) ||
    JSON.stringify(originalDependencies) !== JSON.stringify(dependencies)
  );

  if (loading) {
    return <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>Loading visual schedule…</div>;
  }

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.title}>Visual Schedule & Gantt</div>
          <button 
            className={`${styles.modeToggle} ${isWhatIfMode ? styles.modeToggleActive : ''}`}
            onClick={handleToggleWhatIf}
          >
            📊 {isWhatIfMode ? 'What-If Mode (Draft Active)' : 'Switch to What-If Mode'}
          </button>
        </div>

        <div className={styles.toolbarRight}>
          <button 
            className={`${styles.actionBtn} ${styles.btnSecondary}`}
            onClick={loadRevisionLog}
          >
            🕰 Revision Log
          </button>

          <div className={styles.btnGroup}>
            <button 
              className={`${styles.btnGroupBtn} ${zoom === 'days' ? styles.btnGroupBtnActive : ''}`}
              onClick={() => setZoom('days')}
            >
              Days
            </button>
            <button 
              className={`${styles.btnGroupBtn} ${zoom === 'weeks' ? styles.btnGroupBtnActive : ''}`}
              onClick={() => setZoom('weeks')}
            >
              Weeks
            </button>
          </div>

          {isWhatIfMode && (
            <>
              <button 
                className={`${styles.actionBtn} ${styles.btnSecondary}`}
                onClick={handleAutoSchedule}
                title="Resolve overlaps and shift dates based on constraints"
              >
                ⚙ Auto-Schedule
              </button>
              <button 
                className={`${styles.actionBtn} ${styles.btnSuccess}`}
                disabled={!hasChanges || saving}
                onClick={handleSaveSchedule}
              >
                {saving ? 'Saving...' : 'Apply Schedule'}
              </button>
              <button 
                className={`${styles.actionBtn} ${styles.btnDanger}`}
                onClick={handleToggleWhatIf}
              >
                Cancel Draft
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Project Target Date:</span>
          <span className={styles.summaryValue}>{formatDateReadable(project?.target_date)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Estimated Completion:</span>
          <span className={`${styles.summaryValue} ${isBreached ? styles.breachWarning : ''}`}>
            {formatDateReadable(completionDateStr)}
            {isBreached && ` (Delayed by ${overrunDays} days)`}
          </span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Tasks:</span>
          <span className={styles.summaryValue}>{tasks.length}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Dependencies Linked:</span>
          <span className={styles.summaryValue}>{dependencies.length}</span>
        </div>
        {isWhatIfMode && !hasChanges && (
          <div style={{ marginLeft: 'auto', fontStyle: 'italic', color: 'var(--color-warning)' }}>
            ⚠️ Make adjustments in the table to test delays.
          </div>
        )}
        {hasChanges && (
          <div style={{ marginLeft: 'auto', fontWeight: 'bold', color: 'var(--color-success)' }}>
            ✓ Draft schedule has modifications. Click "Apply" to save.
          </div>
        )}
      </div>

      {/* Main Workspace Layout */}
      <div className={styles.mainLayout}>
        {isWhatIfMode && (
          <div className={styles.whatIfOverlay}>
            <span className={styles.whatIfBadge}>Draft Sandbox</span>
          </div>
        )}

        {/* Left Side Tree-Table */}
        <div className={styles.leftPanel} ref={leftPanelRef}>
          <div className={styles.tableHeader}>
            <div className={`${styles.tableCell} ${styles.colTitle}`}>WBS Element</div>
            <div className={`${styles.tableCell} ${styles.colStatus}`}>Status</div>
            <div className={`${styles.tableCell} ${styles.colStart}`}>Start Date</div>
            <div className={`${styles.tableCell} ${styles.colDuration}`}>Dur (d)</div>
            <div className={`${styles.tableCell} ${styles.colPredecessor}`}>Preds</div>
          </div>

          {gridRows.map((row) => {
            const isCritical = row.type === 'task' && cpmNodes[row.id] && cpmNodes[row.id].slack <= 0;
            const rowClass = row.type === 'phase' 
              ? styles.rowPhase 
              : row.type === 'milestone' 
              ? styles.rowMilestone 
              : styles.rowTask;

            return (
              <div 
                key={`${row.type}-${row.id}`} 
                className={`${styles.tableRow} ${rowClass} ${isCritical ? styles.rowCritical : ''}`}
              >
                {/* WBS element Title */}
                <div className={`${styles.tableCell} ${styles.colTitle}`}>
                  {row.type === 'phase' && `📁 Phase: ${row.data.name}`}
                  {row.type === 'milestone' && (
                    <span className={styles.indent1}>
                      💎 Milestone: {row.data.name}
                    </span>
                  )}
                  {row.type === 'task' && (
                    <span className={styles.indent2} title={row.data.title}>
                      📝 {row.data.title}
                    </span>
                  )}
                </div>

                {/* Status Column */}
                <div className={`${styles.tableCell} ${styles.colStatus}`}>
                  {row.type === 'phase' && (
                    <Badge variant={row.data.status === 'completed' ? 'success' : row.data.status === 'in_progress' ? 'warning' : 'neutral'} size="sm">
                      {row.data.status?.toUpperCase() || 'PENDING'}
                    </Badge>
                  )}
                  {row.type === 'milestone' && (
                    <Badge variant={row.data.status === 'completed' ? 'success' : 'neutral'} size="sm">
                      {row.data.status?.toUpperCase() || 'PENDING'}
                    </Badge>
                  )}
                  {row.type === 'task' && (
                    <Badge variant={row.data.status === 'done' ? 'success' : row.data.status === 'in_progress' ? 'warning' : row.data.status === 'blocked' ? 'danger' : 'neutral'} size="sm">
                      {row.data.status?.toUpperCase()}
                    </Badge>
                  )}
                </div>

                {/* Dates Start */}
                <div className={`${styles.tableCell} ${styles.colStart}`}>
                  {row.type === 'task' && (
                    isWhatIfMode ? (
                      <input 
                        type="date"
                        value={row.data.startDate}
                        className={styles.inputField}
                        onChange={(e) => handleUpdateTaskField(row.id, 'startDate', e.target.value)}
                      />
                    ) : (
                      formatDateReadable(row.data.startDate)
                    )
                  )}
                  {row.type === 'milestone' && formatDateReadable(row.data.dueDate)}
                  {row.type === 'phase' && row.data.startDate && formatDateReadable(row.data.startDate)}
                </div>

                {/* Duration */}
                <div className={`${styles.tableCell} ${styles.colDuration}`}>
                  {row.type === 'task' && (
                    isWhatIfMode ? (
                      <input 
                        type="number"
                        min="1"
                        value={row.data.durationDays}
                        className={styles.inputField}
                        onChange={(e) => handleUpdateTaskField(row.id, 'durationDays', e.target.value)}
                      />
                    ) : (
                      `${row.data.durationDays}d`
                    )
                  )}
                </div>

                {/* Predecessors / Dependencies Trigger */}
                <div className={`${styles.tableCell} ${styles.colPredecessor}`}>
                  {row.type === 'task' && (
                    isWhatIfMode ? (
                      <button 
                        style={{ padding: '2px 6px', fontSize: '9px', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => setEditingTask(row.data)}
                      >
                        🔗 {dependencies.filter(d => d.taskId === row.id).length}
                      </button>
                    ) : (
                      dependencies.filter(d => d.taskId === row.id).length > 0 && (
                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                          {dependencies.filter(d => d.taskId === row.id).length} links
                        </span>
                      )
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side Timeline */}
        <div 
          className={styles.rightPanel} 
          ref={rightPanelRef}
          onScroll={handleScrollRight}
        >
          {/* Timeline Header Date Grid */}
          <div className={styles.timelineHeader} style={{ width: timelineWidth }}>
            <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
              {/* Months */}
              <div style={{ display: 'flex', height: '60%', borderBottom: '1px solid var(--color-border)' }}>
                {dateList.reduce((acc, date, idx) => {
                  const monthName = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                  const prev = acc[acc.length - 1];
                  if (prev && prev.name === monthName) {
                    prev.width += colWidth;
                  } else {
                    acc.push({ name: monthName, width: colWidth });
                  }
                  return acc;
                }, []).map((m, idx) => (
                  <div 
                    key={idx} 
                    className={styles.headerMonth} 
                    style={{ width: m.width, borderRight: '1px solid var(--color-border)' }}
                  >
                    {m.width > 50 ? m.name : ''}
                  </div>
                ))}
              </div>

              {/* Days/Weeks */}
              <div style={{ display: 'flex', height: '40%' }}>
                {dateList.map((date, idx) => {
                  const day = date.getDate();
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <div 
                      key={idx} 
                      className={`${styles.headerDay} ${isWeekend ? styles.gridColWeekend : ''}`}
                      style={{ width: colWidth, borderRight: '1px solid var(--color-border)' }}
                    >
                      {zoom === 'days' ? day : (date.getDay() === 1 ? 'W' : '')}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Timeline Body Area */}
          <div className={styles.timelineBody} style={{ width: timelineWidth }}>
            {/* SVG Dependencies Connector Overlay */}
            <svg className={styles.svgConnector} style={{ width: timelineWidth, height: gridRows.length * 40 }}>
              <defs>
                <marker 
                  id="arrow-normal" 
                  viewBox="0 0 10 10" 
                  refX="6" 
                  refY="5" 
                  markerWidth="6" 
                  markerHeight="6" 
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" className={styles.dependencyArrow} />
                </marker>
                <marker 
                  id="arrow-critical" 
                  viewBox="0 0 10 10" 
                  refX="6" 
                  refY="5" 
                  markerWidth="6" 
                  markerHeight="6" 
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" className={styles.dependencyArrowCritical} />
                </marker>
              </defs>

              {dependencies.map((dep, dIdx) => {
                const parentRowIdx = gridRows.findIndex(r => r.type === 'task' && r.id === dep.dependsOnTaskId);
                const childRowIdx = gridRows.findIndex(r => r.type === 'task' && r.id === dep.taskId);
                
                const parent = tasks.find(t => t.id === dep.dependsOnTaskId);
                const child = tasks.find(t => t.id === dep.taskId);

                if (parentRowIdx === -1 || childRowIdx === -1 || !parent || !child) return null;

                const parentCpm = cpmNodes[parent.id];
                const childCpm = cpmNodes[child.id];
                const isCriticalLink = parentCpm && childCpm && parentCpm.slack <= 0 && childCpm.slack <= 0;

                const y1 = parentRowIdx * 40 + 20; // middle of row
                const y2 = childRowIdx * 40 + 20;

                let x1, x2;
                if (dep.dependencyType === 'finish-to-start') {
                  x1 = dayOffsetPixels(parent.dueDate) + colWidth; // end of predecessor
                  x2 = dayOffsetPixels(child.startDate); // start of successor
                } else {
                  x1 = dayOffsetPixels(parent.startDate); // start of predecessor
                  x2 = dayOffsetPixels(child.startDate); // start of successor
                }

                // Bezier connector path
                let pathStr = '';
                if (x2 >= x1) {
                  // Standard forward S-curve path
                  const midX = (x1 + x2) / 2;
                  pathStr = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
                } else {
                  // Loopback path for delayed items
                  const pad = 12;
                  const loopX = x1 + pad;
                  const midY = (y1 + y2) / 2;
                  pathStr = `M ${x1} ${y1} H ${loopX} V ${midY} H ${x2 - pad} V ${y2} H ${x2}`;
                }

                return (
                  <path 
                    key={dIdx}
                    d={pathStr}
                    className={`${styles.dependencyPath} ${isCriticalLink ? styles.dependencyPathCritical : ''}`}
                    markerEnd={`url(#${isCriticalLink ? 'arrow-critical' : 'arrow-normal'})`}
                  />
                );
              })}
            </svg>

            {/* Vertical grid lines */}
            {dateList.map((date, idx) => {
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <div 
                  key={idx}
                  className={`${styles.gridCol} ${isWeekend ? styles.gridColWeekend : ''}`}
                  style={{ left: idx * colWidth, width: colWidth }}
                />
              );
            })}

            {/* Rows with Bars */}
            {gridRows.map((row, idx) => {
              if (row.type === 'phase') {
                // Find span of phase (min start and max end of child milestones/tasks)
                const phaseTasks = tasks.filter(t => {
                  const m = milestones.find(m => m.id === t.milestoneId && m.phaseId === row.id);
                  return m || t.milestoneId === row.id;
                });
                if (phaseTasks.length === 0) return <div key={idx} className={styles.timelineRow} />;

                const startDates = phaseTasks.map(t => new Date(t.startDate));
                const endDates = phaseTasks.map(t => new Date(t.dueDate));

                const phStart = new Date(Math.min(...startDates));
                const phEnd = new Date(Math.max(...endDates));

                const left = dayOffsetPixels(toIsoDateStr(phStart));
                const width = Math.max(8, (diffDays(phEnd, phStart) + 1) * colWidth);

                return (
                  <div key={idx} className={styles.timelineRow}>
                    <div 
                      className={`${styles.bar} ${styles.barPhase}`}
                      style={{ left, width }}
                    >
                      {row.data.name}
                    </div>
                  </div>
                );
              }

              if (row.type === 'milestone') {
                if (!row.data.dueDate) return <div key={idx} className={styles.timelineRow} />;
                const left = dayOffsetPixels(row.data.dueDate) + (colWidth / 2) - 7;
                return (
                  <div key={idx} className={styles.timelineRow}>
                    <div 
                      className={`${styles.bar} ${styles.barMilestone}`}
                      style={{ left }}
                      title={`Milestone: ${row.data.name} (Due: ${row.data.dueDate})`}
                    />
                    <span className={styles.barLabel} style={{ left: left + 20 }}>
                      {row.data.name}
                    </span>
                  </div>
                );
              }

              // Rendering Task Bars
              const left = dayOffsetPixels(row.data.startDate);
              const width = Math.max(8, row.data.durationDays * colWidth);
              const isCritical = cpmNodes[row.id] && cpmNodes[row.id].slack <= 0;

              let taskStatusClass = styles.statusTodo;
              if (row.data.status === 'in_progress') taskStatusClass = styles.statusInProgress;
              if (row.data.status === 'blocked') taskStatusClass = styles.statusBlocked;
              if (row.data.status === 'done') taskStatusClass = styles.statusDone;

              return (
                <div key={idx} className={styles.timelineRow}>
                  {row.data.baselineStartDate && row.data.baselineDueDate && (
                    <div 
                      className={styles.baselineBar}
                      style={{ 
                        left: dayOffsetPixels(row.data.baselineStartDate), 
                        width: Math.max(8, (diffDays(row.data.baselineDueDate, row.data.baselineStartDate) + 1) * colWidth) 
                      }}
                      title={`Baseline: ${row.data.baselineStartDate} -> ${row.data.baselineDueDate}`}
                    />
                  )}
                  <div 
                    className={`${styles.bar} ${styles.barTask} ${taskStatusClass} ${isCritical ? styles.barCritical : ''}`}
                    style={{ left, width }}
                    title={`${row.data.title}\nStart: ${row.data.startDate}\nDue: ${row.data.dueDate}\nDuration: ${row.data.durationDays} days\nStatus: ${row.data.status}`}
                  >
                    {width > 60 && row.data.title}
                  </div>
                  <span className={styles.barLabel} style={{ left: left + width + 8 }}>
                    {row.data.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* What-If Predecessor Dependency Editor Modal */}
      {editingTask && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Link Dependencies for: {editingTask.title}</h3>
              <button 
                onClick={() => setEditingTask(null)}
                style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* Linked list */}
              <div className={styles.formGroup}>
                <label>Current Predecessors (Must be finished/started before this task can begin)</label>
                {dependencies.filter(d => d.taskId === editingTask.id).length === 0 ? (
                  <div style={{ fontStyle: 'italic', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                    No predecessor links defined.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dependencies.filter(d => d.taskId === editingTask.id).map((dep, idx) => {
                      const parent = tasks.find(t => t.id === dep.dependsOnTaskId);
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface-hover)', padding: '6px 12px', borderRadius: '6px', fontSize: 'var(--text-xs)' }}>
                          <span>
                            🏁 <b>{parent?.title || 'Unknown Task'}</b> ({dep.dependencyType})
                          </span>
                          <button 
                            className={`${styles.actionBtn} ${styles.btnDanger}`}
                            style={{ padding: '2px 8px', fontSize: '10px' }}
                            onClick={() => handleRemovePredecessor(editingTask.id, dep.dependsOnTaskId)}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)' }} />

              {/* Add Dependency fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4>Link a New Predecessor</h4>
                
                <div className={styles.formGroup}>
                  <label>Select Task</label>
                  <select 
                    id="new-predecessor-select"
                    className={styles.inputField}
                    defaultValue=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const typeSelect = document.getElementById('new-predecessor-type');
                        handleAddPredecessor(editingTask.id, val, typeSelect.value);
                        e.target.value = ""; // Reset
                      }
                    }}
                  >
                    <option value="" disabled>-- Choose a predecessor task --</option>
                    {tasks
                      .filter(t => t.id !== editingTask.id && !t.parentTaskId) // Cannot depend on self or child
                      .filter(t => !dependencies.some(d => d.taskId === editingTask.id && d.dependsOnTaskId === t.id)) // Not already linked
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))
                    }
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Link Relationship Type</label>
                  <select id="new-predecessor-type" className={styles.inputField} defaultValue="finish-to-start">
                    <option value="finish-to-start">Finish-to-Start (FS) - Successor starts after predecessor ends</option>
                    <option value="start-to-start">Start-to-Start (SS) - Successor starts after predecessor starts</option>
                  </select>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <Button 
                variant="primary"
                onClick={() => setEditingTask(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Revision Log Modal */}
      {showRevisionModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent} style={{ width: '680px', maxWidth: '95%' }}>
            <div className={styles.modalHeader}>
              <h3>Project Schedule Revisions Log</h3>
              <button 
                onClick={() => setShowRevisionModal(false)}
                style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <div className={styles.modalBody} style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {revisions.length === 0 ? (
                <div style={{ fontStyle: 'italic', padding: '20px 0', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  No schedule revisions logged for this project yet.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-hover)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '8px 12px' }}>Rev</th>
                      <th style={{ padding: '8px 12px' }}>Date</th>
                      <th style={{ padding: '8px 12px' }}>Author</th>
                      <th style={{ padding: '8px 12px' }}>Timeline Shift</th>
                      <th style={{ padding: '8px 12px' }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revisions.map((rev) => (
                      <tr key={rev.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px 12px' }}><b>#{rev.revision_number}</b></td>
                        <td style={{ padding: '8px 12px' }}>{new Date(rev.revised_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                        <td style={{ padding: '8px 12px' }}>{rev.revised_by_name || 'System'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>
                            {formatDateReadable(rev.previous_start_date)} to {formatDateReadable(rev.previous_target_date)}
                          </span>
                          <div style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                            {formatDateReadable(rev.new_start_date)} to {formatDateReadable(rev.new_target_date)}
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'pre-wrap' }}>{rev.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className={styles.modalFooter}>
              <Button onClick={() => setShowRevisionModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
