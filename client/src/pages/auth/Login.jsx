import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getMockTeamCredentials } from '../../store/authContext';
import { useToast } from '../../store/toastContext';
import { useForm } from '../../hooks/useForm';
import { validators, run } from '../../utils/validators';
import { Button } from '../../components/ui';
import MfaVerificationModal from '../../components/auth/MfaVerificationModal';
import ForcePasswordResetModal from '../../components/auth/ForcePasswordResetModal';
import styles from './Login.module.css';

export default function Login() {
  const { login, isAuthenticated, loading, setUser, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { values, errors, touched, handleChange, handleBlur, validateAll } = useForm({
    tenantSlug: '',
    email: '',
    password: ''
  }, {
    tenantSlug: run(validators.required('Tenant Slug')),
    email: run(validators.required('Email'), validators.email),
    password: run(validators.required('Password'))
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [errorType, setErrorType] = useState(''); // 'shake' | 'inactive' | 'network'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  // Security Modals State
  const [showMfa, setShowMfa] = useState(false);
  const [mfaData, setMfaData] = useState(null);
  const [showForceReset, setShowForceReset] = useState(false);
  const [forceResetUserId, setForceResetUserId] = useState(null);

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      const isAdmin = 
        user?.role === 'superadmin' || 
        user?.role?.name?.toLowerCase() === 'superadmin' || 
        user?.role?.name?.toLowerCase() === 'super admin' || 
        (user?.role?.permissions && user.role.permissions.includes('*'));
      const modules = user?.role?.enabled_modules || [];
      
      if (isAdmin || modules.includes('dashboards')) {
        navigate('/dashboard', { replace: true });
      } else if (modules.includes('projects')) {
        navigate('/projects', { replace: true });
      } else if (modules.includes('leads')) {
        navigate('/leads', { replace: true });
      } else if (modules.includes('tasks')) {
        navigate('/tasks', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, loading, navigate, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setErrorType('');

    if (!validateAll()) return;

    setIsSubmitting(true);

    try {
      const cleanEmail = (values.email || '').trim();
      const cleanSlug = (values.tenantSlug || '').trim();
      const result = await login(cleanEmail, values.password, cleanSlug);
      setIsSubmitting(false);

      if (result.success) {
        if (result.payload?.mfaRequired) {
          setMfaData(result.payload);
          setShowMfa(true);
        } else if (result.payload?.passwordExpired) {
          setForceResetUserId(result.payload.userId);
          setShowForceReset(true);
        } else {
          toast.success('Welcome back!');
          // Navigation is handled by the useEffect based on the user's role
        }
      } else {
        // Mock error handling for redesign requirements based on common messages
        if (result.message?.toLowerCase().includes('deactivated')) {
          setErrorType('inactive');
          setApiError(result.message || 'This workspace has been deactivated. Please contact support.');
        } else if (result.message?.toLowerCase().includes('inactive')) {
          setErrorType('inactive');
          setApiError('Your account is inactive. Contact your workspace admin.');
        } else if (result.message?.toLowerCase().includes('locked')) {
          setErrorType('inactive');
          setApiError('Account temporarily locked due to failed attempts. Please try again in 15 minutes.');
        } else if (result.message?.includes('POLICY_VIOLATION')) {
          setErrorType('policy_violation');
          const reason = result.message.split(': ')[1] || 'Unknown';
          let errorMsg = 'Login blocked by security policy.';
          if (reason === 'DAY_RESTRICTION') errorMsg = 'Login blocked: Your role is restricted from logging in today.';
          else if (reason === 'TIME_RESTRICTION') errorMsg = 'Login blocked: You are logging in outside your allowed hours.';
          else if (reason === 'IP_RESTRICTION') errorMsg = 'Login blocked: You are attempting to log in from an unauthorized network.';
          else if (reason === 'BROWSER_RESTRICTION') errorMsg = 'Login blocked: Please use a trusted browser.';
          else if (reason === 'DEVICE_RESTRICTION') errorMsg = 'Login blocked: Your device type is restricted.';
          setApiError(errorMsg);
        } else {
          setErrorType('shake');
          setApiError(result.message || 'Email or password is incorrect. Try again.');
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
        setApiError(err.message || 'Email or password is incorrect. Try again.');
        setShakeKey(k => k + 1);
      }
    }
  };

  const handleQuickLogin = async (email, password = 'Demo@123', tenantSlug = 'demo') => {
    setApiError('');
    setErrorType('');
    setIsSubmitting(true);
    handleChange('tenantSlug', tenantSlug);
    handleChange('email', email);
    handleChange('password', password);

    try {
      let result = await login(email, password, tenantSlug);
      if (!result.success && (password === 'Demo@123' || password === 'Admin@123')) {
        const altPw = password === 'Demo@123' ? 'Admin@123' : 'Demo@123';
        result = await login(email, altPw, tenantSlug);
        if (result.success) {
          handleChange('password', altPw);
        }
      }

      setIsSubmitting(false);

      if (result.success) {
        if (result.payload?.mfaRequired) {
          setMfaData(result.payload);
          setShowMfa(true);
        } else if (result.payload?.passwordExpired) {
          setForceResetUserId(result.payload.userId);
          setShowForceReset(true);
        } else {
          toast.success('Welcome back!');
        }
      } else {
        if (result.message?.toLowerCase().includes('deactivated')) {
          setErrorType('inactive');
          setApiError(result.message || 'This workspace has been deactivated. Please contact support.');
        } else if (result.message?.toLowerCase().includes('inactive')) {
          setErrorType('inactive');
          setApiError('Your account is inactive. Contact your workspace admin.');
        } else if (result.message?.toLowerCase().includes('locked')) {
          setErrorType('inactive');
          setApiError('Account temporarily locked due to failed attempts. Please try again in 15 minutes.');
        } else {
          setErrorType('shake');
          setApiError(result.message || 'Email or password is incorrect. Try again.');
          setShakeKey(k => k + 1);
        }
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorType('shake');
      setApiError(err.message || 'Login failed. Please try again.');
      setShakeKey(k => k + 1);
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
              <label htmlFor="tenantSlug" className={styles.label}>Workspace Slug or Name</label>
              <input
                id="tenantSlug"
                type="text"
                name="tenantSlug"
                value={values.tenantSlug}
                onChange={(e) => handleChange('tenantSlug', e.target.value)}
                onBlur={() => handleBlur('tenantSlug')}
                className={`${styles.input} ${touched.tenantSlug && errors.tenantSlug ? styles.inputError : ''}`}
                placeholder="slug name"
                disabled={isSubmitting}
              />
              <div className={styles.helpText}>Enter your workspace slug or name</div>
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
                  autoComplete="email"
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
                  autoComplete="current-password"
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

            {import.meta.env.DEV && (() => {
              const mockTeam = getMockTeamCredentials();
              const hasCustomTeam = mockTeam && mockTeam.email && !['admin@demo.com', 'priya@demo.com', 'rahul@demo.com', 'ananya@demo.com', 'arjun@demo.com', 'vikram@demo.com'].includes(mockTeam.email.toLowerCase());
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px', width: '100%' }}>
                  <div style={{ gridColumn: '1 / -1', fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', marginBottom: '4px' }}>
                    Auto Login (Dev Mode)
                  </div>
                  {hasCustomTeam && (
                    <Button 
                      type="button" 
                      variant="primary"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => handleQuickLogin(mockTeam.email, mockTeam.password || 'password', 'demo')}
                      style={{ gridColumn: '1 / -1', fontSize: '12px', padding: '8px', fontWeight: '600', background: 'var(--color-accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <span>⚙</span> Configured Dev Login ({mockTeam.name || mockTeam.email})
                    </Button>
                  )}
                  {[
                    { label: 'Admin', email: 'admin@demo.com', password: 'Admin@123' },
                    { label: 'Project Mgr', email: 'priya@demo.com', password: 'Demo@123' },
                    { label: 'Designer', email: 'rahul@demo.com', password: 'Demo@123' },
                    { label: 'Sales', email: 'ananya@demo.com', password: 'Demo@123' },
                    { label: 'QC Engineer', email: 'arjun@demo.com', password: 'Demo@123' },
                    { label: 'Site Eng.', email: 'vikram@demo.com', password: 'Demo@123' }
                  ].map((u) => (
                    <Button 
                      key={u.label}
                      type="button" 
                      variant="secondary"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => handleQuickLogin(u.email, u.password, 'demo')}
                      style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text)', fontSize: '12px', padding: '6px' }}
                    >
                      {u.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => navigate('/portal/login')}
                    style={{ gridColumn: '1 / -1', background: 'rgba(232, 147, 90, 0.12)', color: 'var(--color-accent)', border: '1px dashed var(--color-accent)', fontSize: '12px', padding: '6px', fontWeight: '600' }}
                  >
                    📱 Switch to Client Portal Login (/portal/login)
                  </Button>
                </div>
              );
            })()}
          </form>

          <div className={styles.footer} style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <div>
              Are you a client? <a href="/portal/login" className={styles.link} style={{ fontWeight: '600', color: 'var(--color-accent)' }}>Sign in to Client Portal →</a>
            </div>
            <div>
              Don't have an account? <a href="#" className={styles.link}>Contact your admin</a>
            </div>
          </div>

          <div className={styles.bottomFooter}>
            v1.0.0 · <a href="#" className={styles.link}>Privacy Policy</a>
          </div>
        </div>
      </div>

      <MfaVerificationModal 
        isOpen={showMfa}
        mfaMethod={mfaData?.mfaMethod}
        tempToken={mfaData?.tempToken}
        onCancel={() => { setShowMfa(false); setMfaData(null); }}
        onVerified={(data) => {
          setShowMfa(false);
          setMfaData(null);
          if (data.data?.user) {
             setUser(data.data.user);
             toast.success('MFA Verified. Welcome back!');
             // Navigation handled by useEffect
          }
        }}
      />

      <ForcePasswordResetModal 
        isOpen={showForceReset}
        userId={forceResetUserId}
        onCancel={() => { setShowForceReset(false); setForceResetUserId(null); }}
        onReset={() => {
          setShowForceReset(false);
          setForceResetUserId(null);
          toast.success('Password updated! Please login with your new password.');
        }}
      />
    </div>
  );
}
