/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react'
import styles from './PortalHandover.module.css'
import api from '../../api/axios'
import { Badge, Button, Modal } from '../../components/ui'
import { useToast } from '../../store/toastContext'

export default function PortalHandover() {
  const [checklist, setChecklist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [countdown, setCountdown] = useState(0)

  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()]
  const toast = useToast()

  const loadChecklist = async () => {
    try {
      const res = await api.get('/portal/handover')
      setChecklist(res.data?.data || null)
    } catch (err) {
      if (err.response?.status === 404) {
        setChecklist(null)
      } else {
        toast.error('Failed to load handover details')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChecklist()
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const sendOtpCode = async () => {
    setSendingOtp(true)
    setOtpError('')
    try {
      await api.post('/portal/handover/send-otp')
      toast.success('OTP sent successfully via WhatsApp/SMS!')
      setCountdown(60)
      setTimeout(() => otpRefs[0].current?.focus(), 100)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP')
    } finally {
      setSendingOtp(false)
    }
  }

  const handleOpenSignOff = () => {
    setIsSignOffModalOpen(true)
    setOtp(['', '', '', '', '', ''])
    sendOtpCode()
  }

  const handleOtpChange = (index, val) => {
    const digit = val.slice(-1)
    
    // Support pasting 6-digit codes
    if (val.length === 6 && /^\d+$/.test(val)) {
      const digits = val.split('')
      setOtp(digits)
      otpRefs[5].current?.focus()
      submitOtp(digits)
      return
    }

    if (digit && !/^\d+$/.test(digit)) return

    const next = [...otp]
    next[index] = digit
    setOtp(next)

    if (digit && index < 5) {
      otpRefs[index + 1].current?.focus()
    }

    if (next.every(d => d) && next.join('').length === 6) {
      submitOtp(next)
    }
  }

  const handleOtpKey = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const next = [...otp]
        next[index - 1] = ''
        setOtp(next)
        otpRefs[index - 1].current?.focus()
      } else {
        const next = [...otp]
        next[index] = ''
        setOtp(next)
      }
    }
  }

  const submitOtp = async (digits = otp) => {
    const code = digits.join('')
    if (code.length !== 6) return

    setVerifying(true)
    setOtpError('')
    try {
      await api.post('/portal/handover/sign-off', { otp: code })
      toast.success('✓ Handover successfully signed off!')
      setIsSignOffModalOpen(false)
      setLoading(true)
      
      // Give worker a brief moment to pick up the job and poll fresh status
      setTimeout(() => {
        loadChecklist()
      }, 2000)
    } catch (err) {
      const msg = err.response?.data?.message || 'Sign off failed. Invalid OTP.'
      setOtpError(msg)
      toast.error(msg)
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return <div className={styles.loader}>Loading handover details...</div>
  }

  if (!checklist) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>Handover Checklist Pending</h2>
          <p>The project handover checklist is not yet ready for review. It will become visible once the project team initiates the site handover process.</p>
        </div>
      </div>
    )
  }

  const items = checklist.items || []
  const totalItems = items.length
  const checkedItems = items.filter(i => i.is_checked || i.isChecked).length
  const isAllChecked = totalItems > 0 && checkedItems === totalItems
  const isReadOnly = checklist.status === 'signed_off'

  const inspectionItems = items.filter(i => i.item_type !== 'document' && i.item_type !== 'key_access' && i.itemType !== 'document' && i.itemType !== 'key_access')
  const documentItems = items.filter(i => i.item_type === 'document' || i.itemType === 'document')
  const keyItems = items.filter(i => i.item_type === 'key_access' || i.itemType === 'key_access')

  return (
    <div className={styles.container}>
      {isReadOnly ? (
        <div className={styles.certificateCard}>
          <div className={styles.certificateHeader}>
            <h2 className={styles.certTitle}>CERTIFICATE OF COMPLETION</h2>
            <div className={styles.certSubtitle}>Practical Handover Completed</div>
          </div>
          
          <p className={styles.certificateBody}>
            "This is to formally certify that all works associated with this project have been successfully completed, inspected, and verified. Handover of the site has been executed in full satisfaction of the agreed requirements."
          </p>

          <div className={styles.certificateGrid}>
            <div className={styles.gridItem}>
              <span className={styles.gridLabel}>Client Name</span>
              <span className={styles.gridValue}>{checklist.client_name || 'Verified Client'}</span>
            </div>
            <div className={styles.gridItem}>
              <span className={styles.gridLabel}>Date of Completion</span>
              <span className={styles.gridValue}>
                {checklist.signed_by_client_at ? new Date(checklist.signed_by_client_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          <div className={styles.certificateSignatures}>
            <div className={styles.sigBlock}>
              <span className={styles.sigTitle}>Client Signature</span>
              <span className={styles.sigText}>{checklist.client_name || 'Client'}</span>
              <span className={styles.sigBadge}>Verified via OTP</span>
            </div>
            <div className={styles.sigBlock}>
              <span className={styles.sigTitle}>Status</span>
              <span className={styles.sigText} style={{fontWeight:600, color:'var(--color-success)'}}>Active Warranty Commenced</span>
            </div>
          </div>

          {checklist.downloadUrl && (
            <button 
              className={styles.downloadBtn}
              onClick={() => window.open(checklist.downloadUrl, '_blank')}
            >
              📥 Download Certificate (PDF)
            </button>
          )}
        </div>
      ) : (
        <>
          {checklist.hasOutstandingPayments && (
            <div className={styles.bannerWarning} style={{ padding: '16px 20px', borderRadius: 'var(--radius-xl)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>⚠️ Financial Clearance Required</div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>
                You have outstanding payment milestones. Handover sign-off is locked until all pending balances are settled or formally deferred by the finance team. Please visit the Payments tab to review your outstanding dues.
              </div>
            </div>
          )}
          <div className={`${styles.banner} ${isAllChecked && !checklist.hasOutstandingPayments ? styles.bannerSuccess : styles.bannerWarning}`}>
            <div>
              <div className={styles.bannerTitle}>
                {isAllChecked 
                  ? (checklist.hasOutstandingPayments ? 'Inspection Complete (Pending Payment Clearance)' : 'Ready for Handover Sign-off') 
                  : 'Handover Inspection in Progress'}
              </div>
              <div className={styles.bannerDesc}>
                {isAllChecked 
                  ? (checklist.hasOutstandingPayments 
                      ? 'All checklist items are completed. Once outstanding payments are cleared or deferred, sign-off will be enabled.' 
                      : 'All room items have been marked complete by our team. Please review the scope below and sign off using OTP to generate your completion certificate.')
                  : `${checkedItems} of ${totalItems} checklist items have been checked off. Sign-off becomes available once the site team completes the remainder.`}
              </div>
            </div>
            {isAllChecked && !checklist.hasOutstandingPayments && (
              <button className={styles.signoffBtn} onClick={handleOpenSignOff}>
                Verify & Sign Off
              </button>
            )}
          </div>
        </>
      )}

      <div className={styles.itemsSection}>
        <h3 className={styles.sectionTitle}>Handover Scope Items</h3>
        {inspectionItems.length === 0 ? (
          <p style={{color:'var(--color-text-muted)', fontSize:'var(--text-sm)', textAlign:'center', margin:'20px 0'}}>
            No physical inspection items populated in the checklist yet.
          </p>
        ) : (
          <div className={styles.itemsList}>
            {inspectionItems.map(item => (
              <div key={item.id} className={styles.itemRow}>
                <span className={styles.roomTag}>{item.room}</span>
                <div className={styles.itemContent}>
                  <div className={styles.itemDesc}>{item.description}</div>
                  {item.checked_at && (
                    <div className={styles.itemMeta}>
                      Verified on {new Date(item.checked_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div>
                  {item.is_checked ? (
                    <span className={styles.verifiedLabel}>✓ Verified</span>
                  ) : (
                    <span style={{color:'var(--color-text-muted)', fontSize:'var(--text-xs)'}}>Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {documentItems.length > 0 && (
        <div className={styles.itemsSection}>
          <h3 className={styles.sectionTitle}>Product Manuals & Warranties Handover</h3>
          <div className={styles.itemsList}>
            {documentItems.map(item => (
              <div key={item.id} className={styles.itemRow} style={{ flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={styles.roomTag} style={{ background: 'var(--color-accent)', color: '#ffffff', borderColor: 'var(--color-accent)' }}>Document</span>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>{item.description}</span>
                  </div>
                  <div>
                    {item.is_checked ? (
                      <span className={styles.verifiedLabel}>✓ Handed Over</span>
                    ) : (
                      <span style={{color:'var(--color-text-muted)', fontSize:'var(--text-xs)'}}>Pending</span>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', width: '100%', padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
                  <div>
                    <strong style={{ color: 'var(--color-text-muted)', marginRight: '6px' }}>SERIAL NUMBER:</strong>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.serialNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <strong style={{ color: 'var(--color-text-muted)', marginRight: '6px' }}>WARRANTY EXPIRY:</strong>
                    <span>{item.warrantyExpiryDate ? new Date(item.warrantyExpiryDate).toLocaleDateString('en-IN') : 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
                    <span style={{ color: item.hasManual ? 'var(--color-success)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                      {item.hasManual ? '✓ Manual Received' : '✗ No Manual'}
                    </span>
                    <span style={{ color: item.hasWarrantyCard ? 'var(--color-success)' : 'var(--color-text-muted)', fontWeight: 600 }}>
                      {item.hasWarrantyCard ? '✓ Warranty Card Received' : '✗ No Warranty Card'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {keyItems.length > 0 && (
        <div className={styles.itemsSection}>
          <h3 className={styles.sectionTitle}>Keys & Access Credentials Handover</h3>
          <div className={styles.itemsList}>
            {keyItems.map(item => (
              <div key={item.id} className={styles.itemRow} style={{ flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={styles.roomTag} style={{ background: 'var(--color-primary)', color: '#ffffff', borderColor: 'var(--color-primary)' }}>Key / Access</span>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text)' }}>{item.description}</span>
                  </div>
                  <div>
                    {item.is_checked ? (
                      <span className={styles.verifiedLabel}>✓ Handed Over & Acknowledged</span>
                    ) : (
                      <span style={{color:'var(--color-text-muted)', fontSize:'var(--text-xs)'}}>Pending</span>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', width: '100%', padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
                  <div>
                    <strong style={{ color: 'var(--color-text-muted)', marginRight: '6px' }}>HANDOVER DETAILS:</strong>
                    <span>{item.keyDetails || 'No details provided'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={isSignOffModalOpen}
        onClose={() => setIsSignOffModalOpen(false)}
        title="Verify Completion Sign-off"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsSignOffModalOpen(false)}>Cancel</Button>
            <Button 
              variant="primary" 
              onClick={() => submitOtp()} 
              disabled={otp.some(d => !d) || verifying}
            >
              {verifying ? 'Verifying...' : 'Confirm Sign-off'}
            </Button>
          </>
        }
      >
        <div>
          <h4 className={styles.otpTitle}>Enter 6-Digit OTP</h4>
          <p className={styles.otpDesc}>
            To complete the handover and generate the project completion certificate, please enter the security verification code sent to your registered phone number.
          </p>

          <div className={styles.otpInputContainer}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={otpRefs[i]}
                type="text"
                maxLength={1}
                className={`${styles.otpDigitInput} ${otpError ? styles.otpError : ''}`}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKey(i, e)}
              />
            ))}
          </div>

          {otpError && (
            <p style={{color:'var(--color-danger)', fontSize:'var(--text-xs)', textAlign:'center', marginBottom:12}}>
              {otpError}
            </p>
          )}

          <div className={styles.otpTimerText}>
            {countdown > 0 ? (
              <span>Resend code in {countdown}s</span>
            ) : (
              <button className={styles.resendLink} onClick={sendOtpCode} disabled={sendingOtp}>
                {sendingOtp ? 'Sending...' : 'Resend Verification Code'}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
