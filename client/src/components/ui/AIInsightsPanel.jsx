import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import styles from './AIInsightsPanel.module.css';

export default function AIInsightsPanel() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    api.get('/users/ai/insights')
      .then(res => {
        if (mounted) {
          setInsights(res.data?.data?.anomalies || []);
          setLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          setInsights([]);
          setLoading(false);
        }
      });
    return () => mounted = false;
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <button className={styles.triggerButton} disabled style={{ opacity: 0.7, cursor: 'not-allowed' }}>
        <span className={styles.sparkle}>✨</span> AI Analyzing...
      </button>
    );
  }

  if (!insights || insights.length === 0) return null;

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button className={styles.triggerButton} onClick={() => setIsOpen(!isOpen)}>
        <span className={styles.sparkle}>✨</span> AI Insights
        {insights.length > 0 && <span className={styles.badge}>{insights.length}</span>}
      </button>
      
      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <span className={styles.sparkle}>✨</span> 
            <strong>AI Directory Insights</strong>
          </div>
          <div className={styles.insightsList}>
            {insights.map((insight, idx) => (
              <div key={idx} className={`${styles.insightCard} ${styles[insight.severity || 'low']}`}>
                <div className={styles.insightType}>
                  {insight.type === 'duplicate' ? '👥 Duplicate Risk' : 
                   insight.type === 'inactive' ? '💤 Inactive Account' : 
                   '🛡️ Security Notice'}
                </div>
                <div className={styles.insightMessage}>{insight.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
