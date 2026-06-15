import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import ProtectedRoute from '../../components/ProtectedRoute';
import styles from './ConfigPage.module.css';

const navItems = [
  { path: 'general', label: 'General' },
  { path: 'custom-fields', label: 'Custom Fields' },
  { path: 'lead-stages', label: 'Lead Stages' },
  { path: 'templates', label: 'Project Templates' },
  { path: 'automations', label: 'Automations' },
  { path: 'api-keys', label: 'API Keys' },
  { path: 'webhooks', label: 'Webhooks' },
  { path: 'logs', label: 'Logs' },
  { path: 'roles', label: 'Roles & Permissions' }
];

export default function ConfigPage() {
  const getNavClass = ({ isActive }) => {
    return isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem;
  };

  return (
    <ProtectedRoute requiredPermission="config:manage">
      <div className={styles.configLayout}>
        <nav className={styles.sidebar}>
          {navItems.map(item => (
            <NavLink key={item.path} to={`/config/${item.path}`} className={getNavClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </ProtectedRoute>
  );
}
