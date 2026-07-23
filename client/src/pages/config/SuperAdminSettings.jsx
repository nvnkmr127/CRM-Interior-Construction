import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './ConfigLayout.module.css'; // Reuse existing config layout

export default function SuperAdminSettings() {
  const [stats, setStats] = useState(null);
  const toast = useToast();

  useEffect(() => {
    api.get('/superadmin/license').then(res => setStats(res.data?.data)).catch(console.error);
  }, []);

  const handleGlobalReset = async () => {
    if (window.confirm("CRITICAL WARNING: This will force ALL users in the organization to reset their passwords on next login. Proceed?")) {
      try {
        await api.post('/superadmin/global-password-reset');
        toast.success("Global password reset initiated.");
      } catch (err) {
        toast.error("Failed to initiate global reset.");
      }
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Super Admin Command Center</h1>
        <p className={styles.subtitle}>Organization-wide security, licensing, and access controls.</p>
      </header>

      <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* LICENSE SECTION */}
        <section style={{ padding: '24px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
          <h2 style={{ marginBottom: '16px', color: 'var(--color-text-primary)' }}>License & Seat Utilization</h2>
          <div style={{ display: 'flex', gap: '48px' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Total Seats</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats?.license_seats || '--'}</div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Active Users</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats?.active_users || '--'}</div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Utilization</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--color-success)' }}>{stats?.utilization || '--'}</div>
            </div>
          </div>
        </section>

        {/* SECURITY SECTION */}
        <section style={{ padding: '24px', background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', borderRadius: '8px' }}>
          <h2 style={{ marginBottom: '8px', color: 'var(--color-danger)' }}>Critical Security Actions</h2>
          <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--color-text-primary)' }}>These actions are highly destructive and will be logged to the immutable audit trail.</p>
          <button 
            onClick={handleGlobalReset}
            style={{ padding: '10px 20px', background: 'var(--color-danger)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
          >
            Trigger Global Password Reset
          </button>
        </section>

        {/* INTEGRATION SECTION */}
        <section style={{ padding: '24px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
          <h2 style={{ marginBottom: '16px', color: 'var(--color-text-primary)' }}>SSO & SAML Configuration</h2>
          <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>Configure Identity Providers (Okta, Azure AD, Google Workspace).</p>
          <button 
            onClick={() => toast.info('SSO setup portal opening...')}
            style={{ padding: '10px 20px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
          >
            Configure IdP
          </button>
        </section>

      </div>
    </div>
  );
}
