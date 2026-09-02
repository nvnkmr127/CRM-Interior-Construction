/* eslint-disable no-unused-vars */
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortalAuth } from '../store/portalAuthContext'
import api from '../../api/axios'
import styles from './PortalLogin.module.css'

export default function PortalLogin() {
  const { login, isAuthenticated } = usePortalAuth()
  const navigate = useNavigate()
  const [step, setStep]         = useState(1)   // 1=phone, 2=otp
  const [phone, setPhone]       = useState('')
  const [tenantSlug, setSlug]   = useState(new URLSearchParams(window.location.search).get('tenant') || 'demo')
  const [otp, setOtp]           = useState(['','','','','',''])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [resendSecs, setResend] = useState(0)
  const otpRefs = [useRef(),useRef(),useRef(),useRef(),useRef(),useRef()]

  // Redirect if already logged in
  useEffect(() => { if (isAuthenticated) navigate('/portal/overview') }, [isAuthenticated, navigate])

  // Resend countdown
  useEffect(() => {
    if (resendSecs <= 0) return
    const t = setTimeout(() => setResend(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendSecs])

  const sendOtp = async () => {
    setError(''); setLoading(true)
    try {
      await api.post('/portal/auth/send-otp', { phone, tenantSlug })
      setStep(2); setResend(30)
      setTimeout(() => otpRefs[0].current?.focus(), 100)
    } catch(e) {
      setError(e.response?.data?.error?.message === 'CLIENT_NOT_FOUND'
        ? 'Phone not found. Contact your project manager.'
        : 'Could not send OTP. Try again.')
    } finally { setLoading(false) }
  }

  const handleOtpChange = (index, val) => {
    // Paste handling
    if (val.length > 1) {
      const digits = val.replace(/\D/g,'').split('').slice(0,6)
      const next = [...otp]
      digits.forEach((d,i) => { if (i < 6) next[i] = d })
      setOtp(next)
      otpRefs[Math.min(digits.length, 5)].current?.focus()
      if (digits.length === 6) submitOtp(next)
      return
    }
    const digit = val.replace(/\D/g,'')
    const next = [...otp]; next[index] = digit; setOtp(next)
    if (digit && index < 5) otpRefs[index+1].current?.focus()
    if (next.every(d => d) && next.join('').length === 6) submitOtp(next)
  }

  const handleOtpKey = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index-1].current?.focus()
    }
  }

  const submitOtp = async (digits = otp) => {
    setError(''); setLoading(true)
    try {
      await login(phone, digits.join(''), tenantSlug)
      navigate('/portal/overview')
    } catch(e) {
      setError('Invalid code. Please try again.')
      setOtp(['','','','','',''])
      setTimeout(() => otpRefs[0].current?.focus(), 50)
    } finally { setLoading(false) }
  }

  const handleQuickDemoLogin = async (demoPhone = '9876543210', demoSlug = 'demo') => {
    setError('');
    setLoading(true);
    setPhone(demoPhone);
    setSlug(demoSlug);
    try {
      await api.post('/portal/auth/send-otp', { phone: demoPhone, tenantSlug: demoSlug });
      await login(demoPhone, '123456', demoSlug);
      navigate('/portal/overview');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to initiate demo login. Please try manually.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>✦</div>
          <span className={styles.logoText}>Your Project Portal</span>
        </div>

        {step === 1 && (
          <div className={styles.form}>
            <h1 className={styles.heading}>Sign in</h1>
            <p className={styles.sub}>Enter your registered mobile number</p>
            <label className={styles.label}>
              Mobile Number
              <div className={styles.phoneRow}>
                <span className={styles.prefix}>+91</span>
                <input
                  className={styles.phoneInput}
                  type='tel' maxLength={10} placeholder='9876543210'
                  value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))}
                  onKeyDown={e => e.key==='Enter' && phone.length===10 && sendOtp()}
                  autoFocus
                />
              </div>
            </label>
            <label className={styles.label}>
              Workspace
              <input
                className={styles.input}
                type='text' placeholder='demo'
                value={tenantSlug} onChange={e => setSlug(e.target.value)}
              />
              <span className={styles.hint}>Enter your workspace slug (e.g. demo)</span>
            </label>
            {error && <p className={styles.error}>{error}</p>}
            <button
              className={styles.btnPrimary}
              onClick={sendOtp}
              disabled={phone.length !== 10 || !tenantSlug || loading}
            >
              {loading ? 'Sending...' : 'Send OTP →'}
            </button>

            {import.meta.env.DEV && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>
                  Auto Login (Dev Mode)
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('9876543210', 'demo')}
                  disabled={loading}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <span>⚡</span> 1-Click Demo Client (Rajesh Sharma)
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className={styles.form}>
            <h1 className={styles.heading}>Enter OTP</h1>
            <p className={styles.sub}>6-digit code sent to +91 {phone.slice(0,4)}XXXXXX{phone.slice(-2)}</p>
            <div className={styles.otpRow}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  className={`${styles.otpBox} ${error ? styles.otpError : ''}`}
                  type='text' inputMode='numeric'
                  maxLength={6}   /* allow paste of full 6 digits */
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                />
              ))}
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button
              className={styles.btnPrimary}
              onClick={() => submitOtp()}
              disabled={otp.some(d=>!d) || loading}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => submitOtp(['1','2','3','4','5','6'])}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-accent)',
                  background: 'transparent',
                  color: 'var(--color-accent)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '4px'
                }}
              >
                ⚡ Quick Fill Demo OTP (123456)
              </button>
            )}

            <div className={styles.resend}>
              {resendSecs > 0
                ? <span>Resend in 0:{String(resendSecs).padStart(2,'0')}</span>
                : <button className={styles.linkBtn} onClick={sendOtp}>Resend OTP</button>
              }
              <button className={styles.linkBtn} onClick={() => { setStep(1); setOtp(['','','','','','']); setError('') }}>
                ← Change number
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-light)' }}>
          Staff or Admin? <a href="/login" style={{ color: 'var(--color-accent)', fontWeight: 600, textDecoration: 'none' }}>Sign in to Admin / Team Portal →</a>
        </div>
      </div>
    </div>
  )
}
