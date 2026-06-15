import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import styles from './Shell.module.css';

export default function Shell() {
  return (
    <div className={styles.shellContainer}>
      <Sidebar />
      <div className={styles.mainContent}>
        <Topbar />
        <main className={styles.scrollableArea}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
