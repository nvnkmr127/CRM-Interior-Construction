/* eslint-disable no-unused-vars */
import React from 'react';
import styles from './PeriodSelector.module.css';

export default function PeriodSelector({ period, setPeriod }) {
  const periods = [
    { label: '7 Days', value: '7d' },
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' }
  ];

  return (
    <div className={styles.container}>
      {periods.map(p => (
        <button
          key={p.value}
          onClick={() => setPeriod(p.value)}
          className={`${styles.button} ${period === p.value ? styles.active : styles.inactive}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
