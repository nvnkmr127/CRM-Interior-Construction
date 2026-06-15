import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../store/portalAuthContext';
import './PortalLogin.css';

export default function PortalLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = usePortalAuth();

  const [tenantSlug, setTenantSlug] = useState(searchParams.get('tenant') || '');
  const [phone, setPhone] = useState('');
  
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    
    if (!tenantSlug || !phone) {
      setError('Please enter tenant slug and phone number');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
      const res = await fetch('/api/portal/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, tenantSlug })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setStep(2);
        setCountdown(30);
      } else {
        setError(data.message === 'Client not found' ? 'Phone not found. Contact your project manager.' : data.message);
      }
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
      await login(formattedPhone, fullOtp, tenantSlug);
      navigate('/portal/project');
    } catch (err) {
      setError(err.message === 'OTP expired' ? 'OTP expired' : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-login-container">
      <div className="portal-login-card">
        <div className="portal-login-header">
          <div className="portal-login-logo">Client Portal</div>
          <p className="portal-login-subtitle">Track your project progress</p>
        </div>

        {error && <div className="portal-login-error">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="portal-login-form">
            <div className="form-group">
              <label>Company Code</label>
              <input
                type="text"
                value={tenantSlug}
                onChange={e => setTenantSlug(e.target.value)}
                placeholder="e.g. digicloudify"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <div className="phone-input-wrapper">
                <span className="phone-prefix">+91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  disabled={loading}
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="portal-btn-primary">
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="portal-login-form">
            <p className="otp-sent-message">6-digit OTP sent to your phone</p>
            <div className="otp-input-group">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => otpRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(index, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(index, e)}
                  className="otp-input"
                  disabled={loading}
                />
              ))}
            </div>
            
            <button type="submit" disabled={loading} className="portal-btn-primary">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            
            <div className="resend-wrapper">
              {countdown > 0 ? (
                <span className="resend-timer">Resend OTP in {countdown}s</span>
              ) : (
                <button type="button" onClick={handleSendOtp} className="resend-btn" disabled={loading}>
                  Resend OTP
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
