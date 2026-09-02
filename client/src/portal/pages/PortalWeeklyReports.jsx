/* eslint-disable no-unused-vars, react-hooks/immutability */
import React, { useState, useEffect } from 'react'
import api from '../../api/axios'
import styles from './PortalWeeklyReports.module.css'

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
      setReports(res.data?.data || res.data || [])
    } catch (err) {
      setError('Failed to load weekly reports.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading reports...</div>
  }
  
  if (error) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-danger)' }}>{error}</div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Weekly Progress Reports</h1>
        <div className={styles.pageSub}>Detailed weekly construction updates, milestone achievements, and site logs.</div>
      </div>

      {reports.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: 'var(--color-text)' }}>No weekly reports published yet</div>
          <div style={{ fontSize: 'var(--text-xs)', marginTop: '4px' }}>Your site supervisor will publish weekly logs as construction progresses.</div>
        </div>
      ) : (
        <div className={styles.reportList}>
          {reports.map(report => (
            <div key={report.id} className={styles.reportCard}>
              <div className={styles.reportHeader}>
                <h2 className={styles.reportDateTitle}>
                  Report for week ending: {new Date(report.report_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </h2>
              </div>
              
              <div className={styles.reportBody}>
                
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Tasks Completed</h3>
                  {(!report.tasks_completed_json || report.tasks_completed_json.length === 0) ? (
                    <p className={styles.emptyText}>No tasks completed this week.</p>
                  ) : (
                    <ul className={styles.list}>
                      {report.tasks_completed_json.map((task, i) => (
                        <li key={i}>{task.title || task}</li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Milestones Reached</h3>
                  {(!report.milestones_reached_json || report.milestones_reached_json.length === 0) ? (
                    <p className={styles.emptyText}>No milestones reached this week.</p>
                  ) : (
                    <ul className={styles.list}>
                      {report.milestones_reached_json.map((m, i) => (
                        <li key={i}>{m.name || m}</li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Site Photos (from DSRs)</h3>
                  {(!report.photos_json || report.photos_json.length === 0) ? (
                    <p className={styles.emptyText}>No photos reported this week.</p>
                  ) : (
                    <div className={styles.photoGrid}>
                      {report.photos_json.map((photo, i) => (
                        <div key={i} className={styles.photoItem}>
                          <img src={photo.url} alt={photo.caption || 'Site photo'} className={styles.photoImg} />
                          {photo.caption && <p className={styles.photoCaption}>{photo.caption}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Next Week's Plan</h3>
                  {(!report.next_week_plan_json || report.next_week_plan_json.length === 0) ? (
                    <p className={styles.emptyText}>No plan reported for next week.</p>
                  ) : (
                    <ul className={styles.list}>
                      {report.next_week_plan_json.map((item, i) => (
                        <li key={i}>{item.title || item}</li>
                      ))}
                    </ul>
                  )}
                </section>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
