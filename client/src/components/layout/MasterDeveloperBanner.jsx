import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import { useToast } from '../../store/toastContext';
import { isSuperMasterDeveloper } from '../../utils/isSuperMasterDeveloper';
import { clearTenantClientStorage } from '../../utils/storageCleanup';
import api from '../../api/axios';
import styles from './MasterDeveloperBanner.module.css';

export default function MasterDeveloperBanner() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [exiting, setExiting] = useState(false);

  // Strictly render if viewing a non-root workspace in master developer mode
  const isMaster = isSuperMasterDeveloper(user);
  const isInspectingClientWorkspace = Boolean(
    user?.masterSession || (isMaster && user?.tenant?.slug !== 'demo')
  );

  if (!isInspectingClientWorkspace) {
    return null;
  }

  const handleExit = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      const res = await api.post('/superadmin/exit-workspace');
      if (res.data?.success) {
        const payload = res.data.data;
        clearTenantClientStorage();
        if (payload.accessToken) {
          localStorage.setItem('accessToken', payload.accessToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${payload.accessToken}`;
        }
        if (payload.refreshToken) {
          localStorage.setItem('refreshToken', payload.refreshToken);
        }
        setUser(payload.user);
        window.dispatchEvent(new Event('app:sidebar-config-updated'));
        window.dispatchEvent(new Event('app:tenant-updated'));
        window.dispatchEvent(new Event('app:auth-change'));
        toast.success('Exited client workspace and returned to Master Workspace');
        navigate('/');
      }
    } catch (err) {
      console.error('Failed to exit workspace:', err);
      toast.error(err.response?.data?.message || 'Failed to exit workspace');
    } finally {
      setExiting(false);
    }
  };

  return (
    <div className={styles.banner}>
      <div className={styles.left}>
        <span className={styles.badge}>
          👑 Master Developer
        </span>
        <span className={styles.text}>
          Viewing Workspace: <strong className={styles.workspaceName}>{user?.tenant?.name || 'Workspace'}</strong>
        </span>
        {user?.tenant?.slug && (
          <span className={styles.slug}>({user.tenant.slug})</span>
        )}
        {user?.tenant?.plan && (
          <span className={styles.planTag}>{user.tenant.plan} Plan</span>
        )}
      </div>
      <div className={styles.right}>
        <button 
          className={styles.exitBtn} 
          onClick={handleExit} 
          disabled={exiting}
          title="Return to your primary Master Developer workspace"
        >
          <span>🔙</span>
          <span>{exiting ? 'Returning...' : 'Exit to Master Workspace'}</span>
        </button>
      </div>
    </div>
  );
}
