import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './Register.module.css'
import { useToast } from '../../store/toastContext'

export default function Register() {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '', slug: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const calculateStrength = (pwd) => {
    let score = 0
    if (pwd.length >= 8) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[a-z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++
    return score
  }

  const pwdScore = calculateStrength(formData.password)
  const strengthColor = pwdScore <= 2 ? 'var(--color-danger)' : pwdScore <= 4 ? 'var(--color-warning)' : 'var(--color-success)'
  const strengthWidth = `${(pwdScore / 5) * 100}%`

  const validate = () => {
    const errs = {}
    if (formData.name.length < 2) errs.name = 'Name must be at least 2 characters'
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) errs.email = 'Valid email is required'
    if (formData.password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (formData.password !== formData.confirmPassword) errs.confirmPassword = 'Passwords must match'
    if (!formData.slug) errs.slug = 'Workspace slug is required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrs = validate()
    if (Object.keys(validationErrs).length > 0) {
      setErrors(validationErrs)
      return
    }

    setLoading(true)
    // Mock API call
    setTimeout(() => {
      setLoading(false)
      if (formData.email === 'test@example.com') {
        setErrors({ email: 'This email is already registered' })
      } else {
        toast.success('Account created! Sign in to continue.')
        navigate('/login')
      }
    }, 1000)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.leftPanel}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>A</div>
          Antigravity
        </div>
        <div>
          <div className={styles.quote}>"The most powerful operating system for modern interior design & construction teams."</div>
          <ul className={styles.features}>
            <li>✓ Complete end-to-end project management</li>
            <li>✓ Integrated client portal for approvals & snags</li>
            <li>✓ Powerful automation and financial analytics</li>
          </ul>
        </div>
        <div style={{fontSize: 12, opacity: 0.5}}>© 2026 Antigravity Inc.</div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.formBox}>
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>Get started with your new workspace.</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Full Name *</label>
              <input type="text" name="name" className={`${styles.input} ${errors.name ? styles.inputError : ''}`} value={formData.name} onChange={handleChange} />
              {errors.name && <div className={styles.errorText}>{errors.name}</div>}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Email Address *</label>
              <input type="email" name="email" className={`${styles.input} ${errors.email ? styles.inputError : ''}`} value={formData.email} onChange={handleChange} />
              {errors.email && <div className={styles.errorText}>{errors.email}</div>}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Password *</label>
              <input type="password" name="password" className={`${styles.input} ${errors.password ? styles.inputError : ''}`} value={formData.password} onChange={handleChange} />
              {formData.password.length > 0 && (
                <div className={styles.strengthBarContainer}>
                  <div className={styles.strengthBar} style={{ width: strengthWidth, backgroundColor: strengthColor }} />
                </div>
              )}
              {errors.password && <div className={styles.errorText}>{errors.password}</div>}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Confirm Password *</label>
              <input type="password" name="confirmPassword" className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`} value={formData.confirmPassword} onChange={handleChange} />
              {errors.confirmPassword && <div className={styles.errorText}>{errors.confirmPassword}</div>}
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Tenant Slug *</label>
              <input type="text" name="slug" className={`${styles.input} ${errors.slug ? styles.inputError : ''}`} value={formData.slug} onChange={handleChange} placeholder="e.g. acme-interiors" />
              {errors.slug ? <div className={styles.errorText}>{errors.slug}</div> : <div className={styles.helperText}>Ask your admin for your workspace slug</div>}
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className={styles.footer}>
            Already have an account? <Link to="/login" className={styles.link}>Sign in →</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
