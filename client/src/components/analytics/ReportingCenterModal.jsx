/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, DataTable } from '../ui';
import { useToast } from '../../store/toastContext';

export default function ReportingCenterModal({ isOpen, onClose }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('export');

  // Scheduled Reports State
  const [scheduledReports, setScheduledReports] = useState(() => {
    try { return JSON.parse(localStorage.getItem('crm_scheduled_reports') || '[]'); } catch { return []; }
  });
  
  // History State
  const [reportHistory, setReportHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('crm_report_history') || '[]'); } catch { return []; }
  });

  // Templates State
  const [templates, setTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('crm_report_templates') || '[]'); } catch { return []; }
  });

  const [scheduleForm, setScheduleForm] = useState({
    name: 'Weekly Management Summary',
    frequency: 'Weekly',
    format: 'PDF',
    emails: ''
  });

  const addToHistory = (action, format) => {
    const newEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleString(),
      action,
      format,
      status: 'Success'
    };
    const next = [newEntry, ...reportHistory];
    setReportHistory(next);
    localStorage.setItem('crm_report_history', JSON.stringify(next));
  };

  const handleExport = (format) => {
    if (format === 'Print') {
      window.print();
      addToHistory('Printed Dashboard', 'Print');
      toast.success('Print dialog opened');
      return;
    }
    
    // Simulate Download
    const blob = new Blob(['Simulated Report Content'], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Analytics_Report_${new Date().toISOString().slice(0,10)}.${format.toLowerCase()}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addToHistory(`Exported ${format}`, format);
    toast.success(`${format} Report Generated`);
  };

  const handleSchedule = (e) => {
    e.preventDefault();
    if (!scheduleForm.emails) {
      toast.error('Please enter at least one recipient email.');
      return;
    }
    
    const newSchedule = {
      id: Date.now().toString(),
      ...scheduleForm,
      created: new Date().toLocaleDateString()
    };
    
    const next = [newSchedule, ...scheduledReports];
    setScheduledReports(next);
    localStorage.setItem('crm_scheduled_reports', JSON.stringify(next));
    
    addToHistory(`Scheduled ${scheduleForm.frequency} Report`, scheduleForm.format);
    toast.success('Report Scheduled Successfully');
    setScheduleForm({ ...scheduleForm, emails: '' });
  };

  const handleSaveTemplate = () => {
    const name = prompt('Enter a name for this report template:');
    if (!name) return;
    const newTpl = {
      id: Date.now().toString(),
      name,
      date: new Date().toLocaleDateString()
    };
    const next = [newTpl, ...templates];
    setTemplates(next);
    localStorage.setItem('crm_report_templates', JSON.stringify(next));
    toast.success('Template Saved');
  };

  const TABS = [
    { id: 'export', label: 'Export & Print' },
    { id: 'schedule', label: 'Schedule & Email' },
    { id: 'templates', label: 'Templates' },
    { id: 'history', label: 'History' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reporting Center" size="lg">
      
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '20px' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ minHeight: '300px' }}>
        
        {activeTab === 'export' && (
          <div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
              Generate instant reports based on the current dashboard view and applied filters.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <ExportCard icon="📄" title="Export PDF" desc="Formatted document for printing" onClick={() => handleExport('PDF')} />
              <ExportCard icon="📊" title="Export Excel" desc="Raw data with formulas (.xlsx)" onClick={() => handleExport('Excel')} />
              <ExportCard icon="📑" title="Export CSV" desc="Plain text data for import" onClick={() => handleExport('CSV')} />
              <ExportCard icon="🖨️" title="Print Dashboard" desc="Send directly to printer" onClick={() => handleExport('Print')} />
              <ExportCard icon="📸" title="Snapshot Image" desc="Download as PNG image" onClick={() => handleExport('PNG')} />
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div>
            <form onSubmit={handleSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--color-surface-2)', padding: '20px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '16px', margin: 0 }}>Create Automated Report</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Report Name</label>
                  <Input value={scheduleForm.name} onChange={e => setScheduleForm({...scheduleForm, name: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Frequency</label>
                  <select 
                    value={scheduleForm.frequency}
                    onChange={e => setScheduleForm({...scheduleForm, frequency: e.target.value})}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                  >
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Recipients (Comma separated)</label>
                <Input placeholder="manager@company.com, team@company.com" value={scheduleForm.emails} onChange={e => setScheduleForm({...scheduleForm, emails: e.target.value})} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Attachment Format</label>
                <select 
                  value={scheduleForm.format}
                  onChange={e => setScheduleForm({...scheduleForm, format: e.target.value})}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  <option>PDF</option>
                  <option>Excel</option>
                  <option>CSV</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Button type="submit" variant="primary">Schedule & Enable</Button>
              </div>
            </form>

            {scheduledReports.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Active Schedules</h3>
                <DataTable 
                  columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'frequency', label: 'Frequency' },
                    { key: 'format', label: 'Format' },
                    { key: 'emails', label: 'Recipients' },
                  ]}
                  data={scheduledReports}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Save your current dashboard configuration as a reusable report template.</p>
              <Button onClick={handleSaveTemplate} variant="outline">Save Current View</Button>
            </div>
            
            <DataTable 
              columns={[
                { key: 'name', label: 'Template Name' },
                { key: 'date', label: 'Created On' },
                { key: 'action', label: 'Action' }
              ]}
              data={templates.map(t => ({
                ...t,
                action: <Button size="sm" variant="outline" onClick={() => toast.success(`Loaded Template: ${t.name}`)}>Load Template</Button>
              }))}
              emptyMessage="No saved templates found."
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <DataTable 
              columns={[
                { key: 'date', label: 'Date/Time' },
                { key: 'action', label: 'Action' },
                { key: 'format', label: 'Format' },
                { key: 'status', label: 'Status' }
              ]}
              data={reportHistory.map(h => ({
                ...h,
                status: <span style={{ color: '#059669', fontWeight: 600 }}>{h.status}</span>
              }))}
              emptyMessage="No reports have been generated yet."
            />
          </div>
        )}

      </div>
    </Modal>
  );
}

function ExportCard({ icon, title, desc, onClick }) {
  return (
    <div 
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '20px',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        cursor: 'pointer',
        background: 'var(--color-surface)',
        transition: 'all 0.2s ease'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ fontSize: '24px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface-2)', borderRadius: '8px' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{desc}</div>
      </div>
    </div>
  );
}
