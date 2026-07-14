import { useState, useEffect } from 'react'
import { Select, Button } from '../ui'
import { useToast } from '../../store/toastContext'
import styles from './TaskReminders.module.css'

export default function TaskReminders({ task, onUpdate }) {
  const [reminders, setReminders] = useState([])
  const [channels, setChannels] = useState({ inApp: true, email: false, push: false })
  const toast = useToast()

  useEffect(() => {
    // Initialize from task data if it existed, otherwise empty
    setReminders(task.reminders || [])
    if (task.reminderChannels) {
      setChannels(task.reminderChannels)
    }
  }, [task.reminders, task.reminderChannels])

  const handleAddReminder = (e) => {
    const val = e.target.value
    if (!val || val === 'custom') {
      if (val === 'custom') {
        const mins = prompt('Enter reminder time in minutes before due date:')
        if (mins && !isNaN(mins)) {
          const newR = [...reminders, parseInt(mins)]
          setReminders(newR)
          onUpdate({ reminders: newR })
        }
      }
      return
    }
    const mins = parseInt(val)
    if (!reminders.includes(mins)) {
      const newR = [...reminders, mins]
      setReminders(newR)
      onUpdate({ reminders: newR })
    }
  }

  const removeReminder = (mins) => {
    const newR = reminders.filter(r => r !== mins)
    setReminders(newR)
    onUpdate({ reminders: newR })
  }

  const toggleChannel = (c) => {
    const next = { ...channels, [c]: !channels[c] }
    setChannels(next)
    onUpdate({ reminderChannels: next })
    toast.success(`${c} notifications ${next[c] ? 'enabled' : 'disabled'}`)
  }

  const formatMins = (m) => {
    if (m < 60) return `${m} min before`
    if (m === 60) return `1 hour before`
    if (m === 1440) return `1 day before`
    if (m > 1440) return `${Math.floor(m/1440)} days before`
    return `${Math.floor(m/60)} hours before`
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ fontWeight: 600 }}>🔔 Reminders & Notifications</div>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <div className={styles.label}>Notify me via:</div>
        <div className={styles.channelGroup}>
          <label className={styles.channelCheckbox}>
            <input type="checkbox" checked={channels.inApp} onChange={() => toggleChannel('inApp')} />
            In-App
          </label>
          <label className={styles.channelCheckbox}>
            <input type="checkbox" checked={channels.email} onChange={() => toggleChannel('email')} />
            Email (Mock)
          </label>
          <label className={styles.channelCheckbox}>
            <input type="checkbox" checked={channels.push} onChange={() => toggleChannel('push')} />
            Push (Mock)
          </label>
        </div>
      </div>

      <div>
        <div className={styles.label}>Remind me:</div>
        <div className={styles.reminderTags}>
          {reminders.map(r => (
            <div key={r} className={styles.tag}>
              {formatMins(r)}
              <span className={styles.tagRemove} onClick={() => removeReminder(r)}>×</span>
            </div>
          ))}
        </div>
        <select className={styles.select} onChange={handleAddReminder} value="">
          <option value="">+ Add Reminder</option>
          <option value="15">15 minutes before</option>
          <option value="30">30 minutes before</option>
          <option value="60">1 hour before</option>
          <option value="1440">1 day before</option>
          <option value="custom">Custom...</option>
        </select>
      </div>
    </div>
  )
}
