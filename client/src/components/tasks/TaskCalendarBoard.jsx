/* eslint-disable no-unused-vars */
import { useState, useMemo } from 'react'
import { 
  format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, 
  isSameMonth, parseISO, differenceInDays, startOfDay,
  isToday as isDateToday, isBefore
} from 'date-fns'
import { Button, Badge } from '../ui'
import styles from './TaskCalendarBoard.module.css'

const PRIORITY_VARIANTS = { low: 'info', medium: 'warning', high: 'danger', urgent: 'danger' }
const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  completed: 'Completed',
  blocked: 'Blocked',
  archived: 'Archived'
}

const getInitials = (name) => {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export default function TaskCalendarBoard({ tasks = [], onTaskClick, onTaskUpdate }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState('month') // 'month', 'week', 'day', 'agenda'
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [expandedDayKey, setExpandedDayKey] = useState(null)

  // Navigation Handlers
  const next = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1))
    else setCurrentDate(addDays(currentDate, 1))
  }
  const prev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1))
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1))
    else setCurrentDate(subDays(currentDate, 1))
  }
  const jumpToday = () => setCurrentDate(new Date())

  // Process Tasks into structured dates
  const processedTasks = useMemo(() => {
    return (tasks || []).filter(t => t.due_date || t.dueDate || t.start_date || t.startDate).map(t => {
      const rawDue = t.due_date || t.dueDate || t.start_date || t.startDate
      const due = parseISO(rawDue)
      const start = t.start_date || t.startDate ? parseISO(t.start_date || t.startDate) : due
      return { 
        ...t, 
        parsedStart: start, 
        parsedEnd: due,
        assigneeName: t.assignee_name || t.assigneeName || t.assignee?.name || 'Unassigned',
        projectName: t.project_name || t.projectName || t.project?.name || 'General'
      }
    })
  }, [tasks])

  // Drag and Drop handlers
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e, dropDate) => {
    e.preventDefault()
    if (draggedTaskId && onTaskUpdate) {
      const task = processedTasks.find(t => t.id === draggedTaskId)
      if (task) {
        const diffDays = differenceInDays(dropDate, task.parsedStart)
        const newStart = addDays(task.parsedStart, diffDays)
        const newEnd = addDays(task.parsedEnd, diffDays)
        onTaskUpdate(task.id, { 
          start_date: newStart.toISOString(),
          due_date: newEnd.toISOString() 
        })
      }
    }
    setDraggedTaskId(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  // --- MONTH VIEW ---
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: startDate, end: endDate })

    return (
      <div className={styles.monthGrid}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className={styles.dayHeader}>{d}</div>
        ))}
        {days.map(day => {
          const isCurrentMonth = isSameMonth(day, monthStart)
          const isToday = isDateToday(day)
          
          const dayTasks = processedTasks.filter(t => 
            startOfDay(day).getTime() >= startOfDay(t.parsedStart).getTime() && 
            startOfDay(day).getTime() <= startOfDay(t.parsedEnd).getTime()
          )

          const dayKey = day.toISOString()
          const isExpanded = expandedDayKey === dayKey
          const maxVisible = isExpanded ? dayTasks.length : 3
          const visibleTasks = dayTasks.slice(0, maxVisible)
          const remainingCount = dayTasks.length - 3

          return (
            <div 
              key={dayKey} 
              className={`${styles.dayCell} ${!isCurrentMonth ? styles.outOfMonth : ''}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, day)}
            >
              <div className={styles.dateRow}>
                <span className={`${styles.dateNumber} ${isToday ? styles.today : ''}`}>
                  {format(day, 'd')}
                </span>
              </div>

              <div className={styles.taskList}>
                {visibleTasks.map(t => {
                  const priorityClass = t.priority ? styles[`prio_${t.priority}`] : ''
                  const isCompleted = t.status === 'completed'
                  return (
                    <div 
                      key={t.id} 
                      className={`${styles.taskBlock} ${priorityClass} ${isCompleted ? styles.taskCompleted : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t.id)}
                      onClick={() => onTaskClick && onTaskClick(t)}
                      title={`${t.title} (${STATUS_LABELS[t.status] || t.status})`}
                    >
                      <div className={styles.taskBlockHeader}>
                        <span className={styles.taskTitle}>{t.title}</span>
                      </div>
                      <div className={styles.taskMetaRow}>
                        <span className={styles.projectTag}>{t.projectName}</span>
                        <div className={styles.miniAvatar} title={t.assigneeName}>
                          {getInitials(t.assigneeName)}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {remainingCount > 0 && !isExpanded && (
                  <button 
                    className={styles.moreBtn}
                    onClick={() => setExpandedDayKey(dayKey)}
                  >
                    +{remainingCount} more
                  </button>
                )}
                {isExpanded && remainingCount > 0 && (
                  <button 
                    className={styles.moreBtn}
                    onClick={() => setExpandedDayKey(null)}
                  >
                    Show less
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // --- WEEK VIEW ---
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

    return (
      <div className={styles.weekGrid}>
        {days.map(day => {
          const isToday = isDateToday(day)
          const dayTasks = processedTasks.filter(t => 
            startOfDay(day).getTime() >= startOfDay(t.parsedStart).getTime() && 
            startOfDay(day).getTime() <= startOfDay(t.parsedEnd).getTime()
          )

          return (
            <div 
              key={day.toISOString()} 
              className={styles.weekColumn}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, day)}
            >
              <div className={`${styles.weekColumnHeader} ${isToday ? styles.todayHeader : ''}`}>
                <div className={styles.weekDayName}>{format(day, 'EEE')}</div>
                <div className={styles.weekDayNum}>{format(day, 'MMM d')}</div>
              </div>

              <div className={styles.weekTaskList}>
                {dayTasks.length === 0 ? (
                  <div className={styles.emptyDaySlot}>No tasks</div>
                ) : (
                  dayTasks.map(t => {
                    const priorityClass = t.priority ? styles[`prio_${t.priority}`] : ''
                    const isCompleted = t.status === 'completed'
                    return (
                      <div 
                        key={t.id} 
                        className={`${styles.weekTaskCard} ${priorityClass} ${isCompleted ? styles.taskCompleted : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, t.id)}
                        onClick={() => onTaskClick && onTaskClick(t)}
                      >
                        <div className={styles.weekTaskTop}>
                          <span className={styles.taskTitle}>{t.title}</span>
                          <Badge variant={PRIORITY_VARIANTS[t.priority] || 'neutral'} size="sm">
                            {t.priority || 'medium'}
                          </Badge>
                        </div>
                        <div className={styles.weekTaskMeta}>
                          <span className={styles.projectTag}>{t.projectName}</span>
                          <span className={styles.statusPill}>{STATUS_LABELS[t.status] || t.status}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // --- DAY VIEW ---
  const renderDayView = () => {
    const dayTasks = processedTasks.filter(t => 
      startOfDay(currentDate).getTime() >= startOfDay(t.parsedStart).getTime() && 
      startOfDay(currentDate).getTime() <= startOfDay(t.parsedEnd).getTime()
    )

    const hours = Array.from({ length: 12 }, (_, i) => i + 8) // 8 AM to 7 PM

    return (
      <div className={styles.dayViewContainer}>
        <div className={styles.dayHeaderBanner}>
          <div className={styles.dayBannerTitle}>{format(currentDate, 'EEEE, MMMM d, yyyy')}</div>
          <div className={styles.dayBannerStats}>
            <span>{dayTasks.length} Task(s) Scheduled</span>
          </div>
        </div>

        <div className={styles.dayScheduleLayout}>
          {/* Summary / All Day Cards */}
          <div className={styles.daySummaryColumn}>
            <h4 className={styles.sectionHeading}>Scheduled Tasks ({dayTasks.length})</h4>
            {dayTasks.length === 0 ? (
              <div className={styles.emptySchedule}>No tasks scheduled for this date.</div>
            ) : (
              dayTasks.map(t => (
                <div 
                  key={t.id} 
                  className={styles.dayTaskCard} 
                  onClick={() => onTaskClick && onTaskClick(t)}
                >
                  <div className={styles.dayCardHeader}>
                    <span className={styles.dayCardTitle}>{t.title}</span>
                    <Badge variant={PRIORITY_VARIANTS[t.priority] || 'neutral'}>{t.priority}</Badge>
                  </div>
                  {t.description && (
                    <div className={styles.dayCardDesc}>{t.description}</div>
                  )}
                  <div className={styles.dayCardFooter}>
                    <span className={styles.projectTag}>◈ {t.projectName}</span>
                    <span className={styles.assigneeText}>👤 {t.assigneeName}</span>
                    <span className={styles.statusPill}>{STATUS_LABELS[t.status] || t.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Time Slots */}
          <div className={styles.timeSlotsColumn}>
            <h4 className={styles.sectionHeading}>Timeline Slots</h4>
            {hours.map(h => (
              <div key={h} className={styles.timeRow}>
                <div className={styles.timeLabel}>
                  {h === 12 ? '12:00 PM' : h > 12 ? `${h - 12}:00 PM` : `${h}:00 AM`}
                </div>
                <div className={styles.timeSlotLine} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // --- AGENDA VIEW ---
  const renderAgendaView = () => {
    const sortedTasks = [...processedTasks].sort((a, b) => a.parsedEnd - b.parsedEnd)

    return (
      <div className={styles.agendaView}>
        {sortedTasks.length === 0 ? (
          <div className={styles.emptySchedule}>No tasks scheduled on calendar.</div>
        ) : (
          sortedTasks.map(t => {
            const isOverdue = isBefore(startOfDay(t.parsedEnd), startOfDay(new Date())) && t.status !== 'completed'
            return (
              <div 
                key={t.id} 
                className={`${styles.agendaRow} ${isOverdue ? styles.agendaOverdue : ''}`} 
                onClick={() => onTaskClick && onTaskClick(t)}
              >
                <div className={styles.agendaDate}>
                  <div className={styles.agendaDay}>{format(t.parsedEnd, 'dd')}</div>
                  <div className={styles.agendaMonth}>{format(t.parsedEnd, 'MMM')}</div>
                </div>
                <div className={styles.agendaContent}>
                  <div className={styles.agendaTop}>
                    <span className={styles.agendaTitle}>{t.title}</span>
                    {isOverdue && <span className={styles.overdueTag}>Overdue</span>}
                  </div>
                  <div className={styles.agendaMeta}>
                    <Badge variant={PRIORITY_VARIANTS[t.priority] || 'neutral'}>{t.priority}</Badge>
                    <span className={styles.projectTag}>◈ {t.projectName}</span>
                    <span className={styles.assigneeText}>👤 {t.assigneeName}</span>
                    <span className={styles.statusPill}>{STATUS_LABELS[t.status] || t.status}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }

  return (
    <div className={styles.calendarBoard}>
      {/* Navigation & Controls Header */}
      <div className={styles.header}>
        <div className={styles.navGroup}>
          <Button variant="secondary" size="sm" onClick={jumpToday}>Today</Button>
          <div className={styles.arrows}>
            <button className={styles.navArrowBtn} onClick={prev} title="Previous">‹</button>
            <button className={styles.navArrowBtn} onClick={next} title="Next">›</button>
          </div>
          <h2 className={styles.title}>
            {view === 'month' && format(currentDate, 'MMMM yyyy')}
            {view === 'week' && `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`}
            {view === 'day' && format(currentDate, 'EEEE, MMM d, yyyy')}
            {view === 'agenda' && 'All Scheduled Tasks (Agenda)'}
          </h2>
        </div>

        {/* View Switcher Tabs */}
        <div className={styles.viewSegment}>
          <button 
            className={`${styles.segmentBtn} ${view === 'month' ? styles.segmentActive : ''}`} 
            onClick={() => setView('month')}
          >
            Month
          </button>
          <button 
            className={`${styles.segmentBtn} ${view === 'week' ? styles.segmentActive : ''}`} 
            onClick={() => setView('week')}
          >
            Week
          </button>
          <button 
            className={`${styles.segmentBtn} ${view === 'day' ? styles.segmentActive : ''}`} 
            onClick={() => setView('day')}
          >
            Day
          </button>
          <button 
            className={`${styles.segmentBtn} ${view === 'agenda' ? styles.segmentActive : ''}`} 
            onClick={() => setView('agenda')}
          >
            Agenda
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className={styles.content}>
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
        {view === 'agenda' && renderAgendaView()}
      </div>
    </div>
  )
}
