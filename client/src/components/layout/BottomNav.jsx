import React from 'react';
import { NavLink } from 'react-router-dom';
import styles from './BottomNav.module.css';

const GridIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const CheckSquareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

export default function BottomNav({ onMoreClick }) {
  const getNavClass = ({ isActive }) => {
    return isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem;
  };

  return (
    <nav className={`${styles.bottomNav} mobile-only`}>
      <NavLink to="/dashboard" className={getNavClass}>
        <span className={styles.icon}><GridIcon /></span>
        <span>Dashboard</span>
      </NavLink>
      <NavLink to="/leads" className={getNavClass}>
        <span className={styles.icon}><UsersIcon /></span>
        <span>Leads</span>
      </NavLink>
      <NavLink to="/projects" className={getNavClass}>
        <span className={styles.icon}><BriefcaseIcon /></span>
        <span>Projects</span>
      </NavLink>
      <NavLink to="/tasks" className={getNavClass}>
        <span className={styles.icon}><CheckSquareIcon /></span>
        <span>Tasks</span>
      </NavLink>
      <button onClick={onMoreClick} className={styles.navItem}>
        <span className={styles.icon}><MenuIcon /></span>
        <span>More</span>
      </button>
    </nav>
  );
}
