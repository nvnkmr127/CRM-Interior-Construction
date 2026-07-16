/* eslint-disable no-unused-vars, react-hooks/purity */
import React from 'react';
import { Button } from '../../../ui';
import { useToast } from '../../../../store/toastContext';

export default function ReportsAnalytics({
  activeReport,
  setActiveReport
}) {
  const toast = useToast();

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--color-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', flexShrink: 0 }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Select Report</h4>
        {['Collection Report', 'Revenue Report', 'Outstanding Report', 'Refund Report', 'GST Report', 'TDS Report', 'Payment Mode Analysis', 'Cash Flow'].map(rep => (
          <button
            key={rep}
            onClick={() => setActiveReport(rep)}
            style={{
              padding: '12px 16px',
              textAlign: 'left',
              background: activeReport === rep ? 'var(--color-primary-alpha)' : 'transparent',
              color: activeReport === rep ? 'var(--color-primary)' : 'var(--color-text)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: activeReport === rep ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {rep}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700 }}>{activeReport}</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="outline" onClick={() => toast.success(`Exporting ${activeReport} as PDF...`)}>Export PDF</Button>
            <Button variant="outline" onClick={() => toast.success(`Exporting ${activeReport} as Excel...`)}>Export Excel</Button>
          </div>
        </div>

        <div style={{ padding: '40px', background: 'var(--color-background)', borderRadius: 'var(--radius-md)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '48px' }}>📊</span>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{activeReport} Generated</div>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', margin: 0 }}>
            This report aggregates data across all active projects, invoices, and ledgers based on the selected timeframe. Data is mocked for display purposes.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%', marginTop: '24px', textAlign: 'left' }}>
            <div style={{ background: 'var(--color-surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Total Entries</div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px' }}>1,248</div>
            </div>
            <div style={{ background: 'var(--color-surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Aggregate Value</div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px', color: 'var(--color-primary)' }}>₹42,50,000</div>
            </div>
            <div style={{ background: 'var(--color-surface)', padding: '20px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Last Updated</div>
              <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px' }}>Just Now</div>
            </div>
          </div>

          <div style={{ width: '100%', overflowX: 'auto', marginTop: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Reference</th>
                  <th style={{ padding: '12px' }}>Description</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {[1,2,3,4,5].map(i => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px' }}>2024-0{i}-15</td>
                    <td style={{ padding: '12px' }}>REF-{Math.floor(Math.random()*10000)}</td>
                    <td style={{ padding: '12px' }}>Aggregated transaction batch {i}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 500 }}>{(Math.random() * 100000).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
