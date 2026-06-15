import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { usePortalAuth } from '../store/portalAuthContext';
import './PortalShell.css';

export default function PortalShell() {
  const { logout, clientName } = usePortalAuth();
  const location = useLocation();
  const [branding, setBranding] = useState({ name: 'CRM Portal', accentColor: '#3b82f6' });

  useEffect(() => {
    fetch('/api/portal/branding')
      .then(res => res.json())
      .then(data => {
        if (data.success) setBranding(data.data);
      })
      .catch(console.error);
  }, []);

  const navItems = [
    { path: '/portal/project', label: 'Overview' },
    { path: '/portal/approvals', label: 'Approvals' },
    { path: '/portal/snags', label: 'Snags' },
    { path: '/portal/documents', label: 'Documents' }
  ];

  return (
    <div className="portal-shell">
      <header className="portal-header" style={{ borderBottomColor: branding.accentColor }}>
        <div className="portal-header-left">
          <div className="portal-logo" style={{ color: branding.accentColor }}>{branding.name}</div>
          <div className="portal-welcome">Welcome, {clientName}</div>
        </div>
        <button className="portal-logout-btn" onClick={logout}>Logout</button>
      </header>

      <main className="portal-main">
        <Outlet />
      </main>

      <nav className="portal-bottom-nav">
        {navItems.map(item => (
          <Link 
            key={item.path} 
            to={item.path}
            className={`portal-nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
            style={{ color: location.pathname.startsWith(item.path) ? branding.accentColor : 'inherit' }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
