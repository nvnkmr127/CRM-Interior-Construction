import React, { useState, useEffect } from 'react'
import { Card } from '../../components/ui'
import api from '../../api/axios'
import styles from './PortalProject.module.css' // We can reuse standard styling, or use inline/tailwind if available

export default function PortalWeeklyReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const res = await api.get('/portal/project/weekly-reports')
      setReports(res.data)
    } catch (err) {
      setError('Failed to load weekly reports.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className={styles.loading}>Loading reports...</div>
  if (error) return <div className={styles.error}>{error}</div>

  if (reports.length === 0) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Weekly Progress Reports</h1>
        <Card>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-secondary)' }}>No weekly reports have been generated yet.</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.container} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
      <h1 className={styles.title} style={{ fontSize: '1.5rem', fontWeight: 600 }}>Weekly Progress Reports</h1>
      
      {reports.map(report => (
        <Card key={report.id} style={{ marginBottom: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
          <div style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', padding: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Report for week ending: {new Date(report.report_date).toLocaleDateString()}</h2>
          </div>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <section>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem' }}>Tasks Completed</h3>
              {(!report.tasks_completed_json || report.tasks_completed_json.length === 0) ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>No tasks completed this week.</p>
              ) : (
                <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                  {report.tasks_completed_json.map((task, i) => (
                    <li key={i}>{task.title}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem' }}>Milestones Reached</h3>
              {(!report.milestones_reached_json || report.milestones_reached_json.length === 0) ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>No milestones reached this week.</p>
              ) : (
                <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                  {report.milestones_reached_json.map((m, i) => (
                    <li key={i}>{m.name}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem' }}>Site Photos (from DSRs)</h3>
              {(!report.photos_json || report.photos_json.length === 0) ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>No photos reported this week.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                  {report.photos_json.map((photo, i) => (
                    <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <img src={photo.url} alt={photo.caption || 'Site photo'} style={{ width: '100%', height: '100px', objectFit: 'cover' }} />
                      {photo.caption && <p style={{ fontSize: '0.8rem', padding: '0.25rem', margin: 0, backgroundColor: 'var(--color-bg-secondary)', textAlign: 'center' }}>{photo.caption}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem' }}>Next Week's Plan</h3>
              {(!report.next_week_plan_json || report.next_week_plan_json.length === 0) ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>No tasks scheduled for next week.</p>
              ) : (
                <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                  {report.next_week_plan_json.map((task, i) => (
                    <li key={i}>{task.title} (Due: {new Date(task.due_date).toLocaleDateString()})</li>
                  ))}
                </ul>
              )}
            </section>

          </div>
        </Card>
      ))}
    </div>
  )
}
