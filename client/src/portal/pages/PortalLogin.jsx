import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './PortalLogin.module.css'
import { usePortalAuth } from '../store/portalAuthContext'

export default function PortalLogin() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState(1) // 1: phone, 2: otp
  const [loading, setLoading] = useState(false)
  const { login } = usePortalAuth()
  const navigate = useNavigate()

  const handleSendOtp = (e) => {
    e.preventDefault()
    if (phone.length < 10) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStep(2)
    }, 600)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (otp.length < 6) return
    setLoading(true)
    await login(phone, otp)
    setLoading(false)
    navigate('/portal/overview')
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoBox}>A</div>
        <h1 className={styles.title}>Welcome Home</h1>
        <p className={styles.subtitle}>
          {step === 1 ? 'Sign in to track your project progress, approve designs, and manage payments.' : `Enter the 6-digit code sent to +91 ${phone}`}
        </p>

        {step === 1 ? (
          <form className={styles.form} onSubmit={handleSendOtp}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Mobile Number</label>
              <input 
                type="tel" 
                className={styles.input} 
                placeholder="e.g. 98765 43210" 
                value={phone} 
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading || phone.length < 10}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleLogin}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>OTP Code</label>
              <input 
                type="text" 
                className={styles.input} 
                placeholder="000000" 
                value={otp} 
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                autoFocus
                style={{textAlign: 'center', letterSpacing: '8px', fontSize: '24px'}}
              />
            </div>
            <button type="submit" className={styles.submitBtn} disabled={loading || otp.length < 6}>
              {loading ? 'Verifying...' : 'Sign In'}
            </button>
            <div className={styles.resend}>
              Didn't receive it? <span className={styles.resendLink} onClick={() => setStep(1)}>Try again</span>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
