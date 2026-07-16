import { useState, useEffect, useCallback } from 'react'
import { getTaskActivity, getGlobalTaskActivity } from '../../api/tasks'
import { Avatar, Spinner, Select, Badge } from '../ui'
import styles from './TaskActivityHistory.module.css'
import { useToast } from '../../store/toastContext'

export default function TaskActivityHistory({ projectId, taskId, isGlobal = false }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const toast = useToast()

  const loadActivity = useCallback(async () => {
    try {
      let res;
      if (isGlobal) {
        res = await getGlobalTaskActivity(taskId)
      } else {
        res = await getTaskActivity(projectId, taskId)
      }
      setActivities(Array.isArray(res?.data?.data) ? res.data.data : (Array.isArray(res?.data) ? res.data : []))
    } catch (e) {
      console.error(e)
      toast.error('Failed to load activity history')
    } finally {
      setLoading(false)
    }
  }, [projectId, taskId, isGlobal, toast])

  useEffect(() => {
    loadActivity()
    
    // Poll for new activity every 5s while open
    const interval = setInterval(loadActivity, 5000)
    return () => clearInterval(interval)
  }, [loadActivity])

  const formatRelativeTime = (dateString) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    const daysDifference = Math.round((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24))
    const hoursDifference = Math.round((new Date(dateString) - new Date()) / (1000 * 60 * 60))
    const minutesDifference = Math.round((new Date(dateString) - new Date()) / (1000 * 60))

    if (Math.abs(daysDifference) > 0) return rtf.format(daysDifference, 'day')
    if (Math.abs(hoursDifference) > 0) return rtf.format(hoursDifference, 'hour')
    return rtf.format(minutesDifference, 'minute')
  }

  const getActionIcon = (type) => {
    switch (type) {
      case 'created': return '✨'
      case 'status_changed': return '🔄'
      case 'priority_changed': return '🔥'
      case 'due_date_changed': return '📅'
      case 'assignee_changed': return '👤'
      case 'checklist_updated': return '☑️'
      case 'comment_added': return '💬'
      case 'attachment_added': return '📎'
      case 'edited': return '✏️'
      default: return '📝'
    }
  }

  const filteredActivities = activities.filter(a => {
    if (filter !== 'all') {
      if (filter === 'ai' && !a.is_ai) return false
      if (filter === 'comments' && a.action_type !== 'comment_added') return false
      if (filter === 'attachments' && a.action_type !== 'attachment_added') return false
      if (filter === 'status' && a.action_type !== 'status_changed') return false
    }
    if (search.trim()) {
      return (
        a.description.toLowerCase().includes(search.toLowerCase()) ||
        a.user_name.toLowerCase().includes(search.toLowerCase()) ||
        a.action_type.toLowerCase().includes(search.toLowerCase())
      )
    }
    return true
  })

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Activity History</div>
      </div>
      
      <div className={styles.controls}>
        <input 
          type="text" 
          placeholder="Search activity..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <div className={styles.filterWrapper}>
          <Select 
            value={filter}
            onChange={setFilter}
            options={[
              { label: 'All Activity', value: 'all' },
              { label: 'Comments', value: 'comments' },
              { label: 'Attachments', value: 'attachments' },
              { label: 'Status Changes', value: 'status' },
              { label: 'AI Actions', value: 'ai' }
            ]}
          />
        </div>
      </div>

      <div className={styles.timelineContainer}>
        {loading && activities.length === 0 ? (
          <div className={styles.loading}><Spinner size="sm" /></div>
        ) : filteredActivities.length === 0 ? (
          <div className={styles.empty}>No activity found matching filters.</div>
        ) : (
          <div className={styles.timeline}>
            {filteredActivities.map((act, i) => (
              <div key={act.id} className={styles.timelineItem}>
                <div className={styles.timelineTrack}>
                  <div className={styles.timelineIconWrapper}>
                    {act.is_ai ? (
                      <div className={styles.aiIcon}>🤖</div>
                    ) : (
                      <Avatar name={act.user_name} size="sm" />
                    )}
                  </div>
                  {i < filteredActivities.length - 1 && <div className={styles.timelineLine} />}
                </div>
                
                <div className={styles.timelineContent}>
                  <div className={styles.eventHeader}>
                    <span className={styles.userName}>{act.is_ai ? 'Antigravity AI' : act.user_name}</span>
                    <span className={styles.time} title={new Date(act.created_at).toLocaleString()}>
                      {formatRelativeTime(act.created_at)}
                    </span>
                  </div>
                  <div className={styles.eventBody}>
                    <span className={styles.actionBadge}>{getActionIcon(act.action_type)}</span>
                    <span className={styles.descText}>{act.description}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
