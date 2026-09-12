/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './FinancialSettings.module.css';

export default function FinancialSettings() {
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('thresholds'); // 'thresholds' | 'automation' | 'templates'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Template Manager Modal State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    id: '',
    name: '',
    description: '',
    milestones: [
      { name: 'Month 1 - Booking Advance', percentage: 20, stage: 'Booking', offsetDays: 0 },
      { name: 'Month 2 - Design Approval', percentage: 20, stage: 'Design', offsetDays: 30 },
      { name: 'Month 3 - Factory Production Start', percentage: 20, stage: 'Production', offsetDays: 60 },
      { name: 'Month 4 - On-site Installation', percentage: 20, stage: 'Installation', offsetDays: 90 },
      { name: 'Month 5 - Handover', percentage: 20, stage: 'Handover', offsetDays: 120 }
    ]
  });

  const defaultPaymentTemplates = [
    {
      id: 'tpl-5month-20',
      name: '5-Month Equal Installment Plan (20% x 5)',
      description: '5 equal monthly payments of 20% across 5 consecutive project months.',
      milestones: [
        { name: 'Month 1 - Booking Advance', percentage: 20, stage: 'Booking', offsetDays: 0 },
        { name: 'Month 2 - Design Finalization', percentage: 20, stage: 'Design', offsetDays: 30 },
        { name: 'Month 3 - Factory Production Start', percentage: 20, stage: 'Production', offsetDays: 60 },
        { name: 'Month 4 - Site Installation', percentage: 20, stage: 'Installation', offsetDays: 90 },
        { name: 'Month 5 - Final Handover', percentage: 20, stage: 'Handover', offsetDays: 120 }
      ]
    },
    {
      id: 'tpl-3stage-20-50-30',
      name: 'Standard 3-Stage Milestone (20% - 50% - 30%)',
      description: '20% booking advance, 50% material dispatch, 30% final handover.',
      milestones: [
        { name: 'Stage 1 - Booking Advance', percentage: 20, stage: 'Booking', offsetDays: 0 },
        { name: 'Stage 2 - Material Dispatch', percentage: 50, stage: 'Material Dispatch', offsetDays: 30 },
        { name: 'Stage 3 - Final Handover', percentage: 30, stage: 'Handover', offsetDays: 60 }
      ]
    },
    {
      id: 'tpl-4stage-10-40-40-10',
      name: 'Commercial Construction 4-Stage (10% - 40% - 40% - 10%)',
      description: '10% sign-up, 40% structure, 40% finishing, 10% retention handover.',
      milestones: [
        { name: 'Token Advance', percentage: 10, stage: 'Token', offsetDays: 0 },
        { name: 'Civil & Structure Work', percentage: 40, stage: 'Structure', offsetDays: 30 },
        { name: 'Interior Finishing', percentage: 40, stage: 'Finishing', offsetDays: 75 },
        { name: 'Handover & Retention', percentage: 10, stage: 'Retention', offsetDays: 105 }
      ]
    }
  ];

  const [settings, setSettings] = useState({
    // Financial Approval Thresholds (INR)
    finance_invoice_threshold: 100000,
    finance_payment_threshold: 100000,
    finance_discount_threshold: 50000,
    finance_credit_threshold: 50000,

    // Tax & Statutory Compliance
    gst_number: '',
    default_gst_rate: 18,
    hsn_sac_code: '9954',
    tds_default_rate: 2,

    // Payment & Approval Automation
    auto_approval_under_threshold: false,
    require_payment_receipt_attachment: true,
    payment_reminder_days: 3,
    currency_code: 'INR',

    // Payment Schedule Templates
    payment_templates: defaultPaymentTemplates
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/config/tenant-settings');
      const data = res.data?.data || {};
      setSettings({
        finance_invoice_threshold: data.finance_invoice_threshold !== undefined ? Number(data.finance_invoice_threshold) : 100000,
        finance_payment_threshold: data.finance_payment_threshold !== undefined ? Number(data.finance_payment_threshold) : 100000,
        finance_discount_threshold: data.finance_discount_threshold !== undefined ? Number(data.finance_discount_threshold) : 50000,
        finance_credit_threshold: data.finance_credit_threshold !== undefined ? Number(data.finance_credit_threshold) : 50000,

        gst_number: data.gst_number || data.gst_settings?.gstin || '',
        default_gst_rate: data.default_gst_rate !== undefined ? Number(data.default_gst_rate) : 18,
        hsn_sac_code: data.hsn_sac_code || '9954',
        tds_default_rate: data.tds_default_rate !== undefined ? Number(data.tds_default_rate) : 2,

        auto_approval_under_threshold: Boolean(data.auto_approval_under_threshold),
        require_payment_receipt_attachment: data.require_payment_receipt_attachment !== undefined ? Boolean(data.require_payment_receipt_attachment) : true,
        payment_reminder_days: data.payment_reminder_days !== undefined ? Number(data.payment_reminder_days) : 3,
        currency_code: data.currency_code || 'INR',
        payment_templates: data.payment_templates || defaultPaymentTemplates
      });
    } catch (err) {
      console.error('Failed to load financial settings:', err);
      toast.error('Failed to load financial settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (value === '' ? '' : (type === 'number' ? Number(value) : value))
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/config/tenant-settings', settings);
      toast.success('Financial settings updated successfully!');
    } catch (err) {
      console.error('Failed to save financial settings:', err);
      toast.error('Failed to update financial settings.');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => {
    const num = val !== undefined && val !== null ? Number(val) : 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner}></div>
        <p>Loading financial governance & settings...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header Banner */}
      <div className={styles.header}>
        <div>
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>Financial Settings & Controls</h1>
            <span className={styles.policyBadge}>Tenant Governance</span>
          </div>
          <p className={styles.subtitle}>
            Configure monetary approval limits, GST & tax rates, and payment workflow policies for your organization.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button 
            type="button" 
            className={styles.matrixBtn}
            onClick={() => navigate('/settings/approval-matrix')}
            title="Configure manager approval chains"
          >
            📋 Approval Matrix →
          </button>
        </div>
      </div>

      {/* Financial Overview KPI Cards */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Invoice Limit</span>
          <span className={styles.kpiVal}>{formatCurrency(settings.finance_invoice_threshold)}</span>
          <span className={styles.kpiSub}>Requires approval above</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Payment Limit</span>
          <span className={styles.kpiVal}>{formatCurrency(settings.finance_payment_threshold)}</span>
          <span className={styles.kpiSub}>Milestone approval threshold</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Discount Limit</span>
          <span className={styles.kpiVal}>{formatCurrency(settings.finance_discount_threshold)}</span>
          <span className={styles.kpiSub}>Max instant discount</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Default GST Rate</span>
          <span className={styles.kpiVal}>{settings.default_gst_rate}%</span>
          <span className={styles.kpiSub}>Standard billing tax</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabNav}>
        <button 
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'thresholds' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('thresholds')}
        >
          💰 Monetary Thresholds
        </button>
        <button 
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'automation' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('automation')}
        >
          ⚙️ Payment Automation Policies
        </button>
        <button 
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'templates' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          🗓️ Payment Schedule Templates
        </button>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className={styles.card}>
        {/* Tab 1: Monetary Thresholds */}
        <div 
          className={styles.section} 
          style={{ display: activeTab === 'thresholds' ? 'flex' : 'none' }}
        >
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Monetary Approval Thresholds</h3>
            <p className={styles.sectionDesc}>Set the minimum amounts above which financial transactions trigger mandatory manager approvals.</p>
          </div>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="finance_invoice_threshold" className={styles.label}>
                Invoice Generation Threshold (INR)
              </label>
              <div className={styles.inputWrap}>
                <input
                  type="number"
                  id="finance_invoice_threshold"
                  name="finance_invoice_threshold"
                  value={settings.finance_invoice_threshold}
                  onChange={handleInputChange}
                  required
                  min="0"
                  className={`${styles.input} ${styles.hasSuffix}`}
                  placeholder="100000"
                />
                <span className={styles.inputSuffix}>INR (₹)</span>
              </div>
              <span className={styles.hint}>Invoices with total value exceeding this limit will require formal approval before sending to client.</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="finance_payment_threshold" className={styles.label}>
                Payment Received / Milestone Threshold (INR)
              </label>
              <div className={styles.inputWrap}>
                <input
                  type="number"
                  id="finance_payment_threshold"
                  name="finance_payment_threshold"
                  value={settings.finance_payment_threshold}
                  onChange={handleInputChange}
                  required
                  min="0"
                  className={`${styles.input} ${styles.hasSuffix}`}
                  placeholder="100000"
                />
                <span className={styles.inputSuffix}>INR (₹)</span>
              </div>
              <span className={styles.hint}>Milestones or payment updates exceeding this value will require finance manager verification.</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="finance_discount_threshold" className={styles.label}>
                Quotation Discount Threshold (INR)
              </label>
              <div className={styles.inputWrap}>
                <input
                  type="number"
                  id="finance_discount_threshold"
                  name="finance_discount_threshold"
                  value={settings.finance_discount_threshold}
                  onChange={handleInputChange}
                  required
                  min="0"
                  className={`${styles.input} ${styles.hasSuffix}`}
                  placeholder="50000"
                />
                <span className={styles.inputSuffix}>INR (₹)</span>
              </div>
              <span className={styles.hint}>Quotation discounts exceeding this flat amount require executive sign-off.</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="finance_credit_threshold" className={styles.label}>
                Credit Note & Refund Threshold (INR)
              </label>
              <div className={styles.inputWrap}>
                <input
                  type="number"
                  id="finance_credit_threshold"
                  name="finance_credit_threshold"
                  value={settings.finance_credit_threshold}
                  onChange={handleInputChange}
                  required
                  min="0"
                  className={`${styles.input} ${styles.hasSuffix}`}
                  placeholder="50000"
                />
                <span className={styles.inputSuffix}>INR (₹)</span>
              </div>
              <span className={styles.hint}>Issuing credit notes or customer refunds above this limit requires finance approval.</span>
            </div>
          </div>
        </div>

        {/* Tab 2: Payment Automation Policies */}
        <div 
          className={styles.section} 
          style={{ display: activeTab === 'automation' ? 'flex' : 'none' }}
        >
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Payment & Approval Automation Policies</h3>
            <p className={styles.sectionDesc}>Enforce verification rules, mandatory attachment policies, and automated milestone reminders.</p>
          </div>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="auto_approval_under_threshold" className={styles.label}>
                Auto-Approve Transactions Under Threshold
              </label>
              <div className={styles.inputWrap}>
                <select
                  id="auto_approval_under_threshold"
                  name="auto_approval_under_threshold"
                  value={settings.auto_approval_under_threshold ? 'true' : 'false'}
                  onChange={(e) => setSettings(prev => ({ ...prev, auto_approval_under_threshold: e.target.value === 'true' }))}
                  className={styles.select}
                >
                  <option value="false">Disabled — Manual Review Required</option>
                  <option value="true">Enabled — Auto-Approve Below Limits</option>
                </select>
              </div>
              <span className={styles.hint}>When enabled, financial requests below defined limits are automatically approved without requiring manual sign-off.</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="require_payment_receipt_attachment" className={styles.label}>
                Mandate Payment Receipt Attachment Proof
              </label>
              <div className={styles.inputWrap}>
                <select
                  id="require_payment_receipt_attachment"
                  name="require_payment_receipt_attachment"
                  value={settings.require_payment_receipt_attachment ? 'true' : 'false'}
                  onChange={(e) => setSettings(prev => ({ ...prev, require_payment_receipt_attachment: e.target.value === 'true' }))}
                  className={styles.select}
                >
                  <option value="true">Required — Mandate Receipt Upload</option>
                  <option value="false">Optional — Upload Not Required</option>
                </select>
              </div>
              <span className={styles.hint}>Requires users to upload bank receipt or transaction proof when logging payment updates.</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="payment_reminder_days" className={styles.label}>
                Milestone Due Date Reminder Lead Time
              </label>
              <div className={styles.inputWrap}>
                <input
                  type="number"
                  id="payment_reminder_days"
                  name="payment_reminder_days"
                  value={settings.payment_reminder_days}
                  onChange={handleInputChange}
                  min="1"
                  max="30"
                  className={`${styles.input} ${styles.hasSuffix}`}
                  placeholder="3"
                />
                <span className={styles.inputSuffix}>Days</span>
              </div>
              <span className={styles.hint}>Days before milestone due date to send automated collection notices to clients.</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="currency_code" className={styles.label}>
                Default Base Currency
              </label>
              <div className={styles.inputWrap}>
                <input
                  type="text"
                  id="currency_code"
                  name="currency_code"
                  value={`${settings.currency_code} (₹)`}
                  disabled
                  className={styles.input}
                />
              </div>
              <span className={styles.hint}>Primary monetary currency unit used for financial calculations across the CRM system.</span>
            </div>
          </div>
        </div>

        {/* Tab 3: Payment Schedule Templates */}
        <div 
          className={styles.section} 
          style={{ display: activeTab === 'templates' ? 'flex' : 'none' }}
        >
          <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h3 className={styles.sectionTitle}>Payment Schedule Templates</h3>
              <p className={styles.sectionDesc}>Manage standardized milestone payment schedules to automatically apply in quotations and projects.</p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className={styles.matrixBtn}
                style={{ padding: '6px 12px', fontSize: 'var(--text-xs)' }}
                onClick={() => {
                  setSettings(prev => ({ ...prev, payment_templates: defaultPaymentTemplates }));
                  toast.success('Restored default templates.');
                }}
              >
                🔄 Restore Defaults
              </button>
              <button
                type="button"
                className={styles.saveButton}
                style={{ width: 'auto', padding: '6px 14px', fontSize: 'var(--text-xs)' }}
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateForm({
                    id: 'tpl-' + Date.now(),
                    name: '',
                    description: '',
                    category: 'Standard',
                    milestones: [
                      { name: 'Month 1 - Booking Advance', percentage: 20, stage: 'Booking', offsetDays: 0 },
                      { name: 'Month 2 - Design Approval', percentage: 20, stage: 'Design', offsetDays: 30 },
                      { name: 'Month 3 - Factory Production Start', percentage: 20, stage: 'Production', offsetDays: 60 },
                      { name: 'Month 4 - On-site Installation', percentage: 20, stage: 'Installation', offsetDays: 90 },
                      { name: 'Month 5 - Final Handover', percentage: 20, stage: 'Handover', offsetDays: 120 }
                    ]
                  });
                  setShowTemplateModal(true);
                }}
              >
                + Create Template
              </button>
            </div>
          </div>

          {/* Template Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
            {(settings.payment_templates || defaultPaymentTemplates).map((tpl, idx) => {
              const colors = ['var(--color-accent)', 'var(--color-success)', 'var(--color-warning)', '#8b5cf6', '#ec4899'];

              return (
                <div key={tpl.id || idx} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-text)' }}>{tpl.name}</h4>
                      {tpl.description && <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{tpl.description}</p>}
                    </div>
                    <span style={{ background: 'var(--color-accent-bg, rgba(59,130,246,0.1))', color: 'var(--color-accent)', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-xs)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {tpl.milestones?.length || 0} Stages
                    </span>
                  </div>

                  {/* Multi-color Progress Bar */}
                  <div style={{ display: 'flex', height: '8px', width: '100%', borderRadius: 'var(--radius-full)', overflow: 'hidden', background: 'var(--color-border-light)' }}>
                    {tpl.milestones?.map((m, mIdx) => (
                      <div
                        key={mIdx}
                        title={`${m.name}: ${m.percentage}%`}
                        style={{
                          width: `${m.percentage}%`,
                          backgroundColor: colors[mIdx % colors.length]
                        }}
                      />
                    ))}
                  </div>

                  {/* Stages List */}
                  <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', border: '1px solid var(--color-border-light)' }}>
                    {tpl.milestones?.map((m, mIdx) => (
                      <div key={mIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: mIdx < tpl.milestones.length - 1 ? '1px solid var(--color-border-light)' : 'none', fontSize: 'var(--text-xs)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{m.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>+{m.offsetDays || 0}d</span>
                          <span style={{ fontWeight: 800, color: 'var(--color-accent)' }}>{m.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'auto' }}>
                    <button
                      type="button"
                      className={styles.matrixBtn}
                      style={{ padding: '4px 10px', fontSize: 'var(--text-xs)' }}
                      onClick={() => {
                        const dup = {
                          ...tpl,
                          id: 'tpl-' + Date.now(),
                          name: `${tpl.name} (Copy)`
                        };
                        const updated = [...(settings.payment_templates || defaultPaymentTemplates), dup];
                        setSettings(prev => ({ ...prev, payment_templates: updated }));
                        toast.success(`Duplicated "${tpl.name}"!`);
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className={styles.matrixBtn}
                      style={{ padding: '4px 10px', fontSize: 'var(--text-xs)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
                      onClick={() => {
                        setEditingTemplate(tpl.id);
                        setTemplateForm(tpl);
                        setShowTemplateModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.matrixBtn}
                      style={{ padding: '4px 10px', fontSize: 'var(--text-xs)', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                      onClick={() => {
                        const updated = (settings.payment_templates || defaultPaymentTemplates).filter(t => t.id !== tpl.id);
                        setSettings(prev => ({ ...prev, payment_templates: updated }));
                        toast.success(`Deleted "${tpl.name}".`);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <button 
            type="button" 
            onClick={fetchSettings}
            className={styles.cancelBtn}
            disabled={saving}
          >
            Reset Form
          </button>
          <button 
            type="submit" 
            disabled={saving} 
            className={styles.saveButton}
          >
            {saving ? 'Saving Changes...' : 'Save Financial Settings'}
          </button>
        </div>
      </form>

      {/* Clean Create/Edit Template Modal */}
      {showTemplateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', boxShadow: 'var(--shadow-xl)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--color-text)' }}>
                {editingTemplate ? 'Edit Payment Template' : 'Create Payment Schedule Template'}
              </h3>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Quick Presets Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Presets:</span>
              <button
                type="button"
                className={styles.matrixBtn}
                style={{ padding: '3px 8px', fontSize: 'var(--text-xs)' }}
                onClick={() => {
                  setTemplateForm(prev => ({
                    ...prev,
                    name: '5-Month Equal Installment Plan (20% x 5)',
                    description: '5 equal monthly payments of 20% across 5 consecutive project months.',
                    milestones: [
                      { name: 'Month 1 - Booking Advance', percentage: 20, stage: 'Booking', offsetDays: 0 },
                      { name: 'Month 2 - Design Finalization', percentage: 20, stage: 'Design', offsetDays: 30 },
                      { name: 'Month 3 - Factory Production Start', percentage: 20, stage: 'Production', offsetDays: 60 },
                      { name: 'Month 4 - On-site Installation', percentage: 20, stage: 'Installation', offsetDays: 90 },
                      { name: 'Month 5 - Final Handover', percentage: 20, stage: 'Handover', offsetDays: 120 }
                    ]
                  }));
                }}
              >
                5-Month Equal (20% x 5)
              </button>
              <button
                type="button"
                className={styles.matrixBtn}
                style={{ padding: '3px 8px', fontSize: 'var(--text-xs)' }}
                onClick={() => {
                  setTemplateForm(prev => ({
                    ...prev,
                    name: 'Standard 3-Stage Milestone (20% - 50% - 30%)',
                    description: '20% booking advance, 50% material dispatch, 30% final handover.',
                    milestones: [
                      { name: 'Stage 1 - Booking Advance', percentage: 20, stage: 'Booking', offsetDays: 0 },
                      { name: 'Stage 2 - Material Dispatch', percentage: 50, stage: 'Material Dispatch', offsetDays: 30 },
                      { name: 'Stage 3 - Final Handover', percentage: 30, stage: 'Handover', offsetDays: 60 }
                    ]
                  }));
                }}
              >
                3-Stage (20-50-30)
              </button>
              <button
                type="button"
                className={styles.matrixBtn}
                style={{ padding: '3px 8px', fontSize: 'var(--text-xs)' }}
                onClick={() => {
                  setTemplateForm(prev => ({
                    ...prev,
                    name: 'Commercial Construction 4-Stage (10% - 40% - 40% - 10%)',
                    description: '10% token, 40% structure, 40% finishing, 10% retention.',
                    milestones: [
                      { name: 'Token Advance', percentage: 10, stage: 'Token', offsetDays: 0 },
                      { name: 'Structure Work', percentage: 40, stage: 'Structure', offsetDays: 30 },
                      { name: 'Interior Finishing', percentage: 40, stage: 'Finishing', offsetDays: 75 },
                      { name: 'Handover & Retention', percentage: 10, stage: 'Retention', offsetDays: 105 }
                    ]
                  }));
                }}
              >
                4-Stage (10-40-40-10)
              </button>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Template Title *</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. 5-Month Equal Installment Plan (20% x 5)"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <input
                type="text"
                value={templateForm.description}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the milestone schedule"
                className={styles.input}
              />
            </div>

            {/* Milestone List Editor */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className={styles.label} style={{ margin: 0 }}>Milestone Stages Breakdown</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    className={styles.matrixBtn}
                    style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
                    onClick={() => {
                      const count = templateForm.milestones?.length || 1;
                      const equalP = Math.floor(100 / count);
                      const remainder = 100 - (equalP * count);
                      const updated = templateForm.milestones.map((m, idx) => ({
                        ...m,
                        percentage: idx === 0 ? equalP + remainder : equalP
                      }));
                      setTemplateForm(prev => ({ ...prev, milestones: updated }));
                    }}
                  >
                    Equalize Split
                  </button>
                  <button
                    type="button"
                    className={styles.matrixBtn}
                    style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
                    onClick={() => {
                      setTemplateForm(prev => ({
                        ...prev,
                        milestones: [
                          ...prev.milestones,
                          { name: `Stage ${prev.milestones.length + 1}`, percentage: 0, stage: 'Execution', offsetDays: (prev.milestones.length) * 30 }
                        ]
                      }));
                    }}
                  >
                    + Add Stage
                  </button>
                </div>
              </div>

              {templateForm.milestones?.map((m, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 'var(--space-2)', alignItems: 'center', background: 'var(--color-surface-2)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)' }}>
                  <input
                    type="text"
                    value={m.name}
                    onChange={(e) => {
                      const updated = [...templateForm.milestones];
                      updated[idx].name = e.target.value;
                      setTemplateForm(prev => ({ ...prev, milestones: updated }));
                    }}
                    placeholder="Stage Name"
                    className={styles.input}
                    style={{ fontSize: 'var(--text-xs)', height: '36px' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      value={m.percentage}
                      onChange={(e) => {
                        const updated = [...templateForm.milestones];
                        updated[idx].percentage = Number(e.target.value);
                        setTemplateForm(prev => ({ ...prev, milestones: updated }));
                      }}
                      placeholder="%"
                      className={styles.input}
                      style={{ fontSize: 'var(--text-xs)', height: '36px' }}
                    />
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>%</span>
                  </div>
                  <input
                    type="number"
                    value={m.offsetDays}
                    onChange={(e) => {
                      const updated = [...templateForm.milestones];
                      updated[idx].offsetDays = Number(e.target.value);
                      setTemplateForm(prev => ({ ...prev, milestones: updated }));
                    }}
                    placeholder="Days"
                    className={styles.input}
                    style={{ fontSize: 'var(--text-xs)', height: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = templateForm.milestones.filter((_, i) => i !== idx);
                      setTemplateForm(prev => ({ ...prev, milestones: updated }));
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px' }}
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Total Percentage Balance Indicator */}
              {(() => {
                const currentTotal = templateForm.milestones?.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0) || 0;
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', marginTop: '4px' }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Total Percentage:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: currentTotal === 100 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {currentTotal}% / 100%
                      </span>
                      {currentTotal !== 100 && (
                        <button
                          type="button"
                          className={styles.matrixBtn}
                          style={{ padding: '1px 6px', fontSize: '10px', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                          onClick={() => {
                            const diff = 100 - currentTotal;
                            if (templateForm.milestones?.length > 0) {
                              const updated = [...templateForm.milestones];
                              const lastIdx = updated.length - 1;
                              updated[lastIdx].percentage = Math.max(0, updated[lastIdx].percentage + diff);
                              setTemplateForm(prev => ({ ...prev, milestones: updated }));
                            }
                          }}
                        >
                          Fix to 100%
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowTemplateModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.saveButton}
                style={{ width: 'auto' }}
                onClick={async () => {
                  if (!templateForm.name.trim()) {
                    toast.error('Please enter a template title.');
                    return;
                  }
                  const totalP = templateForm.milestones?.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);
                  if (totalP !== 100) {
                    toast.error(`Total percentage must equal 100%. Current total: ${totalP}%`);
                    return;
                  }

                  let currentTemplates = [...(settings.payment_templates || defaultPaymentTemplates)];
                  if (editingTemplate) {
                    currentTemplates = currentTemplates.map(t => t.id === editingTemplate ? templateForm : t);
                  } else {
                    currentTemplates.push(templateForm);
                  }

                  const updatedSettings = { ...settings, payment_templates: currentTemplates };
                  setSettings(updatedSettings);
                  setShowTemplateModal(false);

                  try {
                    await api.patch('/config/tenant-settings', updatedSettings);
                    toast.success(`Template "${templateForm.name}" saved & persisted!`);
                  } catch (err) {
                    console.error('Failed to auto-save template:', err);
                    toast.success(`Template "${templateForm.name}" added to list. Remember to click "Save Financial Settings".`);
                  }
                }}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
