import React from 'react';
import { Button, Badge } from '../../../ui';

// TODO (API): Replace mock data with fetchQuotationItems(projectId)
export default function QuotationLineItems({
  mockQuotationItems,
  setMockQuotationItems,
  setQuotationForm,
  setQuotationModalOpen,
  calculateQuotationRowTotal,
  quotationGrandTotal
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>Quotation Line Items</h3>
        <Button variant="primary" onClick={() => {
          setQuotationForm({ id: '', category: 'Civil', subcategory: '', item: '', quantity: 1, unit: 'sqft', rate: 0, discountPercent: 0, gstPercent: 18, vendor: '', notes: '', status: 'Pending' });
          setQuotationModalOpen(true);
        }}>+ Add Item</Button>
      </div>
      
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '13px', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px' }}>Category</th>
              <th style={{ padding: '12px' }}>Item Details</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Qty</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Rate (₹)</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Disc (%)</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>GST (%)</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Total (₹)</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockQuotationItems.map((item, idx) => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s' }}>
                <td style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 600 }}>{item.category}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{item.subcategory}</div>
                </td>
                <td style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 500 }}>{item.item}</div>
                  {item.vendor && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Vendor: {item.vendor}</div>}
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{item.quantity} {item.unit}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{item.rate.toLocaleString('en-IN')}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{item.discountPercent}%</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>{item.gstPercent}%</td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                  {calculateQuotationRowTotal(item.quantity, item.rate, item.discountPercent, item.gstPercent).toLocaleString('en-IN')}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <Badge variant={item.status === 'Approved' ? 'success' : item.status === 'Rejected' ? 'danger' : 'warning'} size="sm">{item.status}</Badge>
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                    <Button variant="ghost" size="sm" style={{padding:'4px'}} onClick={() => {
                      setQuotationForm({...item});
                      setQuotationModalOpen(true);
                    }}>✏️</Button>
                    <Button variant="ghost" size="sm" style={{padding:'4px'}} onClick={() => {
                      setMockQuotationItems(p => [...p, { ...item, id: `QI-${Math.random().toString(36).substr(2, 9)}` }]);
                    }}>📋</Button>
                    <Button variant="ghost" size="sm" style={{padding:'4px'}} onClick={() => {
                      setMockQuotationItems(p => {
                        const newArr = [...p];
                        if (idx > 0) {
                          [newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]];
                        }
                        return newArr;
                      });
                    }}>⬆️</Button>
                    <Button variant="ghost" size="sm" style={{padding:'4px'}} onClick={() => {
                      setMockQuotationItems(p => p.filter(x => x.id !== item.id));
                    }}>🗑️</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--color-text)', background: 'var(--color-background)' }}>
              <td colSpan={6} style={{ padding: '16px 12px', textAlign: 'right', fontWeight: 700, fontSize: '16px' }}>Grand Total</td>
              <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: 800, fontSize: '18px', color: 'var(--color-primary)' }}>
                ₹{quotationGrandTotal.toLocaleString('en-IN')}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
