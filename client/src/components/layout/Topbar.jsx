import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import styles from './Topbar.module.css';

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = () => {
    const path = location.pathname.split('/')[1] || 'Dashboard';
    if (path === 'config') return 'Config Centre';
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  const initial = user?.name ? user.name.charAt(0) : 'U';

  return (
    <header className={styles.topbar}>
      <div className="flex items-center gap-4">
        <button className="mobile-only text-gray-500 hover:text-gray-900" onClick={onMenuClick} aria-label="Menu">
          <MenuIcon />
        </button>
        <h2 className={styles.title}>{getPageTitle()}</h2>
      </div>
      
      <div className={styles.rightSection}>
        <button className={styles.notificationBtn} aria-label="Notifications">
          <BellIcon />
        </button>

        <div className={styles.userMenu} ref={menuRef}>
          <button 
            className={styles.avatarBtn} 
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span className={styles.userName}>{user?.name}</span>
            <div className={styles.avatar}>{initial}</div>
          </button>

          {menuOpen && (
            <div className={styles.dropdown}>
              <button className={styles.dropdownItem} onClick={() => { setMenuOpen(false); }}>
                My Profile
              </button>
              <button className={styles.dropdownItem} onClick={logout}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
