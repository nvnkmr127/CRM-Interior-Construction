/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react'
import layoutStyles from './ConfigLayout.module.css'
import styles from './ApiKeysManager.module.css'
import { Button, Badge, Modal, DataTable, Input } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import { configApi } from '../../api/config'

export default function ApiKeysManager() {
  const [keys, setKeys] = useState([])
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [newKeyData, setNewKeyData] = useState(null) // stores the revealed key

  const [formData, setFormData] = useState({
    name: '',
    scopes: new Set(),
    rateLimit: 60,
    expires: ''
  })
  const [doneCountdown, setDoneCountdown] = useState(0)
  const [isKeyRevealed, setIsKeyRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const toast = useToast()

  useEffect(() => {
    fetchKeys()
  }, [])

  const fetchKeys = async () => {
    try {
      const data = await configApi.getApiKeys()
      const formatted = data.map(k => ({
        id: k.id,
        name: k.name,
        prefix: k.key_prefix,
        scopes: k.scopes || [],
        lastUsed: k.last_used_at,
        expires: k.expires_at,
        status: k.is_active ? 'active' : 'revoked'
      }))
      setKeys(formatted)
    } catch (err) {
      toast.error('Failed to load API keys')
    }
  }

  useEffect(() => {
    let timer
    if (newKeyData && doneCountdown > 0) {
      timer = setTimeout(() => setDoneCountdown(c => c - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [newKeyData, doneCountdown])

  const toggleScope = (scope) => {
    const next = new Set(formData.scopes)
    if (next.has(scope)) next.delete(scope)
    else next.add(scope)
    setFormData({ ...formData, scopes: next })
  }

  const handleGenerate = async () => {
    if (!formData.name) return toast.error('Key name is required')
    
    try {
      const payload = {
        name: formData.name,
        scopes: Array.from(formData.scopes),
        rateLimitRpm: formData.rateLimit,
        expiresAt: formData.expires || null
      }
      
      const res = await configApi.createApiKey(payload)
      
      setIsGenerateOpen(false)
      setFormData({ name: '', scopes: new Set(), rateLimit: 60, expires: '' })
      setNewKeyData(res.rawKey)
      setIsKeyRevealed(false)
      setCopied(false)
      setDoneCountdown(5)
      
      fetchKeys()
    } catch (err) {
      toast.error('Failed to generate API key')
    }
  }

  const confirmRevoke = async () => {
    if (!revokeTarget) return
    try {
      await configApi.revokeApiKey(revokeTarget.id)
      setKeys(keys.filter(k => k.id !== revokeTarget.id))
      toast.success('API Key revoked')
    } catch (err) {
      toast.error('Failed to revoke API key')
    } finally {
      setRevokeTarget(null)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(newKeyData)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const columns = [
    { key: 'name', label: 'Name', render: (k) => <strong style={{color:'var(--color-text)'}}>{k.name}</strong> },
    { key: 'prefix', label: 'Prefix', render: (k) => <span className={styles.prefix}>{k.prefix}_xxxxxx</span> },
    { 
      key: 'scopes', label: 'Scopes', 
      render: (k) => (
        <div className={styles.scopes}>
          {k.scopes.map(s => <Badge key={s} variant="neutral">{s}</Badge>)}
        </div>
      ) 
    },
    { 
      key: 'lastUsed', label: 'Last Used', 
      render: (k) => k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : <span style={{color:'var(--color-text-muted)'}}>Never</span> 
    },
    { 
      key: 'expires', label: 'Expires', 
      render: (k) => {
        if (!k.expires) return 'Never'
        const days = Math.ceil((new Date(k.expires) - new Date()) / 86400000)
        return <span className={days <= 7 ? styles.expiring : ''}>{new Date(k.expires).toLocaleDateString()}</span>
      }
    },
    { key: 'status', label: 'Status', render: (k) => <Badge variant={k.status === 'active' ? 'success' : 'neutral'}>{k.status}</Badge> },
    { 
      key: 'actions', label: '', align: 'right',
      render: (k) => (
        <Button variant="ghost" size="sm" style={{color:'var(--color-danger)'}} onClick={() => setRevokeTarget(k)}>
          Revoke
        </Button>
      )
    }
  ]

  return (
    <div className={layoutStyles.configSection}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <h2 className={layoutStyles.sectionTitle}>API Keys</h2>
          <p className={layoutStyles.sectionDesc}>Use API keys to connect external tools and automations.</p>
        </div>
        <Button variant="primary" onClick={() => setIsGenerateOpen(true)}>+ Generate Key</Button>
      </div>

      <DataTable columns={columns} data={keys} />

      {/* Generate Modal */}
      <Modal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        title="Generate API Key"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsGenerateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleGenerate}>Generate Key</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Input 
            label="Name" 
            placeholder="e.g. Zapier Integration" 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            required 
          />

          <div>
            <div className={styles.scopeTitle} style={{marginBottom: 8}}>Scopes</div>
            <div className={styles.scopesGrid}>
              <div className={styles.scopeGroup}>
                <div className={styles.scopeTitle} style={{color:'var(--color-text-secondary)'}}>Full Access</div>
                <label className={styles.checkboxRow}><input type="checkbox" checked={formData.scopes.has('read')} onChange={() => toggleScope('read')} /> Read</label>
                <label className={styles.checkboxRow}><input type="checkbox" checked={formData.scopes.has('write')} onChange={() => toggleScope('write')} /> Write</label>
              </div>
              <div className={styles.scopeGroup}>
                <div className={styles.scopeTitle} style={{color:'var(--color-text-secondary)'}}>Leads</div>
                <label className={styles.checkboxRow}><input type="checkbox" checked={formData.scopes.has('leads:read')} onChange={() => toggleScope('leads:read')} /> leads:read</label>
                <label className={styles.checkboxRow}><input type="checkbox" checked={formData.scopes.has('leads:write')} onChange={() => toggleScope('leads:write')} /> leads:write</label>
              </div>
              <div className={styles.scopeGroup}>
                <div className={styles.scopeTitle} style={{color:'var(--color-text-secondary)'}}>Projects</div>
                <label className={styles.checkboxRow}><input type="checkbox" checked={formData.scopes.has('projects:read')} onChange={() => toggleScope('projects:read')} /> projects:read</label>
                <label className={styles.checkboxRow}><input type="checkbox" checked={formData.scopes.has('projects:write')} onChange={() => toggleScope('projects:write')} /> projects:write</label>
              </div>
              <div className={styles.scopeGroup}>
                <div className={styles.scopeTitle} style={{color:'var(--color-text-secondary)'}}>Other</div>
                <label className={styles.checkboxRow}><input type="checkbox" checked={formData.scopes.has('config:manage')} onChange={() => toggleScope('config:manage')} /> config:manage</label>
                <label className={styles.checkboxRow}><input type="checkbox" checked={formData.scopes.has('webhooks:manage')} onChange={() => toggleScope('webhooks:manage')} /> webhooks:manage</label>
              </div>
            </div>
          </div>

          <div>
            <div className={styles.scopeTitle} style={{marginBottom: 8}}>Rate Limit (RPM)</div>
            <div className={styles.sliderRow}>
              <input 
                type="range" 
                min="10" max="1000" step="10" 
                className={styles.slider}
                value={formData.rateLimit}
                onChange={e => setFormData({...formData, rateLimit: parseInt(e.target.value)})}
              />
              <div className={styles.rpmValue}>{formData.rateLimit}</div>
            </div>
          </div>

          <Input 
            label="Expires (optional)" 
            type="date" 
            value={formData.expires} 
            onChange={e => setFormData({...formData, expires: e.target.value})} 
          />
        </div>
      </Modal>

      {/* Reveal Modal */}
      <Modal
        isOpen={!!newKeyData}
        closeOnBackdrop={false}
        onClose={() => {}} // forces using Done button
        title="API Key Generated"
        footer={
          <Button 
            variant="primary" 
            disabled={doneCountdown > 0}
            onClick={() => setNewKeyData(null)}
          >
            {doneCountdown > 0 ? `Done (${doneCountdown})` : 'Done'}
          </Button>
        }
      >
        <div className={styles.revealWarning}>
          <span style={{fontSize:18}}>⚠</span>
          This is the only time you will see this key. Please copy it now.
        </div>
        
        <div className={styles.keyDisplay}>
          <div className={`${styles.keyText} ${!isKeyRevealed ? styles.blurred : ''}`}>
            {newKeyData}
          </div>
          
          {!isKeyRevealed && (
            <div className={styles.revealOverlay} onClick={() => setIsKeyRevealed(true)}>
              <Button variant="secondary">Click to reveal</Button>
            </div>
          )}
          
          {isKeyRevealed && (
            <button className={styles.copyBtn} onClick={copyToClipboard} aria-label="Copy key">
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          )}
        </div>
      </Modal>

      {/* Revoke Modal */}
      <Modal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke API Key"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmRevoke}>Revoke Key</Button>
          </>
        }
      >
        <p>Are you sure you want to revoke <strong>{revokeTarget?.name}</strong>? Any integrations using this key will immediately stop working.</p>
      </Modal>
    </div>
  )
}
