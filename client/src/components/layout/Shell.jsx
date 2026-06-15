import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import styles from './Shell.module.css';

export default function Shell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className={styles.shellContainer}>
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      <div className={styles.mainContent}>
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className={`${styles.scrollableArea} pb-[56px] sm:pb-6`}>
          <Outlet />
        </main>
      </div>
      <BottomNav onMoreClick={() => setIsSidebarOpen(true)} />
    </div>
  );
}
