import React, { useState, useEffect } from 'react';
import styles from './RoomProgressTab.module.css';
import { getRoomProgress } from '../../api/projects';
import { Badge, Avatar } from '../ui';
import { useToast } from '../../store/toastContext';

const TRADE_METADATA = {
  civil: { label: 'Civil / Demolition', bg: '#fee2e2', text: '#ef4444', icon: '🧱' },
  electrical: { label: 'Electrical Work', bg: '#fef3c7', text: '#d97706', icon: '⚡' },
  plumbing: { label: 'Plumbing Work', bg: '#e0f2fe', text: '#0284c7', icon: '🚰' },
  false_ceiling: { label: 'False Ceiling', bg: '#f3e8ff', text: '#a855f7', icon: '📐' },
  flooring: { label: 'Flooring & Tiling', bg: '#dcfce7', text: '#22c55e', icon: '🏁' },
  painting: { label: 'Painting & Putty', bg: '#e0e7ff', text: '#4f46e5', icon: '🎨' },
  carpentry: { label: 'Carpentry & Modular', bg: '#ffedd5', text: '#ea580c', icon: '🔨' },
  glass: { label: 'Glass & Metal Work', bg: '#ecfeff', text: '#0891b2', icon: '🔮' },
  soft_furnishing: { label: 'Soft Furnishing', bg: '#fce7f3', text: '#db2777', icon: '🛋️' }
};

const TASK_STATUS_METADATA = {
  todo: { label: 'To Do', bg: '#f1f5f9', text: '#64748b' },
  in_progress: { label: 'In Progress', bg: '#eff6ff', text: '#3b82f6' },
  blocked: { label: 'Blocked', bg: '#fef2f2', text: '#ef4444' },
  done: { label: 'Completed', bg: '#f0fdf4', text: '#22c55e' }
};

const ACTIVITY_STATUS_METADATA = {
  todo: { label: 'To Do', bg: '#f1f5f9', text: '#64748b' },
  in_progress: { label: 'In Progress', bg: '#eff6ff', text: '#3b82f6' },
  completed: { label: 'Completed', bg: '#f0fdf4', text: '#22c55e' }
};

export default function RoomProgressTab({ projectId }) {
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRoomProgress();
  }, [projectId]);

  const fetchRoomProgress = async () => {
    setLoading(true);
    try {
      const res = await getRoomProgress(projectId);
      const data = res.data?.data || res.data || [];
      setRooms(data);
      if (data.length > 0) {
        // Retain selection if existed, else default first
        const match = data.find(r => r.roomName === selectedRoom?.roomName);
        setSelectedRoom(match || data[0]);
      }
    } catch (err) {
      toast.error('Failed to load room-wise progress.');
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (percent) => {
    if (percent >= 100) return 'var(--color-success, #22c55e)';
    if (percent >= 50) return 'var(--color-accent, #3b82f6)';
    if (percent > 0) return 'var(--color-warning, #eab308)';
    return 'var(--color-text-muted, #94a3b8)';
  };

  if (loading && rooms.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Calculating room-wise completion...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Left Column: Rooms Listing */}
      <div className={styles.leftCol}>
        <div className={styles.headerRow}>
          <h3 className={styles.title}>Rooms & Spaces</h3>
        </div>

        {rooms.length === 0 ? (
          <div className={styles.emptySelection} style={{ border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <div className={styles.emptyIcon}>🚪</div>
            <p style={{ margin: 0, fontSize: '13px' }}>No rooms or room-tagged tasks/activities found.</p>
          </div>
        ) : (
          <div className={styles.roomsList}>
            {rooms.map(room => {
              const totalItems = room.totalTasks + room.totalActivities;
              const completedItems = room.completedTasks + room.completedActivities;
              
              return (
                <div 
                  key={room.roomName} 
                  className={`${styles.roomCard} ${selectedRoom?.roomName === room.roomName ? styles.roomCardActive : ''}`}
                  onClick={() => setSelectedRoom(room)}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.roomName}>{room.roomName}</span>
                    {room.measurements?.area > 0 && (
                      <span className={styles.areaBadge}>
                        📐 {room.measurements.area} sq {room.measurements.unit}
                      </span>
                    )}
                  </div>

                  <div className={styles.progressContainer}>
                    <div className={styles.progressBarBg}>
                      <div 
                        className={styles.progressBarFill}
                        style={{ 
                          width: `${room.progressPercentage}%`,
                          backgroundColor: getProgressColor(room.progressPercentage)
                        }}
                      />
                    </div>
                    <div className={styles.progressTextRow}>
                      <span>Progress</span>
                      <strong>{room.progressPercentage}%</strong>
                    </div>
                  </div>

                  <div className={styles.cardStats}>
                    <span>📋 {completedItems}/{totalItems} items completed</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Selected Room Details */}
      <div className={styles.rightCol}>
        {selectedRoom ? (
          <>
            <div className={styles.detailHeader}>
              <h2 className={styles.detailTitle}>{selectedRoom.roomName}</h2>
              {selectedRoom.measurements ? (
                <div className={styles.detailMeta}>
                  Dimensions: <strong>{selectedRoom.measurements.length} × {selectedRoom.measurements.width} × {selectedRoom.measurements.height} {selectedRoom.measurements.unit}</strong> | Area: <strong>{selectedRoom.measurements.area} sq {selectedRoom.measurements.unit}</strong>
                  {selectedRoom.measurements.notes && <div>Notes: {selectedRoom.measurements.notes}</div>}
                </div>
              ) : (
                <div className={styles.detailMeta}>
                  No measurements recorded for this space.
                </div>
              )}
            </div>

            {/* Progress Stats Summary */}
            <div className={styles.statsSummaryGrid}>
              <div className={styles.statSummaryCard}>
                <span className={styles.summaryLabel}>Completion Rollup</span>
                <span 
                  className={styles.summaryVal}
                  style={{ color: getProgressColor(selectedRoom.progressPercentage) }}
                >
                  {selectedRoom.progressPercentage}%
                </span>
              </div>
              <div className={styles.statSummaryCard}>
                <span className={styles.summaryLabel}>Total Checklist items</span>
                <span className={styles.summaryVal}>
                  {selectedRoom.completedTasks + selectedRoom.completedActivities} / {selectedRoom.totalTasks + selectedRoom.totalActivities}
                </span>
              </div>
            </div>

            {/* Trade Activities section */}
            <div>
              <h4 className={styles.sectionTitle}>Trade Work Activities</h4>
              {selectedRoom.activities && selectedRoom.activities.length > 0 ? (
                <div className={styles.itemsList}>
                  {selectedRoom.activities.map(act => {
                    const meta = TRADE_METADATA[act.trade] || { label: act.trade, bg: '#f1f5f9', text: '#64748b', icon: '⚒️' };
                    const statusMeta = ACTIVITY_STATUS_METADATA[act.status] || { label: act.status, bg: '#f1f5f9', text: '#64748b' };
                    return (
                      <div key={act.id} className={styles.itemRow}>
                        <div className={styles.itemLeft}>
                          <span className={styles.itemIcon}>{meta.icon}</span>
                          <div>
                            <div className={styles.itemTitle}>{act.activityName}</div>
                            <span 
                              className={styles.tradeBadge}
                              style={{ backgroundColor: meta.bg, color: meta.text }}
                            >
                              {meta.label}
                            </span>
                          </div>
                        </div>
                        <div className={styles.itemRight}>
                          {act.dueDate && (
                            <span className={styles.itemDate}>
                              📅 {new Date(act.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          <span 
                            className={styles.statusChip}
                            style={{ backgroundColor: statusMeta.bg, color: statusMeta.text }}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>No room-tagged trade activities found in this space.</div>
              )}
            </div>

            {/* Tasks section */}
            <div>
              <h4 className={styles.sectionTitle}>Room-Specific Tasks</h4>
              {selectedRoom.tasks && selectedRoom.tasks.length > 0 ? (
                <div className={styles.itemsList}>
                  {selectedRoom.tasks.map(task => {
                    const statusMeta = TASK_STATUS_METADATA[task.status] || { label: task.status, bg: '#f1f5f9', text: '#64748b' };
                    return (
                      <div key={task.id} className={styles.itemRow}>
                        <div className={styles.itemLeft}>
                          <span className={styles.itemIcon}>📋</span>
                          <div>
                            <div className={styles.itemTitle}>{task.title}</div>
                            <div className={styles.itemSubtitle}>Assignee: {task.assigneeName}</div>
                          </div>
                        </div>
                        <div className={styles.itemRight}>
                          {task.dueDate && (
                            <span className={styles.itemDate}>
                              📅 {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          <span 
                            className={styles.statusChip}
                            style={{ backgroundColor: statusMeta.bg, color: statusMeta.text }}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>No room-tagged tasks found in this space. Add some from the tasks panel and tag them.</div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.emptySelection}>
            <div className={styles.emptyIcon}>🚪</div>
            <p>Select a room or space from the list to view its completion breakdown.</p>
          </div>
        )}
      </div>
    </div>
  );
}
