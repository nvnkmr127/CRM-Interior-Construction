import { useState, useEffect } from 'react'
import styles from './CompanySettingsPage.module.css'
import { useAuth } from '../../store/authContext'
import { useToast } from '../../store/toastContext'
import { useConfirm } from '../../store/confirmContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import api from '../../api/axios'

export default function CompanySettingsPage() {
  usePageTitle('Company Settings')
  useBreadcrumbs([{ label: 'Settings', path: '/settings/profile' }, { label: 'Company Settings' }])

  const { user, updateUser } = useAuth()
  const { confirm } = useConfirm()
  const toast = useToast()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Settings State
  const [companyName, setCompanyName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [accentColour, setAccentColour] = useState('#4f46e5')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('logo', file)

    setUploadingLogo(true)
    try {
      const res = await api.post('/config/tenant-settings/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (res.data?.success) {
        setLogoUrl(res.data.data.logoUrl)
        toast.success('Logo uploaded successfully!')
      }
    } catch (err) {
      toast.error('Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  useEffect(() => {
    fetchCompanySettings()
  }, [])

  const fetchCompanySettings = async () => {
    setLoading(true)
    try {
      const res = await api.get('/config/tenant-settings')
      if (res.data?.success) {
        const data = res.data.data
        setCompanyName(data.companyName || '')
        setLogoUrl(data.logo_url || '')
        setAccentColour(data.accent_colour || '#4f46e5')
        setDescription(data.description || '')
        setAddress(data.address || '')
        setPhone(data.phone || '')
        setEmail(data.email || '')
        setWebsite(data.website || '')
      }
    } catch (err) {
      toast.error('Failed to load company settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!companyName.trim()) {
      toast.error('Company Name is required')
      return
    }

    if (await confirm('Are you sure you want to update the company details? This will update branding globally.')) {
      setSaving(true)
      try {
        const payload = {
          companyName,
          logo_url: logoUrl,
          accent_colour: accentColour,
          description,
          address,
          phone,
          email,
          website
        }

        const res = await api.patch('/config/tenant-settings', payload)
        if (res.data?.success) {
          toast.success('Company settings updated successfully!')
          
          // Update the global user context tenant state to reflect immediate updates
          if (user) {
            const updatedUser = {
              ...user,
              tenant: {
                ...user.tenant,
                name: companyName,
                logoUrl: logoUrl,
                accentColour: accentColour,
                description,
                address,
                phone,
                email,
                website
              }
            }
            updateUser(updatedUser)
          }
        }
      } catch (err) {
        toast.error('Failed to save company settings')
      } finally {
        setSaving(false)
      }
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <p>Loading company settings...</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        
        {/* Settings Form */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>Company Details</div>
          <div className={styles.cardDesc}>Configure public branding details, address, and descriptions for your company.</div>

          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Company Name *</label>
              <input 
                type="text" 
                className={styles.input} 
                value={companyName} 
                onChange={e => setCompanyName(e.target.value)} 
                required 
                placeholder="e.g. Acme Interior Designs"
              />
            </div>

            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Logo</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input 
                    type="url" 
                    className={styles.input} 
                    value={logoUrl} 
                    onChange={e => setLogoUrl(e.target.value)} 
                    placeholder="https://example.com/logo.png"
                    style={{ flex: 1 }}
                  />
                  <label style={{ 
                    background: 'var(--color-bg-alt, #f3f4f6)',
                    border: '1px solid var(--color-border)', 
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 16px',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    color: 'var(--color-text)'
                  }}>
                    {uploadingLogo ? 'Uploading...' : 'Upload File'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoUpload} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                  {logoUrl && (
                    <button 
                      type="button"
                      onClick={() => setLogoUrl('')}
                      style={{
                        background: 'var(--color-danger-bg, #fee2e2)',
                        border: '1px solid var(--color-danger, #ef4444)', 
                        borderRadius: 'var(--radius-md)',
                        padding: '8px 16px',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        color: 'var(--color-danger, #b91c1c)'
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Accent Colour</label>
                <div className={styles.colorPickerContainer}>
                  <input 
                    type="color" 
                    className={styles.colorInput} 
                    value={accentColour} 
                    onChange={e => setAccentColour(e.target.value)} 
                  />
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={accentColour} 
                    onChange={e => setAccentColour(e.target.value)} 
                    placeholder="#4f46e5"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Description</label>
              <textarea 
                className={`${styles.input} ${styles.textarea}`} 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Brief summary or tagline about your company..."
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Office Address</label>
              <input 
                type="text" 
                className={styles.input} 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                placeholder="123 Main St, Design District"
              />
            </div>

            <div className={styles.inputRow}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Phone Number</label>
                <input 
                  type="tel" 
                  className={styles.input} 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="+1 (555) 019-2834"
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Email Address</label>
                <input 
                  type="email" 
                  className={styles.input} 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="contact@acme.com"
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Website URL</label>
              <input 
                type="url" 
                className={styles.input} 
                value={website} 
                onChange={e => setWebsite(e.target.value)} 
                placeholder="https://www.acme.com"
              />
            </div>

            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save Branding Details'}
            </button>
          </form>
        </div>

        {/* Live Preview Panel */}
        <div className={styles.card} style={{ height: 'fit-content' }}>
          <div className={styles.cardHeader}>Branding Preview</div>
          <div className={styles.cardDesc}>See how your logo and details appear on white-labeled components.</div>

          <div className={styles.logoPreviewContainer}>
            {logoUrl ? (
              <img src={logoUrl} alt="Company Logo" className={styles.logoPreview} onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <div className={styles.logoPlaceholder} style={{ backgroundColor: accentColour }}>
                {companyName ? companyName.charAt(0).toUpperCase() : 'C'}
              </div>
            )}
            <div>
              <h4 style={{ fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{companyName || 'Your Company Name'}</h4>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                {website || 'www.yourwebsite.com'}
              </p>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-6)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
            <h5 className={styles.label} style={{ marginBottom: 'var(--space-2)' }}>Sidebar Mockup</h5>
            <div style={{ 
              background: '#1e1e2f', 
              padding: '12px', 
              borderRadius: 'var(--radius-md)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              color: 'white'
            }}>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '4px' }} />
              ) : (
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '4px', 
                  background: accentColour, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justify: 'center',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: 'white'
                }}>
                  {companyName ? companyName.charAt(0).toUpperCase() : 'C'}
                </div>
              )}
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{companyName || 'Interior CRM'}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
