/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import layoutStyles from './ConfigLayout.module.css';
import styles from './WebhooksManager.module.css';
import { Button, Badge, Input, Select } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import { configApi } from '../../api/config';
import api from '../../api/axios';

const PROVIDER_PRESETS = {
  custom: {
    label: 'Custom Webhook / Form',
    providerName: 'Website',
    mappings: [
      { sourceField: 'name', targetField: 'name', transform: 'trim' },
      { sourceField: 'phone', targetField: 'phone', transform: 'trim' },
      { sourceField: 'email', targetField: 'email', transform: 'lowercase' },
      { sourceField: 'city', targetField: 'city', transform: 'trim' },
      { sourceField: 'project_type', targetField: 'project_type', transform: 'trim' },
      { sourceField: 'budget', targetField: 'budget', transform: 'trim' }
    ],
    dedupField: 'phone'
  },
  zapier: {
    label: 'Zapier Lead Ingest',
    providerName: 'Website',
    mappings: [
      { sourceField: 'full_name', targetField: 'name', transform: 'trim' },
      { sourceField: 'contact_phone', targetField: 'phone', transform: 'trim' },
      { sourceField: 'contact_email', targetField: 'email', transform: 'lowercase' },
      { sourceField: 'location', targetField: 'city', transform: 'trim' },
      { sourceField: 'service_required', targetField: 'project_type', transform: 'trim' },
      { sourceField: 'estimated_budget', targetField: 'budget', transform: 'trim' }
    ],
    dedupField: 'phone'
  },
  facebook: {
    label: 'Facebook / Meta Leads',
    providerName: 'Facebook',
    mappings: [
      { sourceField: 'name', targetField: 'name', transform: 'trim' },
      { sourceField: 'phone', targetField: 'phone', transform: 'trim' },
      { sourceField: 'email', targetField: 'email', transform: 'lowercase' },
      { sourceField: 'city', targetField: 'city', transform: 'trim' },
      { sourceField: 'property_type', targetField: 'project_type', transform: 'trim' }
    ],
    dedupField: 'phone'
  },
  indiamart: {
    label: 'IndiaMart Direct Ingest',
    providerName: 'IndiaMART',
    mappings: [
      { sourceField: 'SENDER_NAME', targetField: 'name', transform: 'trim' },
      { sourceField: 'SENDER_MOBILE', targetField: 'phone', transform: 'trim' },
      { sourceField: 'SENDER_EMAIL', targetField: 'email', transform: 'lowercase' },
      { sourceField: 'GLUSR_USR_CITY', targetField: 'city', transform: 'trim' },
      { sourceField: 'QUERY_MODID', targetField: 'project_type', transform: 'trim' },
      { sourceField: 'ENQ_MESSAGE', targetField: 'scope', transform: 'trim' }
    ],
    dedupField: 'phone'
  }
};

const TARGET_FIELDS = [
  { value: 'name', label: 'Full Name (Required)' },
  { value: 'phone', label: 'Phone Number (Required)' },
  { value: 'email', label: 'Email Address' },
  { value: 'city', label: 'City' },
  { value: 'project_type', label: 'Project Type' },
  { value: 'budget', label: 'Budget' },
  { value: 'scope', label: 'Scope of Work / Description' },
  { value: 'address', label: 'Property Address' },
  { value: 'custom_fields.requirements', label: 'Custom: Requirements' },
  { value: 'custom_fields.preferred_style', label: 'Custom: Preferred Style' },
  { value: 'custom_fields.property_size_sqft', label: 'Custom: Property Size (sqft)' },
  { value: 'custom_fields.possession_timeline', label: 'Custom: Possession Timeline' }
];

export default function InboundSourceEditor({ source, onSave, onCancel }) {
  const [formData, setFormData] = useState(() => {
    let parsedMappings = [];
    if (source?.field_mapping) {
      parsedMappings = typeof source.field_mapping === 'string' 
        ? JSON.parse(source.field_mapping) 
        : source.field_mapping;
    } else {
      parsedMappings = PROVIDER_PRESETS.custom.mappings;
    }

    return {
      id: source?.id || null,
      name: source?.name || '',
      source_key: source?.source_key || '',
      secret: source?.secret || '',
      provider_name: source?.provider_name || 'Website',
      dedup_field: source?.dedup_field || 'phone',
      default_stage_id: source?.default_stage_id || '',
      default_assignee_id: source?.default_assignee_id || '',
      is_active: source?.is_active !== undefined ? source.is_active : true,
      field_mapping: parsedMappings
    };
  });

  const [leadStages, setLeadStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const toast = useToast();

  useEffect(() => {
    configApi.getLeadStages().then(stages => {
      setLeadStages(stages || []);
    }).catch(console.error);

    api.get('/users?limit=100').then(res => {
      setUsers(res.data?.data || res.data || []);
    }).catch(console.error);
  }, []);

  const handleApplyPreset = (presetKey) => {
    const preset = PROVIDER_PRESETS[presetKey];
    if (preset) {
      setFormData(prev => ({
        ...prev,
        provider_name: preset.providerName,
        field_mapping: [...preset.mappings],
        dedup_field: preset.dedupField
      }));
      toast.success(`Applied ${preset.label} preset!`);
    }
  };

  const generateSecret = () => {
    const newSecret = Array.from(window.crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    setFormData(prev => ({ ...prev, secret: newSecret }));
    toast.success('Generated new HMAC Secret!');
  };

  const handleAddMapping = () => {
    setFormData(prev => ({
      ...prev,
      field_mapping: [
        ...prev.field_mapping,
        { sourceField: '', targetField: 'name', transform: 'trim' }
      ]
    }));
  };

  const handleUpdateMapping = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.field_mapping];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, field_mapping: updated };
    });
  };

  const handleRemoveMapping = (index) => {
    setFormData(prev => ({
      ...prev,
      field_mapping: prev.field_mapping.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) return toast.error('Source Name is required');

    // Filter valid mappings
    const validMappings = formData.field_mapping.filter(m => m.sourceField && m.sourceField.trim());
    if (validMappings.length === 0) {
      return toast.error('Please configure at least one field mapping');
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        source_key: formData.source_key.trim() || undefined,
        secret: formData.secret.trim() || null,
        provider_name: formData.provider_name.trim() || 'Website',
        dedup_field: formData.dedup_field || null,
        default_stage_id: formData.default_stage_id || null,
        default_assignee_id: formData.default_assignee_id || null,
        is_active: formData.is_active,
        field_mapping: validMappings
      };

      if (formData.id) {
        await configApi.updateWebhookSource(formData.id, payload);
        toast.success('Inbound Webhook Source updated successfully');
      } else {
        await configApi.createWebhookSource(payload);
        toast.success('Inbound Webhook Source created successfully');
      }

      if (onSave) onSave();
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to save webhook source';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000';
  const previewUrl = `${baseUrl}/api/webhooks/inbound/${formData.source_key || '<source_key>'}`;

  return (
    <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className={layoutStyles.sectionHeader} style={{ flexShrink: 0, margin: 0, padding: '20px 32px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <Button variant="ghost" size="sm" onClick={onCancel} style={{ padding: '4px 8px' }}>← Back</Button>
            <h2 className={layoutStyles.sectionTitle} style={{ margin: 0 }}>
              {formData.id ? 'Edit Inbound Webhook Source' : 'New Inbound Webhook Source'}
            </h2>
            {formData.id && (
              <Badge variant={formData.is_active ? 'success' : 'neutral'}>
                {formData.is_active ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>
          <p className={layoutStyles.sectionDesc} style={{ marginLeft: 60, margin: 0 }}>
            Configure incoming lead webhooks from website forms, Zapier, Facebook Lead Ads, IndiaMart, and third-party portals.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Inbound Source'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 32, alignItems: 'flex-start' }}>
          
          {/* Left Column: Config */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Presets Bar */}
            <div style={{ background: 'var(--color-surface)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Quick Provider Presets</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Auto-fill recommended field mappings</span>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {Object.entries(PROVIDER_PRESETS).map(([k, p]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleApplyPreset(k)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface-2, #f8fafc)',
                      color: 'var(--color-text)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 500,
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>⚡</span> {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Source Information */}
            <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 20 }}>Source Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Input
                  label="Source Name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. Website Contact Form, Zapier Lead Capture"
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 6 }}>Lead Source Tag</label>
                    <Select
                      options={[
                        { value: 'Website', label: 'Website' },
                        { value: 'Facebook', label: 'Facebook' },
                        { value: 'IndiaMART', label: 'IndiaMART' },
                        { value: 'Referral', label: 'Referral' },
                        { value: 'Direct', label: 'Direct' },
                        { value: 'Other', label: 'Other' }
                      ]}
                      value={formData.provider_name}
                      onChange={v => setFormData({ ...formData, provider_name: v })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 6 }}>Deduplication Rule</label>
                    <Select
                      options={[
                        { value: 'phone', label: 'Match by Phone Number (Recommended)' },
                        { value: 'email', label: 'Match by Email Address' },
                        { value: '', label: 'None (Always create new lead)' }
                      ]}
                      value={formData.dedup_field || ''}
                      onChange={v => setFormData({ ...formData, dedup_field: v })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Security & Endpoint */}
            <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 20 }}>Endpoint & Security</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 6 }}>Inbound Endpoint URL</label>
                  <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid var(--color-border)', fontFamily: 'monospace', fontSize: '13px', color: 'var(--color-primary)' }}>
                    {previewUrl}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 4 }}>External webhooks must send HTTP POST requests to this URL.</p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 6 }}>
                    Webhook Secret (HMAC-SHA256 Signature Verification)
                  </label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <Input
                        value={formData.secret}
                        onChange={e => setFormData({ ...formData, secret: e.target.value })}
                        placeholder="Leave blank for open/unprotected webhooks"
                      />
                    </div>
                    <Button variant="secondary" onClick={generateSecret}>Generate Secret</Button>
                    {formData.secret && (
                      <Button variant="ghost" onClick={() => setFormData({ ...formData, secret: '' })}>Clear</Button>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 6 }}>
                    {formData.secret 
                      ? '🔒 Active: Incoming requests must include header "x-hub-signature-256: sha256=<hex_digest>".' 
                      : '🔓 Inactive: Requests without signatures will be accepted directly.'}
                  </p>
                </div>

              </div>
            </div>

            {/* Field Mappings */}
            <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Payload Field Mappings</h3>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                    Map fields from your incoming JSON payload to CRM Lead fields (dot notation like <code>contact.email</code> is supported).
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleAddMapping}>+ Add Mapping</Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 120px 40px', gap: 12, paddingBottom: 6, borderBottom: '1px solid var(--color-border)', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  <div>INCOMING JSON FIELD</div>
                  <div>CRM LEAD FIELD</div>
                  <div>TRANSFORM</div>
                  <div></div>
                </div>

                {formData.field_mapping.map((m, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 120px 40px', gap: 12, alignItems: 'center' }}>
                    <Input
                      placeholder="e.g. phone_number or user.email"
                      value={m.sourceField}
                      onChange={e => handleUpdateMapping(idx, 'sourceField', e.target.value)}
                    />

                    <Select
                      options={TARGET_FIELDS}
                      value={m.targetField}
                      onChange={v => handleUpdateMapping(idx, 'targetField', v)}
                    />

                    <Select
                      options={[
                        { value: '', label: 'None' },
                        { value: 'trim', label: 'Trim' },
                        { value: 'lowercase', label: 'Lowercase' },
                        { value: 'uppercase', label: 'Uppercase' }
                      ]}
                      value={m.transform || ''}
                      onChange={v => handleUpdateMapping(idx, 'transform', v)}
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMapping(idx)}
                      style={{ color: 'var(--color-danger)', padding: '6px' }}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Routing & Lead Defaults */}
          <div style={{ flex: 1, background: '#fff', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 20 }}>Lead Routing Defaults</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 6 }}>Default Lead Stage</label>
                <Select
                  options={[
                    { value: '', label: 'Auto (First Stage)' },
                    ...leadStages.map(s => ({ value: s.id, label: s.name }))
                  ]}
                  value={formData.default_stage_id || ''}
                  onChange={v => setFormData({ ...formData, default_stage_id: v })}
                />
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Incoming leads without a specific stage will start here.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 6 }}>Default Assignee</label>
                <Select
                  options={[
                    { value: '', label: 'Unassigned (Queue)' },
                    ...users.map(u => ({ value: u.id, label: u.name || u.email }))
                  ]}
                  value={formData.default_assignee_id || ''}
                  onChange={v => setFormData({ ...formData, default_assignee_id: v })}
                />
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Optionally assign newly ingested leads to a team member.
                </p>
              </div>

              <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 'var(--text-sm)', cursor: 'pointer', fontWeight: 500 }}>
                  <div className={`${styles.toggle} ${formData.is_active ? styles.active : ''}`}>
                    <input
                      type="checkbox"
                      style={{ display: 'none' }}
                      checked={formData.is_active}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <div className={styles.toggleHandle} />
                  </div>
                  Enable Inbound Source
                </label>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 8, marginBottom: 0 }}>
                  When disabled, incoming webhooks to this URL will be rejected with HTTP 404.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
