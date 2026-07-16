/* eslint-disable no-unused-vars */
import { useState, useMemo } from 'react'
import { 
  format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, 
  isSameMonth, isSameDay, parseISO, differenceInDays, addHours, startOfDay
} from 'date-fns'
import { Button, Badge, Select } from '../ui'
import styles from './TaskCalendarBoard.module.css'

const PRIORITY_COLORS = { low: 'info', medium: 'warning', high: 'danger', urgent: 'danger' }

export default function TaskCalendarBoard({ tasks, onTaskClick, onTaskUpdate }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState('month') // 'month', 'week', 'day', 'agenda'
  const [draggedTaskId, setDraggedTaskId] = useState(null)

  // Handlers for Navigation
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
  const today = () => setCurrentDate(new Date())

  // Process Tasks
  const processedTasks = useMemo(() => {
    return tasks.filter(t => t.due_date || t.dueDate || t.start_date).map(t => {
      const due = parseISO(t.due_date || t.dueDate || t.start_date)
      const start = t.start_date ? parseISO(t.start_date) : due
      return { ...t, parsedStart: start, parsedEnd: due }
    })
  }, [tasks])

  // Drag and Drop
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
    
    // Ghost image
    const el = e.target.cloneNode(true)
    el.style.position = 'absolute'
    el.style.top = '-1000px'
    el.style.opacity = '0.5'
    document.body.appendChild(el)
    e.dataTransfer.setDragImage(el, 20, 20)
    setTimeout(() => document.body.removeChild(el), 10)
  }

  const handleDrop = (e, dropDate) => {
    e.preventDefault()
    if (draggedTaskId) {
      const task = processedTasks.find(t => t.id === draggedTaskId)
      if (task) {
        // Calculate offset in days to maintain duration
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

  // Views
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)
    const days = eachDayOfInterval({ start: startDate, end: endDate })

    return (
      <div className={styles.monthGrid}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className={styles.dayHeader}>{d}</div>
        ))}
        {days.map(day => {
          const isCurrentMonth = isSameMonth(day, monthStart)
          const isToday = isSameDay(day, new Date())
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          
          // Find tasks that fall on this day
          const dayTasks = processedTasks.filter(t => 
            day >= startOfDay(t.parsedStart) && day <= startOfDay(t.parsedEnd)
          )

          return (
            <div 
              key={day.toISOString()} 
              className={`${styles.dayCell} ${!isCurrentMonth ? styles.outOfMonth : ''} ${isWeekend ? styles.weekend : ''}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, day)}
            >
              <div className={`${styles.dateNumber} ${isToday ? styles.today : ''}`}>
                {format(day, 'd')}
              </div>
              <div className={styles.taskList}>
                {dayTasks.map(t => {
                  const isStart = isSameDay(day, t.parsedStart)
                  const isEnd = isSameDay(day, t.parsedEnd)
                  return (
                    <div 
                      key={t.id} 
                      className={`${styles.taskBlock} ${styles[PRIORITY_COLORS[t.priority] || 'neutral']} ${!isStart ? styles.contLeft : ''} ${!isEnd ? styles.contRight : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t.id)}
                      onClick={() => onTaskClick(t.id)}
                      title={t.title}
                    >
                      {isStart && <span className={styles.taskTitle}>{t.title}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderAgendaView = () => {
    const upcomingTasks = [...processedTasks]
      .filter(t => t.parsedEnd >= startOfDay(new Date()))
      .sort((a, b) => a.parsedEnd - b.parsedEnd)

    return (
      <div className={styles.agendaView}>
        {upcomingTasks.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>No upcoming tasks.</div>
        ) : (
          upcomingTasks.map(t => (
            <div key={t.id} className={styles.agendaRow} onClick={() => onTaskClick(t.id)}>
              <div className={styles.agendaDate}>
                <div className={styles.agendaDay}>{format(t.parsedEnd, 'dd')}</div>
                <div className={styles.agendaMonth}>{format(t.parsedEnd, 'MMM')}</div>
              </div>
              <div className={styles.agendaContent}>
                <div className={styles.agendaTitle}>{t.title}</div>
                <div className={styles.agendaMeta}>
                  <Badge variant={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge>
                  <span style={{ marginLeft: 8 }}>{t.project_name || 'General'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <div className={styles.calendarBoard}>
      <div className={styles.header}>
        <div className={styles.navGroup}>
          <Button variant="outline" onClick={today}>Today</Button>
          <div className={styles.arrows}>
            <button onClick={prev}>&lt;</button>
            <button onClick={next}>&gt;</button>
          </div>
          <h2 className={styles.title}>
            {view === 'month' && format(currentDate, 'MMMM yyyy')}
            {view === 'week' && `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`}
            {view === 'day' && format(currentDate, 'EEEE, MMM d, yyyy')}
            {view === 'agenda' && 'Upcoming Tasks'}
          </h2>
        </div>
        <div className={styles.viewSelect}>
          <Select 
            value={view}
            onChange={setView}
            options={[
              { label: 'Month', value: 'month' },
              { label: 'Week', value: 'week' },
              { label: 'Day', value: 'day' },
              { label: 'Agenda', value: 'agenda' }
            ]}
          />
        </div>
      </div>
      
      <div className={styles.content}>
        {view === 'month' && renderMonthView()}
        {view === 'week' && <div className={styles.placeholder}>Week view requires absolute positioned layout grids. <br/>(Simulated for scope brevity: Please use Month or Agenda view)</div>}
        {view === 'day' && <div className={styles.placeholder}>Day view requires absolute positioned layout grids. <br/>(Simulated for scope brevity: Please use Month or Agenda view)</div>}
        {view === 'agenda' && renderAgendaView()}
      </div>
    </div>
  )
}
