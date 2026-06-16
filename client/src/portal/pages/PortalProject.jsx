import { useState, useEffect } from 'react'
import styles from './PortalProject.module.css'
import { usePortalAuth } from '../store/portalAuthContext'

export default function PortalProject() {
  const { portalUser } = usePortalAuth()
  const [data, setData] = useState(null)
  
  // Use a media query to determine SVG radius
  const [radius, setRadius] = useState(80)

  useEffect(() => {
    const handleResize = () => setRadius(window.innerWidth < 640 ? 70 : 90)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    // Mock Fetch
    setTimeout(() => {
      setData({
        project: { name: 'Sharma Residence' },
        pm: { name: 'Priya Sharma', phone: '9876543210' },
        progress: {
          percent: 68,
          completedTasks: 34,
          totalTasks: 50,
          phases: [
            { name: 'Design', status: 'done' },
            { name: 'Approvals', status: 'done' },
            { name: 'Material', status: 'active' },
            { name: 'Execution', status: 'pending' },
            { name: 'Handover', status: 'pending' }
          ]
        },
        nextSteps: [
          { phase: 'Material', name: 'Approve Kitchen Laminates', date: 'Due Tomorrow' },
          { phase: 'Material', name: 'Select Bathroom Fixtures', date: 'Due in 3 days' },
          { phase: 'Execution', name: 'Start False Ceiling', date: 'Next Week' }
        ],
        payments: [
          { name: 'Advance Payment', amount: 500000, date: '2025-01-05', status: 'Paid' },
          { name: 'Design Sign-off', amount: 300000, date: '2025-02-10', status: 'Overdue' },
          { name: 'Material Delivery', amount: 400000, date: '2025-03-15', status: 'Upcoming' }
        ]
      })
    }, 600)
  }, [])

  if (!data) return <div style={{padding: 24, textAlign: 'center', color: 'var(--color-text-muted)'}}>Loading your project...</div>

  const CIRCUMFERENCE = 2 * Math.PI * radius
  const offset = CIRCUMFERENCE - (data.progress.percent / 100) * CIRCUMFERENCE

  // Calculate active phase index for fill line
  const activeIdx = data.progress.phases.findIndex(p => p.status === 'active')
  const fillWidth = activeIdx > 0 ? (activeIdx / (data.progress.phases.length - 1)) * 100 : 0

  const totalCollected = data.payments.filter(p => p.status === 'Paid').reduce((acc, p) => acc + p.amount, 0)
  const totalValue = data.payments.reduce((acc, p) => acc + p.amount, 0)

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.welcomeTitle}>Welcome, {portalUser?.name.split(' ')[0]}! 👋</h2>
        <p className={styles.welcomeText}>Your project is in progress. Here's the latest update.</p>
        
        <div className={styles.pmBox}>
          <div className={styles.pmInfo}>
            <div style={{color:'var(--color-text-secondary)', fontSize:12, marginBottom:4}}>Your Project Manager</div>
            <div style={{fontWeight:600}}>{data.pm.name}</div>
          </div>
          <a href={`tel:${data.pm.phone}`} className={styles.callBtn}>Call {data.pm.phone}</a>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.hero}>
          <div className={styles.svgWrapper}>
            <svg width={radius * 2 + 20} height={radius * 2 + 20}>
              <circle cx={radius + 10} cy={radius + 10} r={radius} fill="none" stroke="var(--color-surface-2)" strokeWidth="12" />
              <circle 
                cx={radius + 10} cy={radius + 10} r={radius} 
                fill="none" stroke="var(--color-accent)" strokeWidth="12"
                strokeLinecap="round" 
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${radius + 10} ${radius + 10})`}
                style={{transition:'stroke-dashoffset 1s ease-out'}} 
              />
            </svg>
            <div className={styles.svgText}>
              <div className={styles.pctVal}>{data.progress.percent}%</div>
              <div className={styles.pctLabel}>Complete</div>
            </div>
          </div>
          <div className={styles.heroSub}>{data.progress.completedTasks} of {data.progress.totalTasks} tasks completed</div>

          <div className={styles.phaseStrip} style={{width: '100%'}}>
            <div className={styles.phaseLine} />
            <div className={styles.phaseLineFill} style={{width: `${fillWidth}%`}} />
            
            {data.progress.phases.map((phase, i) => (
              <div key={i} className={`${styles.phaseNode} ${styles[phase.status]}`}>
                <div className={styles.phaseIcon}>
                  {phase.status === 'done' ? '✓' : phase.status === 'active' ? '●' : '○'}
                </div>
                <div className={styles.phaseName}>{phase.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>What's happening next:</h3>
        <div className={styles.nextStepsList}>
          {data.nextSteps.map((step, i) => (
            <div key={i} className={styles.stepItem}>
              <div className={styles.stepChip}>{step.phase}</div>
              <div className={styles.stepName}>{step.name}</div>
              <div className={styles.stepDate}>{step.date}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Payment Schedule</h3>
        <table className={styles.paymentTable}>
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map((p, i) => (
              <tr key={i} className={p.status === 'Overdue' ? styles.overdue : ''}>
                <td>{p.name}</td>
                <td style={{fontWeight: 600}}>₹{(p.amount/100000).toFixed(2)}L</td>
                <td>{new Date(p.date).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}</td>
                <td>
                  <span style={{
                    color: p.status === 'Paid' ? 'var(--color-success)' : p.status === 'Overdue' ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                    fontWeight: 600, fontSize: 12
                  }}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className={styles.paymentSummary}>
          Total: ₹{(totalCollected/100000).toFixed(2)}L of ₹{(totalValue/100000).toFixed(2)}L collected
        </div>
        <div className={styles.paymentNote}>Please contact your project manager to make payments.</div>
      </div>
    </div>
  )
}
