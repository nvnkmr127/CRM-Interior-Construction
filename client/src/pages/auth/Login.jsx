import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import { useToast } from '../../store/toastContext';
import { useForm } from '../../hooks/useForm';
import { validators, run } from '../../utils/validators';
import { Button } from '../../components/ui';
import styles from './Login.module.css';

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { values, errors, touched, handleChange, handleBlur, validateAll } = useForm({
    tenantSlug: '',
    email: '',
    password: ''
  }, {
    tenantSlug: run(validators.required('Tenant Slug')),
    email: run(validators.required('Email'), validators.email),
    password: run(validators.required('Password'), validators.minLen(6, 'Password'))
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [errorType, setErrorType] = useState(''); // 'shake' | 'inactive' | 'network'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setErrorType('');

    if (!validateAll()) return;

    setIsSubmitting(true);

    try {
      const result = await login(values.email, values.password, values.tenantSlug);
      setIsSubmitting(false);

      if (result.success) {
        toast.success('Welcome back!');
        navigate('/dashboard', { replace: true });
      } else {
        // Mock error handling for redesign requirements based on common messages
        if (result.message?.toLowerCase().includes('inactive')) {
          setErrorType('inactive');
          setApiError('Your account is inactive. Contact your workspace admin.');
        } else {
          setErrorType('shake');
          setApiError('Email or password is incorrect. Try again.');
          setShakeKey(k => k + 1);
        }
      }
    } catch (err) {
      setIsSubmitting(false);
      if (!navigator.onLine || err.message === 'Network Error') {
        setErrorType('network');
        setApiError('Could not connect to server. Check your internet connection.');
      } else {
        setErrorType('shake');
        setApiError('Email or password is incorrect. Try again.');
        setShakeKey(k => k + 1);
      }
    }
  };

  if (loading) return null;

  return (
    <div className={styles.page}>
      {/* LEFT HALF */}
      <div className={styles.leftPanel}>
        <div className={styles.leftQuote}>Transform spaces.<br/>Build relationships.</div>
        <ul className={styles.featureList}>
          <li className={styles.featureItem}><span className={styles.featureIcon}>◉</span> Manage leads from first call to project handover</li>
          <li className={styles.featureItem}><span className={styles.featureIcon}>◉</span> Real-time project tracking for your entire team</li>
          <li className={styles.featureItem}><span className={styles.featureIcon}>◉</span> Client portal — your clients always in the loop</li>
        </ul>
        <div className={styles.leftFooter}>Trusted by interior designers in Hyderabad, Bangalore & beyond</div>
      </div>

      {/* RIGHT HALF */}
      <div className={styles.rightPanel}>
        <div className={styles.formContainer}>
          <div className={styles.logoContainer}>
            <div className={styles.logoMark}></div>
            <div className={styles.logoText}>Interior CRM</div>
          </div>
          
          <div className={styles.headerText}>
            <h1 className={styles.welcomeText}>Welcome back</h1>
            <p className={styles.subText}>Sign in to your workspace</p>
          </div>

          <form 
            key={shakeKey} 
            onSubmit={handleSubmit} 
            className={`${styles.form} ${errorType === 'shake' ? styles.shake : ''}`}
          >
            {apiError && (
              <div className={errorType === 'inactive' ? styles.amberCallout : styles.errorMessage}>
                {apiError}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="tenantSlug" className={styles.label}>Tenant Slug</label>
              <input
                id="tenantSlug"
                type="text"
                name="tenantSlug"
                value={values.tenantSlug}
                onChange={(e) => handleChange('tenantSlug', e.target.value)}
                onBlur={() => handleBlur('tenantSlug')}
                className={`${styles.input} ${touched.tenantSlug && errors.tenantSlug ? styles.inputError : ''}`}
                placeholder="yourcompany"
                disabled={isSubmitting}
              />
              <div className={styles.helpText}>Get your workspace slug from your admin</div>
              {touched.tenantSlug && errors.tenantSlug && <div style={{color:'var(--color-danger)', fontSize:'12px', marginTop:'4px'}}>{errors.tenantSlug}</div>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>Email Address</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>✉</span>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={values.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  className={`${styles.input} ${styles.inputWithIcon} ${touched.email && errors.email ? styles.inputError : ''}`}
                  placeholder="you@company.com"
                  disabled={isSubmitting}
                />
              </div>
              {touched.email && errors.email && <div style={{color:'var(--color-danger)', fontSize:'12px', marginTop:'4px'}}>{errors.email}</div>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔒</span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={values.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  onBlur={() => handleBlur('password')}
                  className={`${styles.input} ${styles.inputWithIcon} ${touched.password && errors.password ? styles.inputError : ''}`}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.togglePassword}
                  tabIndex="-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {touched.password && errors.password && <div style={{color:'var(--color-danger)', fontSize:'12px', marginTop:'4px'}}>{errors.password}</div>}
            </div>

            <Button 
              type="submit" 
              variant="primary"
              size="lg"
              className={styles.submitBtn} 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className={styles.footer}>
            Don't have an account? <a href="#" className={styles.link}>Contact your admin</a>
          </div>

          <div className={styles.bottomFooter}>
            v1.0.0 · <a href="#" className={styles.link}>Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
}
