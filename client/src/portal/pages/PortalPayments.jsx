/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo } from 'react'
import styles from './PortalPayments.module.css'
import { useToast } from '../../store/toastContext'
import api from '../../api/axios'

export default function PortalPayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  const toast = useToast()

  const fetchPayments = async () => {
    try {
      const res = await api.get('/portal/project/payments')
      if (res.data?.success) {
        setPayments(res.data.data || [])
      }
    } catch (e) {
      toast.error('Failed to load payment milestones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [])

  const handlePay = async (paymentId) => {
    setProcessingId(paymentId)
    try {
      // Simulate payment processing via backend endpoint
      const res = await api.post(`/portal/project/payments/${paymentId}/pay`)
      if (res.data?.success) {
        toast.success('Payment successful!')
        fetchPayments() // Refresh list
      }
    } catch (e) {
      toast.error('Payment failed to process')
    } finally {
      setProcessingId(null)
    }
  }

  const { totalPaid, totalDue, totalScheduled } = useMemo(() => {
    return payments.reduce((acc, p) => {
      const amt = parseFloat(p.amount) || 0
      if (p.status === 'paid') acc.totalPaid += amt
      else if (p.status === 'due' || p.status === 'overdue' || (p.due_date && new Date(p.due_date) < new Date())) acc.totalDue += amt
      else acc.totalScheduled += amt
      return acc
    }, { totalPaid: 0, totalDue: 0, totalScheduled: 0 })
  }, [payments])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }

  if (loading) return <div style={{padding: 24, textAlign: 'center', color: 'var(--color-text-muted)'}}>Loading payments...</div>

  const dueList = payments.filter(p => p.status !== 'paid' && (p.status === 'due' || p.status === 'overdue' || (p.due_date && new Date(p.due_date) <= new Date())))
  const scheduledList = payments.filter(p => p.status !== 'paid' && !dueList.includes(p))
  const paidList = payments.filter(p => p.status === 'paid')

  const renderPaymentCard = (payment, isDue = false) => (
    <div key={payment.id} className={styles.paymentCard}>
      <div className={styles.paymentInfo}>
        <div className={styles.paymentName}>{payment.name}</div>
        <div className={styles.paymentMeta}>
          <span className={`${styles.statusBadge} ${isDue ? styles.due : (payment.status === 'paid' ? styles.paid : styles.scheduled)}`}>
            {payment.status === 'paid' ? 'Paid' : (isDue ? 'Due Now' : 'Scheduled')}
          </span>
          {payment.due_date && (
            <span>{payment.status === 'paid' ? 'Paid on ' : 'Due by '}{new Date(payment.due_date).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'})}</span>
          )}
        </div>
      </div>
      <div className={styles.paymentAction}>
        <div className={styles.amount}>{formatCurrency(payment.amount)}</div>
        {payment.status !== 'paid' ? (
          <button 
            className={styles.payBtn} 
            disabled={processingId === payment.id || (!isDue && scheduledList.includes(payment))}
            onClick={() => handlePay(payment.id)}
            style={{ display: isDue ? 'block' : 'none' }}
          >
            {processingId === payment.id ? 'Processing...' : 'Pay Now'}
          </button>
        ) : (
          <button className={styles.receiptBtn}>Download Receipt</button>
        )}
      </div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Payments & Milestones</h1>
        <div className={styles.pageSub}>Track your project's financial progress and pay dues securely.</div>
      </div>

      <div className={styles.summaryCards}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryTitle}>Total Paid</div>
          <div className={`${styles.summaryValue} ${styles.paid}`}>{formatCurrency(totalPaid)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryTitle}>Due Now</div>
          <div className={`${styles.summaryValue} ${totalDue > 0 ? styles.due : ''}`}>{formatCurrency(totalDue)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryTitle}>Upcoming</div>
          <div className={styles.summaryValue}>{formatCurrency(totalScheduled)}</div>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className={styles.emptyState}>No payment milestones have been set for this project yet.</div>
      ) : (
        <>
          {dueList.length > 0 && (
            <div className={styles.paymentSection}>
              <h2 className={styles.sectionTitle}>Due Payments</h2>
              <div className={styles.paymentList}>
                {dueList.map(p => renderPaymentCard(p, true))}
              </div>
            </div>
          )}

          {scheduledList.length > 0 && (
            <div className={styles.paymentSection}>
              <h2 className={styles.sectionTitle}>Upcoming Milestones</h2>
              <div className={styles.paymentList}>
                {scheduledList.map(p => renderPaymentCard(p, false))}
              </div>
            </div>
          )}

          {paidList.length > 0 && (
            <div className={styles.paymentSection}>
              <h2 className={styles.sectionTitle}>Payment History</h2>
              <div className={styles.paymentList}>
                {paidList.map(p => renderPaymentCard(p, false))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
