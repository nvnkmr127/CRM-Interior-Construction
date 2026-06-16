import React, { useState } from 'react';
import { Badge, Button, Modal, Input } from '../../components/ui';
import styles from './PaymentsTab.module.css';

export default function PaymentsTab({ projectId }) {
  const [payments, setPayments] = useState([
    { id: 1, milestone: 'Advance', phase: 'Kickoff', amount: '₹1,50,000', amountValue: 150000, dueDate: '2026-08-01', status: 'paid' },
    { id: 2, milestone: '3D Renders Approval', phase: 'Design Concept', amount: '₹1,70,000', amountValue: 170000, dueDate: '2026-08-15', status: 'paid' },
    { id: 3, milestone: 'Material Sourcing', phase: 'Execution', amount: '₹2,50,000', amountValue: 250000, dueDate: '2026-05-10', status: 'invoice_raised' },
    { id: 4, milestone: 'Keys Handover', phase: 'Handover', amount: '₹2,80,000', amountValue: 280000, dueDate: '2026-11-15', status: 'scheduled' }
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Overdue logic
  const today = new Date().toISOString().split('T')[0];
  
  const processedPayments = payments.map(p => {
    if (p.status !== 'paid' && p.dueDate < today) {
      return { ...p, displayStatus: 'overdue', isOverdue: true };
    }
    return { ...p, displayStatus: p.status, isOverdue: false };
  });

  const overdueCount = processedPayments.filter(p => p.isOverdue).length;

  const totalValue = payments.reduce((sum, p) => sum + p.amountValue, 0);
  const collectedValue = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amountValue, 0);
  const overdueValue = processedPayments.filter(p => p.isOverdue).reduce((sum, p) => sum + p.amountValue, 0);
  const pendingValue = totalValue - collectedValue;
  const progressPct = totalValue > 0 ? (collectedValue / totalValue) * 100 : 0;

  const formatLakhs = (val) => `₹${(val / 100000).toFixed(1)}L`;

  const handleMarkPaidClick = (p) => {
    setSelectedPayment(p);
    setModalOpen(true);
  };

  const getStatusVariant = (st) => {
    if (st === 'paid') return 'success';
    if (st === 'overdue') return 'danger';
    if (st === 'invoice_raised') return 'info';
    return 'neutral';
  };

  return (
    <div className={styles.tabWrap}>
      {overdueCount > 0 && (
        <div className={styles.overdueNotice}>
          {overdueCount} overdue payment{overdueCount > 1 ? 's' : ''}
        </div>
      )}

      <div className={styles.summaryBar}>
        <div className={styles.summaryStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Collected</span>
            <span className={styles.statValue}>{formatLakhs(collectedValue)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Pending</span>
            <span className={styles.statValue}>{formatLakhs(pendingValue)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Overdue</span>
            <span className={`${styles.statValue} ${overdueCount > 0 ? styles.statDanger : ''}`}>{formatLakhs(overdueValue)}</span>
          </div>
        </div>
        <div className={styles.progressWrap}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct.toFixed(1)}%` }} />
          </div>
        </div>
      </div>

      <div style={{background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden'}}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Linked Phase</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {processedPayments.map(p => (
              <tr key={p.id} className={p.isOverdue ? styles.rowOverdue : ''}>
                <td style={{fontWeight: 500}}>{p.milestone}</td>
                <td>{p.phase}</td>
                <td style={{fontWeight: 600}}>{p.amount}</td>
                <td style={p.isOverdue ? {color: 'var(--color-danger)', fontWeight: 600} : {}}>{p.dueDate}</td>
                <td><Badge variant={getStatusVariant(p.displayStatus)} size="sm">{p.displayStatus.replace('_', ' ').toUpperCase()}</Badge></td>
                <td>
                  {p.status !== 'paid' && (
                    <Button variant="outline" size="sm" onClick={() => handleMarkPaidClick(p)}>Mark Paid</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal isOpen onClose={() => setModalOpen(false)}>
          <div style={{padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)'}}>
            <h3 style={{fontSize: 'var(--text-lg)', fontWeight: 700}}>Mark Payment Paid</h3>
            <Input label="Amount Paid" defaultValue={selectedPayment?.amount} />
            <Input label="Date Paid" type="date" defaultValue={today} />
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)'}}>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>Confirm Payment</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
