import React, { useState, useEffect } from 'react';
import { Badge, Button, Modal, Input } from '../../components/ui';
import styles from './PaymentsTab.module.css';
import { getPaymentMilestones, updatePaymentMilestone } from '../../api/paymentMilestones';
import { useToast } from '../../store/toastContext';

export default function PaymentsTab({ projectId }) {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paidDate, setPaidDate] = useState('');

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getPaymentMilestones(projectId)
      .then(res => {
        const raw = res.data?.data || res.data || [];
        setPayments(raw.map(p => ({
          id: p.id,
          milestone: p.title || p.milestone || p.name,
          phase: p.phase_name || p.phase || '—',
          amountValue: Number(p.amount || 0),
          dueDate: p.due_date ? p.due_date.split('T')[0] : null,
          status: p.status || 'scheduled',
        })));
      })
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, [projectId]);

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
    setPaidDate(new Date().toISOString().split('T')[0]);
    setModalOpen(true);
  };

  const handleConfirmPaid = async () => {
    try {
      await updatePaymentMilestone(selectedPayment.id, { status: 'paid', paid_date: paidDate });
      setPayments(prev => prev.map(p => p.id === selectedPayment.id ? { ...p, status: 'paid' } : p));
      toast.success('Payment marked as paid');
    } catch {
      toast.error('Failed to update payment');
    }
    setModalOpen(false);
  };

  const getStatusVariant = (st) => {
    if (st === 'paid') return 'success';
    if (st === 'overdue') return 'danger';
    if (st === 'invoice_raised') return 'info';
    return 'neutral';
  };

  if (loading) {
    return <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>Loading payments…</div>;
  }

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
                <td style={{fontWeight: 600}}>{formatLakhs(p.amountValue)}</td>
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
            <Input label="Amount" value={formatLakhs(selectedPayment?.amountValue || 0)} readOnly />
            <Input label="Date Paid" type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)'}}>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleConfirmPaid}>Confirm Payment</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
