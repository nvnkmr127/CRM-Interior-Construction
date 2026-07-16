/* eslint-disable no-unused-vars */
import React from 'react';

export default function PaymentOverview({
  totalArea,
  avgRate,
  totalProjectValue,
  amountCollected,
  outstandingBalance,
  upcomingDueAmount,
  overdueAmount,
  refundAmountTotal,
  creditNotesTotal,
  gstCollected,
  tdsDeducted,
  pendingInvoiceAmount,
  netRevenue,
  projectCompletionRatio = 0
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>Financial Overview</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Payment Completion</div>
          <div style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '12px', width: '150px', height: '8px', overflow: 'hidden' }}>
            <div style={{ background: '#10b981', width: `${projectCompletionRatio}%`, height: '100%', borderRadius: '12px' }}></div>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{projectCompletionRatio.toFixed(1)}%</div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', marginTop: '8px' }}>
        
        {/* Metric Cards */}
        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📏</span> Total Area
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
            {totalArea} sqft
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500, marginTop: 4 }}>@ ₹{avgRate}/sqft</div>
        </div>
        
        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💰</span> Total Project Value
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
            ₹{totalProjectValue.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✅</span> Amount Collected
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#10b981' }}>
            ₹{amountCollected.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⏳</span> Outstanding Balance
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#f59e0b' }}>
            ₹{outstandingBalance.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📅</span> Upcoming Due Amount
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#3b82f6' }}>
            ₹{upcomingDueAmount.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚠️</span> Overdue Amount
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#ef4444' }}>
            ₹{overdueAmount.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💸</span> Refund Amount
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#8b5cf6' }}>
            ₹{refundAmountTotal.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🧾</span> Credit Notes Issued
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#6366f1' }}>
            ₹{creditNotesTotal.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🏛️</span> GST Collected
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
            ₹{gstCollected.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✂️</span> TDS Deducted
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
            ₹{tdsDeducted.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📄</span> Pending Invoice Amount
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#f97316' }}>
            ₹{pendingInvoiceAmount.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ padding: '20px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📈</span> Net Revenue
          </div>
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#14b8a6' }}>
            ₹{netRevenue.toLocaleString('en-IN')}
          </div>
        </div>

      </div>
    </div>
  );
}
