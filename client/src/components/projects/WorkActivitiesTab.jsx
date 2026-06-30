import React, { useState, useEffect } from 'react';
import { Button, Badge } from '../ui';
import styles from './WorkActivitiesTab.module.css';
import { getPhases } from '../../api/projects';
import { usersApi } from '../../api/users';
import { useToast } from '../../store/toastContext';
import {
  getWorkActivities,
  createWorkActivity,
  updateWorkActivity,
  deleteWorkActivity,
  generateWorkActivities,
  createWorkActivityDependency,
  deleteWorkActivityDependency,
  uploadWorkActivityPhoto,
  deleteWorkActivityPhoto
} from '../../api/workActivities';

const TRADES = [
  { id: 'civil', label: 'Civil Work' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'false_ceiling', label: 'False Ceiling' },
  { id: 'flooring', label: 'Flooring' },
  { id: 'painting', label: 'Painting' },
  { id: 'carpentry', label: 'Carpentry' },
  { id: 'glass', label: 'Glass Work' },
  { id: 'soft_furnishing', label: 'Soft Furnishing' }
];

export default function WorkActivitiesTab({ projectId, project }) {
  const toast = useToast();
  const [activities, setActivities] = useState([]);
  const [phases, setPhases] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [selectedTrade, setSelectedTrade] = useState('all');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Generator form state
  const [genPhase, setGenPhase] = useState('');
  const [genRoom, setGenRoom] = useState('');
  const [genCustomRoom, setGenCustomRoom] = useState('');
  const [genTrade, setGenTrade] = useState('civil');
  const [generating, setGenerating] = useState(false);

  // Custom add state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addPhase, setAddPhase] = useState('');
  const [addRoom, setAddRoom] = useState('');
  const [addCustomRoom, setAddCustomRoom] = useState('');
  const [addTrade, setAddTrade] = useState('civil');
  const [addAssignee, setAddAssignee] = useState('');
  const [addDueDate, setAddDueDate] = useState('');
  const [adding, setAdding] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [actRes, phaseRes, userRes] = await Promise.all([
        getWorkActivities(projectId),
        getPhases(projectId),
        usersApi.getAll().catch(() => [])
      ]);
      setActivities(actRes.data?.data || actRes.data || []);
      const pList = phaseRes.data?.data || phaseRes.data || [];
      setPhases(pList);
      setUsers(userRes || []);

      // Auto-select first phase for generator
      if (pList.length > 0) {
        // Prefer execution phase
        const exec = pList.find(p => p.is_execution || p.name.toLowerCase().includes('execution'));
        setGenPhase(exec?.id || pList[0].id);
        setAddPhase(exec?.id || pList[0].id);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load work activity data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  // Extract unique rooms
  const roomsList = React.useMemo(() => {
    const list = new Set(['General']);
    if (project?.measurements) {
      project.measurements.forEach(m => {
        if (m.room_name) list.add(m.room_name);
      });
    }
    activities.forEach(a => {
      if (a.room_name) list.add(a.room_name);
    });
    return Array.from(list);
  }, [project, activities]);

  // Handle status toggle (completed/todo)
  const handleToggleComplete = async (act) => {
    const nextStatus = act.status === 'completed' ? 'todo' : 'completed';
    const oldStatus = act.status;

    if (nextStatus === 'completed') {
      const incomplete = act.qc_checklist?.filter(item => item.required && !item.is_checked) || [];
      if (incomplete.length > 0) {
        toast.error(`Cannot complete activity: Please check all required QC checklist items first.`);
        return;
      }
    }

    // Optimistic update
    setActivities(prev =>
      prev.map(a =>
        a.id === act.id
          ? {
              ...a,
              status: nextStatus,
              completed_at: nextStatus === 'completed' ? new Date().toISOString() : null
            }
          : a
      )
    );

    try {
      await updateWorkActivity(projectId, act.id, { status: nextStatus });
      toast.success(`Activity marked as ${nextStatus}`);
    } catch (err) {
      // Revert
      setActivities(prev =>
        prev.map(a => (a.id === act.id ? { ...a, status: oldStatus } : a))
      );
      
      if (err.response?.data?.error?.code === 'DEPENDENCY_UNSATISFIED_SOFT') {
        if (window.confirm(err.response.data.error.message)) {
          try {
            await updateWorkActivity(projectId, act.id, { status: nextStatus, force: true });
            toast.success(`Activity marked as ${nextStatus} (Forced)`);
            setActivities(prev =>
              prev.map(a =>
                a.id === act.id
                  ? { ...a, status: nextStatus, completed_at: nextStatus === 'completed' ? new Date().toISOString() : null }
                  : a
              )
            );
          } catch (forceErr) {
            toast.error(forceErr.response?.data?.error?.message || 'Failed to update activity status');
          }
        }
        return;
      }
      
      const errMsg = err.response?.data?.error?.message || 'Failed to update activity status';
      toast.error(errMsg);
    }
  };

  // Handle inline changes (assignee, status dropdown, due date, notes)
  const handleUpdateActivity = async (id, field, value) => {
    if (field === 'status' && value === 'completed') {
      const act = activities.find(a => a.id === id);
      const incomplete = act?.qc_checklist?.filter(item => item.required && !item.is_checked) || [];
      if (incomplete.length > 0) {
        toast.error(`Cannot complete activity: Please check all required QC checklist items first.`);
        return;
      }
    }
    try {
      const payload = { [field]: value === '' ? null : value };
      const res = await updateWorkActivity(projectId, id, payload);
      const updated = res.data?.data || res.data;
      if (updated) {
        setActivities(prev => prev.map(a => (a.id === id ? { ...a, ...updated } : a)));
      }
    } catch (err) {
      if (err.response?.data?.error?.code === 'DEPENDENCY_UNSATISFIED_SOFT') {
        if (window.confirm(err.response.data.error.message)) {
          try {
            const payload = { [field]: value === '' ? null : value, force: true };
            const res = await updateWorkActivity(projectId, id, payload);
            const updated = res.data?.data || res.data;
            if (updated) {
              setActivities(prev => prev.map(a => (a.id === id ? { ...a, ...updated } : a)));
            }
            return;
          } catch (forceErr) {
            toast.error(forceErr.response?.data?.error?.message || 'Failed to update activity');
          }
        }
      } else {
        const errMsg = err.response?.data?.error?.message || 'Failed to update activity';
        toast.error(errMsg);
      }
      fetchData();
    }
  };

  const handleToggleQcItem = async (act, itemIndex, isChecked) => {
    const updatedChecklist = act.qc_checklist.map((item, idx) => 
      idx === itemIndex ? { ...item, is_checked: isChecked } : item
    );

    // Optimistic update
    setActivities(prev =>
      prev.map(a =>
        a.id === act.id
          ? {
              ...a,
              qc_checklist: updatedChecklist
            }
          : a
      )
    );

    try {
      await updateWorkActivity(projectId, act.id, { qc_checklist: updatedChecklist });
    } catch {
      // Revert on error
      setActivities(prev =>
        prev.map(a =>
          a.id === act.id
            ? {
                ...a,
                qc_checklist: act.qc_checklist
              }
            : a
        )
      );
      toast.error('Failed to update QC checklist item');
    }
  };

  // Handle delete
  const handleDeleteActivity = async (id) => {
    if (!window.confirm('Delete this work activity?')) return;
    try {
      await deleteWorkActivity(projectId, id);
      setActivities(prev => prev.filter(a => a.id !== id));
      toast.success('Activity deleted');
    } catch {
      toast.error('Failed to delete activity');
    }
  };

  // Handle adding dependency
  const handleAddDependency = async (activityId, dependsOnActivityId) => {
    try {
      await createWorkActivityDependency(projectId, { activityId, dependsOnActivityId });
      toast.success('Prerequisite dependency added.');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to add dependency.');
    }
  };

  // Handle removing dependency
  const handleRemoveDependency = async (dependencyId) => {
    try {
      await deleteWorkActivityDependency(projectId, dependencyId);
      toast.success('Dependency removed.');
      fetchData();
    } catch (err) {
      toast.error('Failed to remove dependency.');
    }
  };

  // Handle photo upload
  const handleUploadPhoto = async (activityId, file) => {
    try {
      toast.info('Uploading photo evidence...');
      await uploadWorkActivityPhoto(projectId, activityId, file);
      toast.success('Photo evidence uploaded successfully.');
      fetchData();
    } catch (err) {
      toast.error('Failed to upload photo evidence.');
    }
  };

  // Handle photo delete
  const handleDeletePhoto = async (activityId, photoId) => {
    if (!window.confirm('Are you sure you want to delete this completion photo?')) return;
    try {
      await deleteWorkActivityPhoto(projectId, activityId, photoId);
      toast.success('Photo evidence deleted.');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete photo.');
    }
  };

  // Handle generate checklist
  const handleGenerate = async (e) => {
    e.preventDefault();
    const finalRoom = genRoom === 'custom' ? genCustomRoom : genRoom;
    if (!finalRoom) {
      toast.error('Please specify a Room/Area');
      return;
    }
    setGenerating(true);
    try {
      const res = await generateWorkActivities(projectId, {
        phaseId: genPhase || null,
        roomName: finalRoom,
        trade: genTrade
      });
      const generated = res.data?.data || res.data || [];
      if (generated.length > 0) {
        setActivities(prev => [...prev, ...generated]);
        toast.success(`Successfully generated ${generated.length} activities for ${finalRoom}!`);
      } else {
        toast.info('No new activities generated (they might already exist).');
      }
      setGenCustomRoom('');
    } catch (e) {
      toast.error('Failed to generate activities.');
    } finally {
      setGenerating(false);
    }
  };

  // Handle custom add activity
  const handleAddCustom = async (e) => {
    e.preventDefault();
    const finalRoom = addRoom === 'custom' ? addCustomRoom : addRoom;
    if (!addName) {
      toast.error('Activity title is required');
      return;
    }
    if (!finalRoom) {
      toast.error('Room/Area is required');
      return;
    }
    setAdding(true);
    try {
      const res = await createWorkActivity(projectId, {
        phase_id: addPhase || null,
        room_name: finalRoom,
        trade: addTrade,
        activity_name: addName,
        description: addDesc,
        assignee_id: addAssignee || null,
        due_date: addDueDate || null,
        status: 'todo'
      });
      const created = res.data?.data || res.data;
      if (created) {
        setActivities(prev => [...prev, created]);
        toast.success('Custom activity added successfully.');
        setAddName('');
        setAddDesc('');
        setAddCustomRoom('');
        setAddDueDate('');
        setShowAddForm(false);
      }
    } catch {
      toast.error('Failed to add custom activity.');
    } finally {
      setAdding(false);
    }
  };

  // Metrics calculations
  const totalCount = activities.length;
  const completedCount = activities.filter(a => a.status === 'completed').length;
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Group by trade for metrics
  const tradeMetrics = TRADES.map(t => {
    const list = activities.filter(a => a.trade === t.id);
    const total = list.length;
    const completed = list.filter(a => a.status === 'completed').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { ...t, total, completed, progress };
  }).filter(t => t.total > 0);

  // Group by room for metrics
  const roomMetrics = roomsList.map(r => {
    const list = activities.filter(a => a.room_name === r);
    const total = list.length;
    const completed = list.filter(a => a.status === 'completed').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { name: r, total, completed, progress };
  }).filter(r => r.total > 0);

  // Filtered activities list
  const filteredActivities = activities.filter(a => {
    if (selectedTrade !== 'all' && a.trade !== selectedTrade) return false;
    if (selectedRoom !== 'all' && a.room_name !== selectedRoom) return false;
    if (selectedStatus !== 'all' && a.status !== selectedStatus) return false;
    return true;
  });

  if (loading) {
    return <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>Loading activities tracking panel…</div>;
  }

  return (
    <div className={styles.container}>
      {/* Metrics Dashboard */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricTitle}>Overall Completion</div>
          <div className={styles.metricValue}>{overallProgress}%</div>
          <div className={styles.progressBarContainer}>
            <div className={styles.progressBar} style={{ width: `${overallProgress}%` }} />
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 8 }}>
            {completedCount} of {totalCount} daily checklist activities completed
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricTitle}>Active Trades</div>
          <div className={styles.metricValue}>{tradeMetrics.length}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Trades currently deployed and scheduled on site
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricTitle}>Active Rooms</div>
          <div className={styles.metricValue}>{roomMetrics.length}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Rooms/areas undergoing construction activities
          </div>
        </div>
      </div>

      {/* Horizontal Trades Scroll */}
      {tradeMetrics.length > 0 && (
        <div>
          <div className={styles.filterSectionTitle}>Site Progress by Trade</div>
          <div className={styles.tradeScroll}>
            {tradeMetrics.map(tm => (
              <div key={tm.id} className={styles.tradeProgressCard}>
                <div className={styles.tradeProgressCardTitle}>{tm.label}</div>
                <div className={styles.tradeProgressCardCount}>{tm.completed}/{tm.total} Done</div>
                <div className={styles.tradeMiniBarContainer}>
                  <div
                    className={`${styles.tradeMiniBar} ${styles[`trade_${tm.id}`]}`}
                    style={{ width: `${tm.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Split Layout */}
      <div className={styles.workspace}>
        {/* Left Filters Panel */}
        <div className={styles.filtersPanel}>
          <div>
            <div className={styles.filterSectionTitle}>Filter by Trade</div>
            <div className={styles.tradeChips}>
              <button
                className={`${styles.chipBtn} ${selectedTrade === 'all' ? styles.chipBtnActive : ''}`}
                onClick={() => setSelectedTrade('all')}
              >
                <span>All Trades</span>
                <span className={styles.chipCount}>{activities.length}</span>
              </button>
              {TRADES.map(t => {
                const count = activities.filter(a => a.trade === t.id).length;
                return (
                  <button
                    key={t.id}
                    className={`${styles.chipBtn} ${selectedTrade === t.id ? styles.chipBtnActive : ''}`}
                    onClick={() => setSelectedTrade(t.id)}
                  >
                    <span>{t.label}</span>
                    {count > 0 && <span className={styles.chipCount}>{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className={styles.filterSectionTitle}>Filter by Room/Area</div>
            <select
              className={styles.formInput}
              style={{ width: '100%' }}
              value={selectedRoom}
              onChange={e => setSelectedRoom(e.target.value)}
            >
              <option value="all">All Rooms ({roomsList.length})</option>
              {roomsList.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className={styles.filterSectionTitle}>Status Filter</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'todo', 'in_progress', 'completed'].map(st => (
                <button
                  key={st}
                  style={{
                    flex: 1,
                    padding: '4px 6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    textTransform: 'capitalize',
                    background: selectedStatus === st ? 'var(--color-accent)' : 'var(--color-surface-3)',
                    color: selectedStatus === st ? 'white' : 'var(--color-text-secondary)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedStatus(st)}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Main Checklist Board */}
        <div className={styles.mainPanel}>
          {/* Section Toolbar */}
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Daily Construction Checklist</div>
            <div className={styles.panelActions}>
              <Button
                variant={showAddForm ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? '✕ Close Form' : '＋ Add Custom Activity'}
              </Button>
            </div>
          </div>

          {/* Add Custom Activity Form */}
          {showAddForm && (
            <form className={styles.actionCard} onSubmit={handleAddCustom}>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 12 }}>
                Add Custom Work Activity
              </div>
              <div className={styles.formGrid}>
                <div className={styles.formField}>
                  <label>Activity Title *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Tile Laying Main Wall"
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.formField}>
                  <label>Trade *</label>
                  <select
                    className={styles.formInput}
                    value={addTrade}
                    onChange={e => setAddTrade(e.target.value)}
                  >
                    {TRADES.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formField}>
                  <label>Room/Area *</label>
                  <select
                    className={styles.formInput}
                    value={addRoom}
                    onChange={e => {
                      setAddRoom(e.target.value);
                      if (e.target.value !== 'custom' && addCustomRoom) setAddCustomRoom('');
                    }}
                  >
                    <option value="">Select Room</option>
                    {roomsList.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="custom">＋ Add Custom Room</option>
                  </select>
                </div>
                {addRoom === 'custom' && (
                  <div className={styles.formField}>
                    <label>Custom Room Name *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Master Bedroom"
                      value={addCustomRoom}
                      onChange={e => setAddCustomRoom(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className={styles.formField}>
                  <label>Project Phase</label>
                  <select
                    className={styles.formInput}
                    value={addPhase}
                    onChange={e => setAddPhase(e.target.value)}
                  >
                    <option value="">No Phase Link</option>
                    {phases.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formField}>
                  <label>Assignee</label>
                  <select
                    className={styles.formInput}
                    value={addAssignee}
                    onChange={e => setAddAssignee(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role || 'user'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formField}>
                  <label>Due Date</label>
                  <input
                    type="date"
                    className={styles.formInput}
                    value={addDueDate}
                    onChange={e => setAddDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.formField} style={{ marginBottom: 16 }}>
                <label>Description / Checklist Details</label>
                <textarea
                  className={styles.formInput}
                  style={{ minHeight: 60, fontFamily: 'inherit' }}
                  placeholder="Additional specs or details for the supervisor..."
                  value={addDesc}
                  onChange={e => setAddDesc(e.target.value)}
                />
              </div>
              <div className={styles.formActions}>
                <Button variant="outline" size="sm" type="button" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={adding}>
                  {adding ? 'Adding...' : 'Add Activity'}
                </Button>
              </div>
            </form>
          )}

          {/* Template Bulk Generator Widget */}
          <div className={styles.actionCard}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 12 }}>
              ⚙ Generate Activities from Templates
            </div>
            <form onSubmit={handleGenerate} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <div className={styles.formField} style={{ flex: '1 1 200px' }}>
                <label>Room/Area *</label>
                <select
                  className={styles.formInput}
                  value={genRoom}
                  onChange={e => {
                    setGenRoom(e.target.value);
                    if (e.target.value !== 'custom' && genCustomRoom) setGenCustomRoom('');
                  }}
                  required
                >
                  <option value="">Choose Room</option>
                  {roomsList.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="custom">＋ Custom Room</option>
                </select>
              </div>
              {genRoom === 'custom' && (
                <div className={styles.formField} style={{ flex: '1 1 180px' }}>
                  <label>Room Name *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Master Bedroom"
                    value={genCustomRoom}
                    onChange={e => setGenCustomRoom(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className={styles.formField} style={{ flex: '1 1 180px' }}>
                <label>Trade *</label>
                <select
                  className={styles.formInput}
                  value={genTrade}
                  onChange={e => setGenTrade(e.target.value)}
                >
                  {TRADES.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formField} style={{ flex: '1 1 180px' }}>
                <label>Project Phase Link *</label>
                <select
                  className={styles.formInput}
                  value={genPhase}
                  onChange={e => setGenPhase(e.target.value)}
                  required
                >
                  <option value="">Select Phase</option>
                  {phases.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="primary" size="sm" type="submit" disabled={generating} style={{ height: 38 }}>
                {generating ? 'Generating...' : 'Generate Trade Checklist'}
              </Button>
            </form>
          </div>

          {/* Activities Checklist */}
          <div className={styles.checklist}>
            {filteredActivities.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>📋</div>
                <div>No work activities match the selected filters.</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Use the generator above to add templates or toggle filters on the left panel.
                </div>
              </div>
            ) : (
              filteredActivities.map(act => {
                const assignedUser = users.find(u => u.id === act.assignee_id);
                const linkedPhase = phases.find(p => p.id === act.phase_id);

                return (
                  <div key={act.id} className={styles.activityRow}>
                    <input
                      type="checkbox"
                      className={styles.activityCheckbox}
                      checked={act.status === 'completed'}
                      onChange={() => handleToggleComplete(act)}
                    />
                    
                    <div className={styles.activityMain}>
                      <div className={styles.activityHeader}>
                        <span className={`${styles.activityTitle} ${act.status === 'completed' ? styles.completedText : ''}`}>
                          {act.activity_name}
                        </span>
                        
                        <div className={styles.tagGroup}>
                          <span className={styles.roomTag}>📍 {act.room_name}</span>
                          <span className={`${styles.tradeTag} ${styles[`trade_${act.trade}`]}`}>
                            {act.trade.replace('_', ' ')}
                          </span>
                          {linkedPhase && (
                            <Badge variant="neutral" size="sm">
                              Phase: {linkedPhase.name}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {act.description && (
                        <div className={styles.activityDesc}>
                          {act.description}
                        </div>
                      )}

                      <div className={styles.activityFooter}>
                        {/* Assignee select */}
                        <div className={styles.footerItem}>
                          👤
                          <select
                            className={styles.statusSelect}
                            value={act.assignee_id || ''}
                            onChange={e => handleUpdateActivity(act.id, 'assignee_id', e.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Due date picker */}
                        <div className={styles.footerItem}>
                          📅
                          <input
                            type="date"
                            className={styles.statusSelect}
                            style={{ padding: '0 4px' }}
                            value={act.due_date ? act.due_date.substring(0, 10) : ''}
                            onChange={e => handleUpdateActivity(act.id, 'due_date', e.target.value)}
                          />
                        </div>

                        {/* Status Select */}
                        <div className={styles.footerItem}>
                          Status:
                          <select
                            className={styles.statusSelect}
                            value={act.status}
                            onChange={e => handleUpdateActivity(act.id, 'status', e.target.value)}
                          >
                            <option value="todo">Todo</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                      </div>

                      {/* QC Pre-Installation Checklist */}
                      {act.qc_checklist && act.qc_checklist.length > 0 && (
                        <div className={styles.qcChecklistContainer}>
                          <div className={styles.qcChecklistTitle}>QC Pre-Installation Checklist:</div>
                          {act.qc_checklist.map((item, idx) => (
                            <label key={item.id || idx} className={styles.qcChecklistItem}>
                              <input
                                type="checkbox"
                                checked={!!item.is_checked}
                                disabled={act.status === 'completed'}
                                onChange={(e) => handleToggleQcItem(act, idx, e.target.checked)}
                              />
                              <span className={item.is_checked ? styles.completedText : ''} style={{ fontSize: 'var(--text-sm)', display: 'inline-flex', alignItems: 'center' }}>
                                {item.label}
                                {item.required && (
                                  <span className={styles.requiredTag}>* required</span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Dependencies section */}
                      <div className={styles.dependenciesSection}>
                        <div className={styles.subSectionTitle}>Prerequisite Dependencies:</div>
                        {act.dependencies && act.dependencies.length > 0 ? (
                          <div className={styles.dependencyList}>
                            {act.dependencies.map(dep => {
                              const isCompleted = dep.depends_on_activity_status === 'completed';
                              return (
                                <div key={dep.id} className={styles.dependencyItem}>
                                  <span className={styles.depText}>
                                    [{dep.depends_on_activity_room}] {dep.depends_on_activity_name} ({dep.depends_on_activity_trade.replace('_', ' ')})
                                  </span>
                                  <Badge variant={isCompleted ? 'success' : 'warning'} size="sm">
                                    {isCompleted ? 'Completed' : 'Pending'}
                                  </Badge>
                                  <button
                                    type="button"
                                    className={styles.depRemoveBtn}
                                    onClick={() => handleRemoveDependency(dep.id)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className={styles.noDepsText}>No prerequisite dependencies.</div>
                        )}
                        <div className={styles.dependencyAddRow}>
                          <select
                            className={styles.statusSelect}
                            style={{ height: 26, fontSize: 10 }}
                            defaultValue=""
                            onChange={e => {
                              if (e.target.value) {
                                handleAddDependency(act.id, e.target.value);
                                e.target.value = "";
                              }
                            }}
                          >
                            <option value="">＋ Add Prerequisite Activity...</option>
                            {activities
                              .filter(a => a.id !== act.id && (!act.dependencies || !act.dependencies.some(d => d.depends_on_activity_id === a.id)))
                              .map(a => (
                                <option key={a.id} value={a.id}>
                                  [{a.room_name}] {a.activity_name} ({a.trade.replace('_', ' ')})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {/* Completion Evidence Section */}
                      <div className={styles.photosSection}>
                        <div className={styles.subSectionTitle}>Completion Evidence (Photos):</div>
                        {act.photos && act.photos.length > 0 && (
                          <div className={styles.photoGrid}>
                            {act.photos.map(p => (
                              <div key={p.id} className={styles.photoThumb}>
                                <img
                                  src={p.url}
                                  alt={p.caption || 'evidence'}
                                  className={styles.photoImage}
                                  onClick={() => window.open(p.url, '_blank')}
                                  title="View Full Size"
                                />
                                <button
                                  type="button"
                                  className={styles.photoRemoveBtn}
                                  onClick={() => handleDeletePhoto(act.id, p.id)}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <label className={styles.uploadBtn}>
                            📷 Upload Photo
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  await handleUploadPhoto(act.id, file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Supervisor Notes input */}
                      <div style={{ marginTop: 12 }}>
                        <input
                          type="text"
                          className={styles.notesInput}
                          placeholder="✍ Add site supervisor notes/updates..."
                          value={act.notes || ''}
                          onChange={e => {
                            // Local update state
                            setActivities(prev => prev.map(a => (a.id === act.id ? { ...a, notes: e.target.value } : a)));
                          }}
                          onBlur={e => handleUpdateActivity(act.id, 'notes', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className={styles.rowControls}>
                      <button className={styles.deleteBtn} onClick={() => handleDeleteActivity(act.id)}>
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
