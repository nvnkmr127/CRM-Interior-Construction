import React from 'react';

export default function ReceiptPreview({ receiptData }) {
  if (!receiptData) return null;

  return (
    <div id="receipt-preview-container" style={{
      padding: '40px',
      background: '#fff',
      color: '#000',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '800px',
      margin: '0 auto',
      border: '1px solid #e5e7eb',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#111827' }}>DIGICLOUDIFY INTERIORS</h1>
          <p style={{ margin: '4px 0', fontSize: '14px', color: '#4b5563' }}>123 Design Avenue, Tech Park, City - 400001</p>
          <p style={{ margin: '4px 0', fontSize: '14px', color: '#4b5563' }}>GSTIN: 27AADCB2230M1Z0 | PAN: AADCB2230M</p>
          <p style={{ margin: '4px 0', fontSize: '14px', color: '#4b5563' }}>Email: accounts@digicloudify.com | Phone: +91 98765 43210</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>RECEIPT</h2>
          <p style={{ margin: '8px 0 4px', fontSize: '16px', fontWeight: 600 }}>No: {receiptData.receiptNumber || 'RCPT-XXXX'}</p>
          <p style={{ margin: '4px 0', fontSize: '14px' }}>Date: {receiptData.collectionDate || new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      {/* Bill To */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Received From</h3>
          <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: 600 }}>{receiptData.customerName || 'Valued Customer'}</p>
          <p style={{ margin: '4px 0', fontSize: '14px', color: '#374151' }}>Project: {receiptData.projectName || 'Interior Design Project'}</p>
          {receiptData.customerGstin && <p style={{ margin: '4px 0', fontSize: '14px', color: '#374151' }}>GSTIN: {receiptData.customerGstin}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Reference</h3>
          <p style={{ margin: '4px 0', fontSize: '14px' }}>Milestone: <span style={{ fontWeight: 600 }}>{receiptData.milestone || 'N/A'}</span></p>
          <p style={{ margin: '4px 0', fontSize: '14px' }}>Invoice Ref: <span style={{ fontWeight: 600 }}>{receiptData.invoiceNumber || 'N/A'}</span></p>
        </div>
      </div>

      {/* Payment Details Table */}
      <div style={{ marginBottom: '32px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600 }}>Payment Description</th>
              <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 600 }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '16px 12px', fontSize: '14px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Payment against {receiptData.milestone || 'Project Milestone'}</p>
                <p style={{ margin: 0, color: '#4b5563' }}>Mode: {receiptData.paymentMode || 'Bank Transfer'}</p>
                {(receiptData.utrNumber || receiptData.transactionId) && (
                  <p style={{ margin: '4px 0 0', color: '#4b5563' }}>Ref/UTR: {receiptData.utrNumber || receiptData.transactionId}</p>
                )}
              </td>
              <td style={{ padding: '16px 12px', textAlign: 'right', fontSize: '16px', fontWeight: 600 }}>
                {Number(receiptData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
        <div style={{ width: '300px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: '14px', color: '#4b5563' }}>Subtotal</span>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>₹{Number((receiptData.amount || 0) - (receiptData.gstAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: '14px', color: '#4b5563' }}>GST Collected</span>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>₹{Number(receiptData.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '2px solid #111827' }}>
            <span style={{ fontSize: '16px', fontWeight: 700 }}>Total Received</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a' }}>₹{Number(receiptData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '60px' }}>
        <div>
          <div style={{ width: '100px', height: '100px', background: '#f3f4f6', border: '1px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '24px', color: '#9ca3af' }}>QR</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Scan to verify receipt</p>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '200px', borderBottom: '1px solid #111827', margin: '0 auto 8px', paddingBottom: '32px' }}>
            {/* Signature Placeholder */}
            <span style={{ fontFamily: 'cursive', fontSize: '24px', color: '#1f2937' }}>System Admin</span>
          </div>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Authorized Signatory</p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>Digicloudify Interiors</p>
        </div>
      </div>

      <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>This is a computer-generated receipt and does not require a physical signature.</p>
      </div>

    </div>
  );
}
