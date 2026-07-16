/* eslint-disable no-unused-vars */
import React from 'react';
import { Button, Input, Select, DataTable, Badge } from '../../../ui';
import { useToast } from '../../../../store/toastContext';

export default function PaymentHistory({
  logSearchQuery,
  setLogSearchQuery,
  showLogFilters,
  setShowLogFilters,
  logAdvancedFilters,
  setLogAdvancedFilters,
  logColumns,
  paginatedLogs,
  logSortBy,
  setLogSortBy,
  logPage,
  logLimit,
  filteredLogsLength,
  setLogPage
}) {
  const toast = useToast();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>Enterprise Payment Ledger</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="outline" onClick={() => toast.success('Exporting PDF...')}>Export PDF</Button>
          <Button variant="outline" onClick={() => toast.success('Exporting Excel...')}>Export Excel</Button>
          <Button variant="outline" onClick={() => toast.success('Exporting CSV...')}>Export CSV</Button>
          <Button variant="outline" onClick={() => toast.success('Sending to Printer...')}>Print</Button>
        </div>
      </div>
      
      {/* Search & Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-background)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Input 
            placeholder="Search globally by UTR, Invoice, Customer, Project..." 
            value={logSearchQuery}
            onChange={(e) => setLogSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button variant={showLogFilters ? 'primary' : 'outline'} onClick={() => setShowLogFilters(!showLogFilters)}>
            {showLogFilters ? 'Hide Filters' : 'Advanced Filters'}
          </Button>
        </div>

        {showLogFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
            <Input label="Start Date" type="date" value={logAdvancedFilters.dateRangeStart} onChange={e => setLogAdvancedFilters(p => ({...p, dateRangeStart: e.target.value}))} />
            <Input label="End Date" type="date" value={logAdvancedFilters.dateRangeEnd} onChange={e => setLogAdvancedFilters(p => ({...p, dateRangeEnd: e.target.value}))} />
            <Input label="Min Amount" type="number" value={logAdvancedFilters.minAmount} onChange={e => setLogAdvancedFilters(p => ({...p, minAmount: e.target.value}))} />
            <Input label="Max Amount" type="number" value={logAdvancedFilters.maxAmount} onChange={e => setLogAdvancedFilters(p => ({...p, maxAmount: e.target.value}))} />
            <Select label="Payment Mode" value={logAdvancedFilters.paymentMode} onChange={v => setLogAdvancedFilters(p => ({...p, paymentMode: v}))} options={[
              {value: '', label: 'All Modes'}, {value: 'Bank Transfer', label: 'Bank Transfer'}, {value: 'UPI', label: 'UPI'}, {value: 'Credit Card', label: 'Credit Card'}
            ]} />
            <Input label="Employee/Collector" value={logAdvancedFilters.employee} onChange={e => setLogAdvancedFilters(p => ({...p, employee: e.target.value}))} />
            <Select label="Status" value={logAdvancedFilters.status} onChange={v => setLogAdvancedFilters(p => ({...p, status: v}))} options={[
              {value: '', label: 'All Statuses'}, {value: 'Approved', label: 'Approved'}, {value: 'Pending', label: 'Pending'}
            ]} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Flags</label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                  <input type="checkbox" checked={logAdvancedFilters.hasGst} onChange={e => setLogAdvancedFilters(p => ({...p, hasGst: e.target.checked}))} /> GST
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                  <input type="checkbox" checked={logAdvancedFilters.hasTds} onChange={e => setLogAdvancedFilters(p => ({...p, hasTds: e.target.checked}))} /> TDS
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <DataTable 
          columns={logColumns}
          data={paginatedLogs}
          sortBy={logSortBy}
          onSort={(key) => setLogSortBy(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }))}
          pagination={{
            page: logPage,
            limit: logLimit,
            total: filteredLogsLength,
            onPageChange: setLogPage
          }}
          emptyMessage="No payments found matching your criteria"
        />
      </div>
    </div>
  );
}
