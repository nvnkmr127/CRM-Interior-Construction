import { useState, useEffect } from 'react'
import styles from './PortalProject.module.css'
import { usePortalAuth } from '../store/portalAuthContext'
import api from '../../api/axios'

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
    Promise.all([
      api.get('/portal/project'),
      api.get('/portal/project/phases'),
      api.get('/portal/project/payments'),
      api.get('/portal/project/delay-notifications')
    ])
    .then(([projRes, phasesRes, payRes, delayRes]) => {
      const proj = projRes.data.data;
      const phases = phasesRes.data.data || [];
      const payments = payRes.data.data || [];
      const delays = delayRes.data.data || [];

      setData({
        project: { 
          name: proj.client_name ? `${proj.client_name}'s Residence` : proj.name,
          is_scope_locked: proj.is_scope_locked 
        },
        pm: { name: proj.pm_name || 'Assigned Soon', phone: 'Contact office' },
        delays: delays,
        progress: {
          percent: proj.task_completion_pct || 0,
          completedTasks: 0,
          totalTasks: 0,
          phases: phases.map(p => ({
            name: p.name,
            status: p.status === 'completed' ? 'done' : p.status === 'in_progress' ? 'active' : 'pending'
          }))
        },
        nextSteps: phases
          .filter(p => p.status === 'in_progress')
          .flatMap(p => p.milestones.filter(m => m.status !== 'completed').map(m => ({
            phase: p.name,
            name: m.name,
            date: m.due_date ? new Date(m.due_date).toLocaleDateString() : 'Upcoming'
          })))
          .slice(0, 3),
        payments: payments.map(p => ({
          id: p.id,
          name: p.name,
          amount: parseFloat(p.amount) || 0,
          date: p.due_date || 'TBD',
          status: p.status.charAt(0).toUpperCase() + p.status.slice(1)
        }))
      });
    })
    .catch(err => {
      console.error(err);
      // Keep data null to show loading or error state
    });
  }, []);

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

      {data.delays && data.delays.length > 0 && data.delays.map(delay => (
        <div key={delay.id} className={styles.delayAlertCard}>
          <span style={{ fontSize: '28px' }}>⚠️</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-danger)' }}>
              Project Timeline Update: {delay.type === 'project_delay' ? 'Completion Date Revised' : `Milestone "${delay.milestone_name || 'Work'}" Delayed`}
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
              {delay.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              <span>Original Due: {new Date(delay.original_date).toLocaleDateString()}</span>
              <span>•</span>
              <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Revised: {new Date(delay.revised_date).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      ))}

      <div className={`${styles.card} ${data.project.is_scope_locked ? styles.designFrozenCard : styles.designActiveCard}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '28px' }}>{data.project.is_scope_locked ? '🔒' : '🎨'}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Design Scope: {data.project.is_scope_locked ? 'Frozen (Locked)' : 'Active / Revisions Open'}
            </h3>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
              {data.project.is_scope_locked
                ? 'Your design is frozen. Procurement of materials and production are now authorized to proceed. Any new changes will require a commercial Change Order.'
                : 'Your design is currently open for feedback and adjustments. To avoid delays, review the drawings under Design Reviews and approve the design to freeze the scope.'}
            </p>
          </div>
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
