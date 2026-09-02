/* eslint-disable no-unused-vars */
import { useState, useMemo } from 'react';
import { Modal, Button, Badge } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import { configApi } from '../../api/config';

async function computeHmacSha256(secret, message) {
  try {
    const enc = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await window.crypto.subtle.sign(
      'HMAC',
      key,
      enc.encode(message)
    );
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (e) {
    return null;
  }
}

const PRESETS = {
  standard: {
    label: 'Standard Lead',
    payload: {
      name: 'Rajesh Sharma',
      phone: '+919876543210',
      email: 'rajesh.sharma@example.com',
      city: 'Hyderabad',
      project_type: '3BHK Luxury Interior',
      budget: '2500000',
      notes: 'Interested in Italian marble and modular kitchen setup.'
    }
  },
  zapier: {
    label: 'Zapier / Webhook',
    payload: {
      full_name: 'Priya Patel',
      contact_phone: '+919812345678',
      contact_email: 'priya.patel@example.com',
      location: 'Bangalore',
      service_required: 'Full Villa Renovation',
      estimated_budget: '4500000'
    }
  },
  indiamart: {
    label: 'IndiaMart Ingest',
    payload: {
      SENDER_NAME: 'Vikram Malhotra',
      SENDER_MOBILE: '+919876501234',
      SENDER_EMAIL: 'vikram.m@example.com',
      GLUSR_USR_CITY: 'Mumbai',
      QUERY_MODID: 'Complete Commercial Interior',
      ENQ_MESSAGE: 'Requirement for 4000 sq ft office interior in BKC.'
    }
  },
  facebook: {
    label: 'Facebook / Meta Lead',
    payload: {
      lead_id: 'meta_lead_98231',
      form_name: 'Interior Design Consultation 2026',
      name: 'Ananya Roy',
      phone: '+919988776655',
      email: 'ananya.roy@example.com',
      city: 'Delhi NCR',
      property_type: '4BHK Apartment'
    }
  }
};

export default function InboundWebhookTesterModal({ isOpen, onClose, source, sources = [], onLeadCreated }) {
  const [selectedSourceId, setSelectedSourceId] = useState(() => source?.id || (sources[0]?.id || 'default'));
  const [activeTab, setActiveTab] = useState('tester');
  const [snippetLanguage, setSnippetLanguage] = useState('curl');
  const [payloadText, setPayloadText] = useState(() => JSON.stringify(PRESETS.standard.payload, null, 2));
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulationError, setSimulationError] = useState(null);

  const [isSending, setIsSending] = useState(false);
  const [liveResult, setLiveResult] = useState(null);
  const [liveError, setLiveError] = useState(null);

  const toast = useToast();

  const currentSource = useMemo(() => {
    if (source) return source;
    const found = sources.find(s => s.id === selectedSourceId);
    if (found) return found;
    if (sources.length > 0) return sources[0];
    return {
      id: 'default',
      name: 'Website Contact Form Lead Ingest',
      source_key: 'default_website_leads',
      provider_name: 'Website',
      field_mapping: [
        { sourceField: 'name', targetField: 'name', transform: 'trim' },
        { sourceField: 'phone', targetField: 'phone', transform: 'trim' },
        { sourceField: 'email', targetField: 'email', transform: 'lowercase' },
        { sourceField: 'city', targetField: 'city', transform: 'trim' },
        { sourceField: 'project_type', targetField: 'project_type', transform: 'trim' },
        { sourceField: 'budget', targetField: 'budget', transform: 'trim' }
      ]
    };
  }, [source, sources, selectedSourceId]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000';
  const inboundUrl = currentSource ? `${baseUrl}/api/webhooks/inbound/${currentSource.source_key}` : '';

  const handlePresetSelect = (presetKey) => {
    if (PRESETS[presetKey]) {
      setPayloadText(JSON.stringify(PRESETS[presetKey].payload, null, 2));
      setSimulationResult(null);
      setLiveResult(null);
      setSimulationError(null);
      setLiveError(null);
    }
  };

  const handleSimulate = async () => {
    let parsed;
    try {
      parsed = JSON.parse(payloadText);
    } catch (e) {
      toast.error('Invalid JSON payload: ' + e.message);
      return;
    }

    setIsSimulating(true);
    setSimulationResult(null);
    setSimulationError(null);

    try {
      if (currentSource.id && currentSource.id !== 'default') {
        const res = await configApi.testWebhookSourceMapping(currentSource.id, parsed);
        setSimulationResult(res);
      } else {
        // Local simulation fallback
        const mappings = currentSource.field_mapping || [];
        const result = { source: currentSource.provider_name || 'Website', custom_fields: {} };
        for (const m of mappings) {
          if (!m.sourceField || !m.targetField) continue;
          let val = parsed[m.sourceField];
          if (val !== undefined && val !== null) {
            if (m.transform === 'trim' && typeof val === 'string') val = val.trim();
            if (m.transform === 'lowercase' && typeof val === 'string') val = val.toLowerCase();
            if (m.transform === 'uppercase' && typeof val === 'string') val = val.toUpperCase();
            if (m.targetField.startsWith('custom_fields.')) {
              const k = m.targetField.split('.')[1];
              result.custom_fields[k] = val;
            } else {
              result[m.targetField] = val;
            }
          }
        }
        setSimulationResult(result);
      }
      toast.success('Field mapping simulation succeeded!');
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Simulation failed';
      setSimulationError(msg);
      toast.error('Simulation error: ' + msg);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSendLive = async () => {
    let parsed;
    try {
      parsed = JSON.parse(payloadText);
    } catch (e) {
      toast.error('Invalid JSON payload: ' + e.message);
      return;
    }

    setIsSending(true);
    setLiveResult(null);
    setLiveError(null);

    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      // If source has secret, calculate HMAC-SHA256 signature
      if (currentSource.secret) {
        const rawString = JSON.stringify(parsed);
        const hash = await computeHmacSha256(currentSource.secret, rawString);
        if (hash) {
          headers['x-hub-signature-256'] = `sha256=${hash}`;
        }
      }

      const res = await configApi.sendInboundWebhook(currentSource.source_key, parsed, headers);
      setLiveResult(res);
      toast.success(`Live lead created successfully! Lead ID: ${res.leadId}`);
      if (onLeadCreated) onLeadCreated(res.leadId);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to dispatch inbound webhook';
      setLiveError(msg);
      toast.error('Inbound Error: ' + msg);
    } finally {
      setIsSending(false);
    }
  };

  const codeSnippets = useMemo(() => {
    if (!currentSource) return {};
    const formattedJson = payloadText.trim();
    const headersStr = currentSource.secret 
      ? `-H "Content-Type: application/json" \\\n  -H "x-hub-signature-256: sha256=<HMAC_SHA256_HEX>"`
      : `-H "Content-Type: application/json"`;

    return {
      curl: `curl -X POST "${inboundUrl}" \\\n  ${headersStr} \\\n  -d '${formattedJson.replace(/'/g, "'\\''")}'`,
      fetch: `// JavaScript (Fetch / Node.js)\nconst payload = ${formattedJson};\n\nfetch("${inboundUrl}", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json"${currentSource.secret ? ',\n    "x-hub-signature-256": "sha256=<HMAC_SHA256_HEX>"' : ''}\n  },\n  body: JSON.stringify(payload)\n})\n.then(res => res.json())\n.then(data => console.log("Lead created:", data))\n.catch(err => console.error("Webhook error:", err));`,
      python: `# Python (requests)\nimport requests\n\nurl = "${inboundUrl}"\npayload = ${formattedJson}\nheaders = {\n    "Content-Type": "application/json"${currentSource.secret ? ',\n    "x-hub-signature-256": "sha256=<HMAC_SHA256_HEX>"' : ''}\n}\n\nresponse = requests.post(url, json=payload, headers=headers)\nprint(response.status_code, response.json())`,
      powershell: `# PowerShell\n$headers = @{\n    "Content-Type" = "application/json"${currentSource.secret ? '\n    "x-hub-signature-256" = "sha256=<HMAC_SHA256_HEX>"' : ''}\n}\n$body = @'\n${formattedJson}\n'@\n\n$response = Invoke-RestMethod -Uri "${inboundUrl}" \\\n  -Method POST \\\n  -Headers $headers \\\n  -Body $body\n\n$response | ConvertTo-Json`
    };
  }, [inboundUrl, payloadText, currentSource]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Inbound Webhook Live Tester: ${currentSource?.name || 'Lead Ingestion'}`}
      width={880}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Target Source: <code style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{currentSource?.source_key}</code>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Source Selector (if multiple sources exist or testing globally) */}
        {sources.length > 1 && !source && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-surface-2, #f8fafc)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Select Inbound Source:</span>
            <select
              value={selectedSourceId}
              onChange={e => setSelectedSourceId(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm, 6px)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: '13px'
              }}
            >
              {sources.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.provider_name || 'Website'} — {s.source_key})</option>
              ))}
            </select>
          </div>
        )}

        {/* URL Banner */}
        <div style={{ background: 'var(--color-surface-2, #f1f5f9)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Inbound Endpoint URL</span>
            <span style={{ fontSize: '11px', fontWeight: 500, color: currentSource?.secret ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
              {currentSource?.secret ? '🔒 HMAC Signature Protected' : '🔓 Public (No signature required)'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: '13px', background: 'var(--color-surface)', padding: '6px 10px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--color-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text)' }}>
              {inboundUrl}
            </code>
            <Button variant="secondary" size="sm" onClick={() => copyToClipboard(inboundUrl, 'Endpoint URL')}>Copy URL</Button>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
          <button
            type="button"
            onClick={() => setActiveTab('tester')}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: activeTab === 'tester' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'tester' ? '#ffffff' : 'var(--color-text)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            ⚡ Live Test & Simulator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('snippets')}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: activeTab === 'snippets' ? 'var(--color-primary)' : 'transparent',
              color: activeTab === 'snippets' ? '#ffffff' : 'var(--color-text)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            🔌 Ready-to-Use Code Snippets
          </button>
        </div>

        {activeTab === 'tester' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
            {/* Left: Input Payload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>1. Sample Request Body (JSON)</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Object.entries(PRESETS).map(([k, p]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handlePresetSelect(k)}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        background: '#f8fafc',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={12}
                style={{
                  width: '100%',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  padding: 12,
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                  background: '#f8fafc',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSimulate}
                  disabled={isSimulating}
                  style={{ flex: 1 }}
                >
                  {isSimulating ? 'Simulating...' : '🔍 Dry Run Mapping'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSendLive}
                  disabled={isSending}
                  style={{ flex: 1 }}
                >
                  {isSending ? 'Sending Webhook...' : '🚀 Send Live Inbound'}
                </Button>
              </div>
            </div>

            {/* Right: Output / Results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>2. Execution Result & CRM Preview</span>

              {simulationResult && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Badge variant="success">✓ Dry Run Mapping Success</Badge>
                    <span style={{ fontSize: '11px', color: '#16a34a' }}>No DB Changes Made</span>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Mapped CRM Lead Object:</div>
                  <pre style={{ margin: 0, fontSize: '11px', background: '#fff', padding: 8, borderRadius: 4, border: '1px solid #dcfce7', maxHeight: 150, overflowY: 'auto' }}>
                    {JSON.stringify(simulationResult, null, 2)}
                  </pre>
                </div>
              )}

              {liveResult && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Badge variant="success">✓ Live Lead Ingested (200 OK)</Badge>
                    <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>Lead #{liveResult.leadId?.slice(0, 8)}</span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a' }}>
                    Successfully created / updated in CRM leads database.
                  </p>
                  <pre style={{ margin: 0, fontSize: '11px', background: '#fff', padding: 8, borderRadius: 4, border: '1px solid #dbeafe', maxHeight: 120, overflowY: 'auto' }}>
                    {JSON.stringify(liveResult, null, 2)}
                  </pre>
                </div>
              )}

              {(simulationError || liveError) && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12 }}>
                  <Badge variant="danger">Error</Badge>
                  <pre style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#991b1b', whiteSpace: 'pre-wrap' }}>
                    {simulationError || liveError}
                  </pre>
                </div>
              )}

              {!simulationResult && !liveResult && !simulationError && !liveError && (
                <div style={{ height: '100%', minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px dashed var(--color-border)', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', marginBottom: 8 }}>📥</div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>Ready to Test</div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '4px 0 0 0', maxWidth: 260 }}>
                    Click <strong>Dry Run Mapping</strong> to inspect how the payload is parsed, or <strong>Send Live</strong> to create a test lead in the CRM.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'snippets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['curl', 'fetch', 'python', 'powershell'].map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSnippetLanguage(lang)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    fontSize: '12px',
                    border: '1px solid var(--color-border)',
                    background: snippetLanguage === lang ? 'var(--color-primary)' : '#fff',
                    color: snippetLanguage === lang ? '#fff' : 'var(--color-text)',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    fontWeight: 600
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative' }}>
              <pre style={{ margin: 0, padding: 16, background: '#0f172a', color: '#f8fafc', borderRadius: 8, fontSize: '12px', overflowX: 'auto', lineHeight: 1.5 }}>
                {codeSnippets[snippetLanguage]}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copyToClipboard(codeSnippets[snippetLanguage], snippetLanguage.toUpperCase())}
                style={{ position: 'absolute', top: 12, right: 12 }}
              >
                Copy Code
              </Button>
            </div>

            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '12px' }}>
              <strong>Integration Note:</strong> When setting up Webhooks in tools like Zapier, Make, IndiaMart, or Facebook Webhooks, choose <code>POST</code> method, select <code>application/json</code> payload type, and paste your Inbound Webhook URL.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
