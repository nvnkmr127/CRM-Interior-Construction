/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import styles from './PortalProject.module.css'
import { usePortalAuth } from '../store/portalAuthContext'
import api from '../../api/axios'

function ReferralSection({ relationship }) {
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [refereeName, setRefereeName] = useState('');
  const [refereePhone, setRefereePhone] = useState('');
  const [refereeEmail, setRefereeEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);

  const referralCode = relationship?.referral_code || 'INTERIOR100';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Hey! I am getting my home interiors designed with CRM Interiors and having a great experience. Use my referral code *${referralCode}* to get an exclusive consultation benefit! Check it out.`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!refereeName) return;
    try {
      await api.post('/portal/project/referrals', {
        refereeName,
        refereePhone,
        refereeEmail,
        notes
      });
      setStatusMsg({ success: true, text: 'Referral submitted! Our team will reach out to them.' });
      setRefereeName('');
      setRefereePhone('');
      setRefereeEmail('');
      setNotes('');
      setShowForm(false);
    } catch (err) {
      setStatusMsg({ success: false, text: 'Failed to submit referral. Please try again.' });
    }
  };

  return (
    <div className={styles.referBox}>
      <div className={styles.referHeader}>
        <div>
          <h4 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
            🎁 Refer Friends & Earn Rewards
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            Share your unique code. Both you and your friend earn cashback on project milestones!
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className={styles.referCodeBadge}>
            <span>{referralCode}</span>
            <button type="button" onClick={handleCopyCode} className={styles.copyBtn} title="Copy code">
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>
          <button 
            type="button" 
            onClick={handleWhatsAppShare} 
            className={styles.contactBtnWhatsApp} 
            style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            💬 Share WhatsApp
          </button>
        </div>
      </div>

      <div style={{ marginTop: '4px' }}>
        {!showForm ? (
          <button 
            type="button" 
            onClick={() => setShowForm(true)} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--color-accent)', 
              fontSize: '12px', 
              fontWeight: 600, 
              cursor: 'pointer',
              padding: 0
            }}
          >
            + Or directly submit a friend's contact details →
          </button>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginTop: '8px' }}>
            <input 
              type="text" 
              placeholder="Friend's Full Name *" 
              value={refereeName} 
              onChange={e => setRefereeName(e.target.value)} 
              required 
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '12px', background: 'var(--color-surface)', color: 'var(--color-text)' }}
            />
            <input 
              type="tel" 
              placeholder="Phone Number" 
              value={refereePhone} 
              onChange={e => setRefereePhone(e.target.value)} 
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '12px', background: 'var(--color-surface)', color: 'var(--color-text)' }}
            />
            <input 
              type="email" 
              placeholder="Email Address" 
              value={refereeEmail} 
              onChange={e => setRefereeEmail(e.target.value)} 
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '12px', background: 'var(--color-surface)', color: 'var(--color-text)' }}
            />
            <div style={{ display: 'flex', gap: '8px', gridColumn: '1 / -1' }}>
              <button 
                type="submit" 
                style={{ 
                  background: 'var(--color-accent)', 
                  color: 'white', 
                  border: 'none', 
                  padding: '8px 16px', 
                  borderRadius: 'var(--radius-md)', 
                  fontWeight: 600, 
                  fontSize: '12px', 
                  cursor: 'pointer' 
                }}
              >
                Submit Referral
              </button>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                style={{ 
                  background: 'var(--color-surface-2)', 
                  color: 'var(--color-text-secondary)', 
                  border: '1px solid var(--color-border)', 
                  padding: '8px 12px', 
                  borderRadius: 'var(--radius-md)', 
                  fontSize: '12px', 
                  cursor: 'pointer' 
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {statusMsg && (
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            color: statusMsg.success ? 'var(--color-success)' : 'var(--color-danger)',
            marginTop: '8px'
          }}>
            {statusMsg.text}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortalProject() {
  const { portalUser } = usePortalAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedPhase, setSelectedPhase] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/portal/project'),
      api.get('/portal/project/phases'),
      api.get('/portal/project/payments'),
      api.get('/portal/project/delay-notifications').catch(() => ({ data: { data: [] } })),
      api.get('/portal/project/relationship').catch(() => null)
    ])
    .then(([projRes, phasesRes, payRes, delayRes, relRes]) => {
      const proj = projRes.data.data || {};
      const phases = phasesRes.data.data || [];
      const payments = payRes.data.data || [];
      const delays = delayRes.data?.data || [];
      const relationship = relRes && relRes.data ? relRes.data.data : null;

      // Find active phase
      const activePhase = phases.find(p => p.status === 'in_progress') || phases[0] || null;
      setSelectedPhase(activePhase);

      setData({
        project: proj,
        phases,
        payments,
        delays,
        relationship
      });
    })
    .catch(err => {
      console.error('Failed to load project portal data', err);
    })
    .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>✦</div>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>Loading your project portal...</div>
      </div>
    );
  }

  if (!data || !data.project) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <h3>No project linked</h3>
        <p>Please contact your design team to activate your customer portal.</p>
      </div>
    );
  }

  const { project, phases, payments, delays, relationship } = data;

  // Calculate stats
  const completionPct = project.task_completion_pct || 42;
  const contractValue = parseFloat(project.contract_value) || 1850000;
  const paidAmount = parseFloat(project.total_paid_amount) || payments.filter(p => p.status?.toLowerCase() === 'paid').reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
  const pendingAmount = Math.max(0, contractValue - paidAmount);
  const paidPct = contractValue > 0 ? Math.round((paidAmount / contractValue) * 100) : 0;

  // Days calculation
  const targetDate = project.target_date ? new Date(project.target_date) : new Date(Date.now() + 60 * 86400000);
  const now = new Date();
  const diffTime = targetDate - now;
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Phase Stepper Fill Width
  const activePhaseIdx = phases.findIndex(p => p.status === 'in_progress');
  const stepperFillPct = phases.length > 1 && activePhaseIdx >= 0 
    ? (activePhaseIdx / (phases.length - 1)) * 100 
    : activePhaseIdx === -1 && phases.length > 0 && phases.every(p => p.status === 'completed') ? 100 : 35;

  // Pending Actions count
  const pendingApprovals = project.pending_approvals_count || 0;
  const pendingChangeOrders = project.pending_change_orders_count || 0;
  const openSnags = project.open_snags_count || 0;
  const hasUrgentActions = pendingApprovals > 0 || pendingChangeOrders > 0;

  return (
    <div className={styles.page}>
      
      {/* 1. Welcome & Status Header Card */}
      <div className={styles.heroCard}>
        <div className={styles.heroHeader}>
          <div>
            <h1 className={styles.welcomeTitle}>
              Welcome back, {portalUser?.name ? portalUser.name.split(' ')[0] : 'Valued Client'}! 👋
            </h1>
            <p className={styles.welcomeSub}>
              <strong>{project.name || `${portalUser?.clientName || 'Residence'} Interiors`}</strong> • Monitored daily by your dedicated team
            </p>
          </div>

          <div className={styles.badgeGroup}>
            <span className={styles.statusPill}>
              ● {project.status ? project.status.toUpperCase().replace('_', ' ') : 'IN PROGRESS'}
            </span>
            <span className={styles.scopePill}>
              {project.is_scope_locked ? '🔒 Scope Locked (In Production)' : '🎨 Design Revisions Active'}
            </span>
            <span className={styles.daysPill}>
              ⏱️ {daysRemaining} Days to Handover
            </span>
          </div>
        </div>

        {/* Priority Action Required Alert Banner */}
        {hasUrgentActions ? (
          <div className={`${styles.actionBanner} ${styles.actionBannerUrgent}`}>
            <div className={styles.actionBannerContent}>
              <span className={styles.actionBannerIcon}>🔔</span>
              <div>
                <div className={styles.actionBannerTitle}>
                  Action Required from You ({pendingApprovals + pendingChangeOrders} items pending)
                </div>
                <div className={styles.actionBannerText}>
                  {pendingApprovals > 0 && `${pendingApprovals} design/material approval(s) `}
                  {pendingChangeOrders > 0 && `${pendingChangeOrders} change order sign-off(s) `}
                  awaiting your review to keep site execution on schedule.
                </div>
              </div>
            </div>
            <Link to="/portal/approvals" className={styles.actionBannerBtn}>
              Review Approvals →
            </Link>
          </div>
        ) : (
          <div className={`${styles.actionBanner} ${styles.actionBannerClear}`}>
            <div className={styles.actionBannerContent}>
              <span className={styles.actionBannerIcon}>✨</span>
              <div>
                <div className={styles.actionBannerTitle}>Everything is on schedule!</div>
                <div className={styles.actionBannerText}>
                  No pending design sign-offs or approvals required from your side at this stage.
                </div>
              </div>
            </div>
            <Link to="/portal/timeline" className={styles.actionBannerBtn} style={{ background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
              View Schedule
            </Link>
          </div>
        )}
      </div>

      {/* Delays Alert Banner if any */}
      {delays && delays.length > 0 && delays.map(delay => (
        <div key={delay.id} className={`${styles.actionBanner} ${styles.actionBannerUrgent}`}>
          <div className={styles.actionBannerContent}>
            <span className={styles.actionBannerIcon}>⚠️</span>
            <div>
              <div className={styles.actionBannerTitle}>
                Timeline Advisory: {delay.type === 'project_delay' ? 'Completion Date Adjusted' : `Milestone "${delay.milestone_name || 'Activity'}" Updated`}
              </div>
              <div className={styles.actionBannerText}>{delay.message}</div>
            </div>
          </div>
          <Link to="/portal/timeline" className={styles.actionBannerBtn}>Timeline Details →</Link>
        </div>
      ))}

      {/* 2. Executive KPI Cards (Design System Tokens) */}
      <div className={styles.kpiGrid}>
        
        {/* Progress KPI */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Project Progress</span>
            <span className={styles.kpiIcon}>📊</span>
          </div>
          <div>
            <div className={styles.kpiValue}>{completionPct}%</div>
            <div className={styles.kpiProgressBar}>
              <div className={styles.kpiProgressFill} style={{ width: `${completionPct}%` }} />
            </div>
          </div>
          <div className={styles.kpiSubtext}>
            <span>Active: <strong>{project.current_phase || 'Execution Phase'}</strong></span>
          </div>
        </div>

        {/* Financials KPI */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Financial Summary</span>
            <span className={styles.kpiIcon}>💳</span>
          </div>
          <div>
            <div className={styles.kpiValue}>₹{(paidAmount / 100000).toFixed(2)}L <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>/ ₹{(contractValue / 100000).toFixed(2)}L</span></div>
            <div className={styles.kpiProgressBar}>
              <div className={styles.kpiProgressFill} style={{ width: `${paidPct}%`, background: 'var(--color-success, #10b981)' }} />
            </div>
          </div>
          <div className={styles.kpiSubtext}>
            <span>Paid: {paidPct}% • Pending: ₹{(pendingAmount / 100000).toFixed(2)}L</span>
          </div>
        </div>

        {/* Timeline KPI */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Target Handover</span>
            <span className={styles.kpiIcon}>📅</span>
          </div>
          <div>
            <div className={styles.kpiValue}>{daysRemaining} <span style={{ fontSize: '14px', fontWeight: 600 }}>Days</span></div>
            <div className={styles.kpiSubtext} style={{ marginTop: '6px' }}>
              Target: <strong>{targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
            </div>
          </div>
          <div className={styles.kpiSubtext}>
            <span>Started: {project.start_date ? new Date(project.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recently'}</span>
          </div>
        </div>

        {/* Scope Lock State */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Design Scope State</span>
            <span className={styles.kpiIcon}>{project.is_scope_locked ? '🔒' : '🎨'}</span>
          </div>
          <div>
            <div className={styles.kpiValue} style={{ fontSize: 'var(--text-lg)', color: project.is_scope_locked ? 'var(--color-success, #10b981)' : 'var(--color-primary, #6366f1)' }}>
              {project.is_scope_locked ? 'Frozen & Locked' : 'Revisions Open'}
            </div>
            <div className={styles.kpiSubtext} style={{ marginTop: '6px' }}>
              {project.is_scope_locked ? 'Production & factory sourcing in progress' : 'Review 3D views to approve final scope'}
            </div>
          </div>
          <div className={styles.kpiSubtext}>
            <Link to="/portal/change-orders" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}>
              {project.is_scope_locked ? 'Submit Change Order →' : 'View Designs →'}
            </Link>
          </div>
        </div>

      </div>

      {/* 3. Interactive 6-Stage Project Lifecycle Stepper */}
      <div className={styles.card}>
        <div className={styles.cardHeaderTitle}>
          <h2 className={styles.sectionTitle}>
            <span>📍</span> Project Journey & Lifecycle Stages
          </h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            Click any phase to inspect milestones
          </span>
        </div>

        <div className={styles.stepperContainer}>
          <div className={styles.stepperTrack}>
            <div className={styles.stepperLine} />
            <div className={styles.stepperLineFill} style={{ width: `${stepperFillPct}%` }} />

            {phases.map((phase, i) => {
              const isDone = phase.status === 'completed';
              const isActive = phase.status === 'in_progress';
              const isSelected = selectedPhase?.id === phase.id;

              return (
                <div 
                  key={phase.id || i}
                  onClick={() => setSelectedPhase(phase)}
                  className={`
                    ${styles.stepperNode} 
                    ${isDone ? styles.stepperNodeDone : isActive ? styles.stepperNodeActive : styles.stepperNodePending}
                  `}
                  style={{ opacity: isSelected ? 1 : 0.85 }}
                >
                  <div className={styles.nodeIcon}>
                    {isDone ? '✓' : isActive ? '●' : i + 1}
                  </div>
                  <div className={styles.nodeLabel}>
                    {phase.name}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expanded Phase Milestone Detail Drawer */}
          {selectedPhase && (
            <div className={styles.phaseDetailBox}>
              <div className={styles.phaseDetailHeader}>
                <h4 className={styles.phaseDetailTitle}>
                  {selectedPhase.name} • 
                  <span style={{ marginLeft: '6px', fontWeight: 500, color: selectedPhase.status === 'completed' ? 'var(--color-success)' : selectedPhase.status === 'in_progress' ? 'var(--color-accent)' : 'var(--color-text-secondary)' }}>
                    {selectedPhase.status === 'completed' ? '✓ Completed' : selectedPhase.status === 'in_progress' ? '⚡ Currently in Progress' : '⏳ Upcoming Stage'}
                  </span>
                </h4>
                <Link to="/portal/timeline" className={styles.sectionActionLink}>Full Schedule & Gantt →</Link>
              </div>

              <div className={styles.milestoneList}>
                {selectedPhase.milestones && selectedPhase.milestones.length > 0 ? (
                  selectedPhase.milestones.map((m, idx) => (
                    <div key={m.id || idx} className={styles.milestoneItem}>
                      <div className={styles.milestoneLeft}>
                        <span className={styles.milestoneStatusIcon}>
                          {m.status === 'completed' ? '🟢' : m.status === 'in_progress' ? '🟡' : '⚪'}
                        </span>
                        <span className={styles.milestoneName}>{m.name}</span>
                      </div>
                      <div className={styles.milestoneDate}>
                        {m.due_date ? new Date(m.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Scheduled'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', padding: '6px 0' }}>
                    Milestones for this stage will be listed once site activity commences.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Two-Column Layout: Direct Team Contacts & Financial Milestones */}
      <div className={styles.twoColGrid}>
        
        {/* Left Column: Direct Project Team Contacts */}
        <div className={styles.card}>
          <div className={styles.cardHeaderTitle}>
            <h2 className={styles.sectionTitle}>
              <span>👥</span> Your Dedicated Project Team
            </h2>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              Direct Support
            </span>
          </div>

          <div className={styles.teamGrid}>
            
            {/* Project Manager */}
            <div className={styles.teamMemberBox}>
              <div className={styles.teamMemberHeader}>
                <div className={styles.teamAvatar}>PM</div>
                <div>
                  <div className={styles.teamRole}>Project Manager</div>
                  <div className={styles.teamName}>{project.pm_name || 'Vikram Malhotra'}</div>
                </div>
              </div>
              <div className={styles.teamActions}>
                <a href={`tel:${project.pm_phone || '+919820154321'}`} className={styles.contactBtn}>
                  📞 Call
                </a>
                <a 
                  href={`https://wa.me/${(project.pm_phone || '919820154321').replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(project.pm_name || 'Vikram')},%20regarding%20my%20interior%20project...`}
                  target="_blank" 
                  rel="noreferrer" 
                  className={`${styles.contactBtn} ${styles.contactBtnWhatsApp}`}
                >
                  💬 WhatsApp
                </a>
              </div>
            </div>

            {/* Lead Interior Designer */}
            <div className={styles.teamMemberBox}>
              <div className={styles.teamMemberHeader}>
                <div className={styles.teamAvatar} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>ID</div>
                <div>
                  <div className={styles.teamRole}>Lead Interior Designer</div>
                  <div className={styles.teamName}>{project.designer_name || 'Ananya Sen'}</div>
                </div>
              </div>
              <div className={styles.teamActions}>
                <a href={`tel:${project.designer_phone || '+919820265432'}`} className={styles.contactBtn}>
                  📞 Call
                </a>
                <a 
                  href={`https://wa.me/${(project.designer_phone || '919820265432').replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(project.designer_name || 'Ananya')},%20regarding%20my%203D%20designs...`}
                  target="_blank" 
                  rel="noreferrer" 
                  className={`${styles.contactBtn} ${styles.contactBtnWhatsApp}`}
                >
                  💬 WhatsApp
                </a>
              </div>
            </div>

          </div>

          <div style={{ marginTop: 'var(--space-4)', padding: '10px 14px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🏢 Client Escalation Desk: <strong>1800-419-4444</strong></span>
            <Link to="/portal/meeting-notes" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}>Meeting Notes →</Link>
          </div>
        </div>

        {/* Right Column: Payment Schedule */}
        <div className={styles.card}>
          <div className={styles.cardHeaderTitle}>
            <h2 className={styles.sectionTitle}>
              <span>💳</span> Milestone Payments
            </h2>
            <Link to="/portal/payments" className={styles.sectionActionLink}>
              Invoices & Receipts →
            </Link>
          </div>

          <table className={styles.paymentTable}>
            <thead>
              <tr>
                <th>Milestone</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 4).map((p, idx) => (
                <tr key={p.id || idx}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                      {p.due_date ? new Date(p.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'TBD'}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    ₹{(parseFloat(p.amount) / 100000).toFixed(2)}L
                  </td>
                  <td>
                    <span className={p.status?.toLowerCase() === 'paid' ? styles.statusTagPaid : styles.statusTagPending}>
                      {p.status?.toLowerCase() === 'paid' ? '✓ Paid' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            <span>Collected: <strong>₹{(paidAmount / 100000).toFixed(2)}L</strong> of ₹{(contractValue / 100000).toFixed(2)}L</span>
            <Link to="/portal/payments" style={{ color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}>Pay Online →</Link>
          </div>
        </div>

      </div>

      {/* 5. Quick Access Command Hub (8 Core Modules) */}
      <div className={styles.card}>
        <div className={styles.cardHeaderTitle}>
          <h2 className={styles.sectionTitle}>
            <span>⚡</span> Quick Navigation Hub
          </h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
            Access all modules
          </span>
        </div>

        <div className={styles.hubGrid}>
          
          <Link to="/portal/design-concepts" className={styles.hubItem}>
            <span className={styles.hubIcon}>🎨</span>
            <span className={styles.hubTitle}>3D Concepts & Renders</span>
          </Link>

          <Link to="/portal/material-palettes" className={styles.hubItem}>
            <span className={styles.hubIcon}>🧱</span>
            <span className={styles.hubTitle}>Material Palettes</span>
          </Link>

          <Link to="/portal/approvals" className={styles.hubItem}>
            {pendingApprovals > 0 && <span className={styles.hubBadge}>{pendingApprovals}</span>}
            <span className={styles.hubIcon}>✍️</span>
            <span className={styles.hubTitle}>Client Approvals</span>
          </Link>

          <Link to="/portal/change-orders" className={styles.hubItem}>
            {pendingChangeOrders > 0 && <span className={styles.hubBadge}>{pendingChangeOrders}</span>}
            <span className={styles.hubIcon}>📝</span>
            <span className={styles.hubTitle}>Change Orders</span>
          </Link>

          <Link to="/portal/snags" className={styles.hubItem}>
            {openSnags > 0 && <span className={styles.hubBadge}>{openSnags}</span>}
            <span className={styles.hubIcon}>🔍</span>
            <span className={styles.hubTitle}>Snag & Punch List</span>
          </Link>

          <Link to="/portal/documents" className={styles.hubItem}>
            <span className={styles.hubIcon}>📁</span>
            <span className={styles.hubTitle}>Documents & Drawings</span>
          </Link>

          <Link to="/portal/weekly-reports" className={styles.hubItem}>
            <span className={styles.hubIcon}>📷</span>
            <span className={styles.hubTitle}>Site Visits & Photos</span>
          </Link>

          <Link to="/portal/warranties" className={styles.hubItem}>
            <span className={styles.hubIcon}>🛡️</span>
            <span className={styles.hubTitle}>Warranties & AMC</span>
          </Link>

        </div>
      </div>

      {/* 6. Referral & Loyalty Rewards Card */}
      <div className={styles.card}>
        <ReferralSection relationship={relationship} />
      </div>

    </div>
  )
}
