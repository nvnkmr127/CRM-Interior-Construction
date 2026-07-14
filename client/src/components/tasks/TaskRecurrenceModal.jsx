import { useState, useEffect } from 'react'
import { Modal, Button, Select } from '../ui'
import styles from './TaskRecurrenceModal.module.css'

export default function TaskRecurrenceModal({ isOpen, onClose, initialRule, onSave }) {
  const [frequency, setFrequency] = useState('weekly')
  const [interval, setIntervalCount] = useState(1)
  const [endType, setEndType] = useState('never') // never, date, occurrences
  const [endDate, setEndDate] = useState('')
  const [occurrences, setOccurrences] = useState(5)
  const [skipWeekends, setSkipWeekends] = useState(true)
  const [skipHolidays, setSkipHolidays] = useState(false)

  useEffect(() => {
    if (initialRule) {
      setFrequency(initialRule.frequency || 'weekly')
      setIntervalCount(initialRule.interval || 1)
      setEndType(initialRule.endType || 'never')
      setEndDate(initialRule.endDate || '')
      setOccurrences(initialRule.occurrences || 5)
      setSkipWeekends(initialRule.skipWeekends ?? true)
      setSkipHolidays(initialRule.skipHolidays ?? false)
    }
  }, [initialRule, isOpen])

  const handleSave = () => {
    onSave({
      frequency,
      interval,
      endType,
      endDate: endType === 'date' ? endDate : null,
      occurrences: endType === 'occurrences' ? occurrences : null,
      skipWeekends,
      skipHolidays
    })
    onClose()
  }

  const handleClear = () => {
    onSave(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Recurring Task Options">
      <div className={styles.container}>
        <div className={styles.row}>
          <label className={styles.label}>Repeat Every</label>
          <div className={styles.intervalGroup}>
            <input 
              type="number" 
              className={styles.numberInput} 
              value={interval} 
              onChange={e => setIntervalCount(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
            />
            <Select 
              value={frequency}
              onChange={setFrequency}
              options={[
                { label: 'Days', value: 'daily' },
                { label: 'Weeks', value: 'weekly' },
                { label: 'Months', value: 'monthly' },
                { label: 'Years', value: 'yearly' }
              ]}
            />
          </div>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Ends</label>
          <div className={styles.endGroup}>
            <div className={styles.radioRow}>
              <input 
                type="radio" 
                checked={endType === 'never'} 
                onChange={() => setEndType('never')} 
                id="end-never"
              />
              <label htmlFor="end-never">Never</label>
            </div>
            <div className={styles.radioRow}>
              <input 
                type="radio" 
                checked={endType === 'occurrences'} 
                onChange={() => setEndType('occurrences')} 
                id="end-occ"
              />
              <label htmlFor="end-occ">After</label>
              <input 
                type="number" 
                className={styles.numberInput} 
                value={occurrences}
                onChange={e => setOccurrences(Math.max(1, parseInt(e.target.value) || 1))}
                disabled={endType !== 'occurrences'}
                min={1}
                style={{ width: 60 }}
              />
              <label htmlFor="end-occ">occurrences</label>
            </div>
            <div className={styles.radioRow}>
              <input 
                type="radio" 
                checked={endType === 'date'} 
                onChange={() => setEndType('date')} 
                id="end-date"
              />
              <label htmlFor="end-date">On Date</label>
              <input 
                type="date" 
                className={styles.dateInput}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                disabled={endType !== 'date'}
              />
            </div>
          </div>
        </div>

        <div className={styles.row}>
          <label className={styles.label}>Skip Rules</label>
          <div className={styles.skipGroup}>
            <div className={styles.checkboxRow}>
              <input 
                type="checkbox" 
                id="skip-weekends"
                checked={skipWeekends}
                onChange={e => setSkipWeekends(e.target.checked)}
              />
              <label htmlFor="skip-weekends">Skip Weekends</label>
            </div>
            <div className={styles.checkboxRow}>
              <input 
                type="checkbox" 
                id="skip-holidays"
                checked={skipHolidays}
                onChange={e => setSkipHolidays(e.target.checked)}
              />
              <label htmlFor="skip-holidays">Skip Holidays (Mock)</label>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <Button variant="outline" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={handleClear}>
          Remove Recurrence
        </Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save Rule</Button>
        </div>
      </div>
    </Modal>
  )
}
