/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../ui';

const DUMMY_ALERTS = [
  { id: 'a1', type: 'critical', title: 'Conversion Dropped', desc: 'Conversion rate dropped by 12% in the last 48 hours for Facebook leads.', time: '10 mins ago', actionTarget: 'Conversion Rate' },
  { id: 'a2', type: 'success', title: 'Revenue Target Achieved', desc: 'Q3 Revenue target of ₹50,00,000 has been successfully crossed!', time: '1 hour ago', actionTarget: 'Total Pipeline Value' },
  { id: 'a3', type: 'warning', title: 'Pipeline Decreased', desc: 'Active pipeline value decreased by ₹8,00,000 this week.', time: '3 hours ago', actionTarget: 'Expected Revenue' },
  { id: 'a4', type: 'danger', title: 'Overdue Leads', desc: '14 High Priority leads have no activity in the last 7 days.', time: '5 hours ago', actionTarget: 'High Risk Deals' },
  { id: 'a5', type: 'warning', title: 'No Follow-up', desc: '5 Site visits completed yesterday have no follow-up scheduled.', time: '1 day ago', actionTarget: 'Sales Cycle & Stage Aging' },
  { id: 'a6', type: 'info', title: 'Large Opportunity', desc: 'New lead "Villa Project 4000sqft" added with estimated value > ₹25,00,000.', time: '1 day ago', actionTarget: 'Largest Deal' },
  { id: 'a7', type: 'danger', title: 'Lost Deal Alert', desc: 'Deal "Metro Tech Office" (₹15,00,000) was marked as Lost.', time: '2 days ago', actionTarget: 'Lost Revenue' },
];

const SEVERITY_COLORS = {
  critical: { bg: 'rgba(220, 38, 38, 0.1)', border: 'rgba(220, 38, 38, 0.3)', text: '#DC2626', icon: '🔴' },
  danger: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#F97316', icon: '⚠️' },
  warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: '#F59E0B', icon: '🔔' },
  success: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: '#10B981', icon: '✅' },
  info: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#3B82F6', icon: 'ℹ️' },
};

export default function AnalyticsAlertsPanel({ isOpen, onClose, onInvestigate }) {
  const [alerts, setAlerts] = useState(DUMMY_ALERTS);
  const [readIds, setReadIds] = useState(new Set());

  // Simulate real-time incoming alert if the panel is open for 10 seconds
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      const newAlert = {
        id: 'a' + Date.now(),
        type: 'info',
        title: 'New High Intent Lead',
        desc: 'AI predicts a 92% win probability for a newly assigned lead.',
        time: 'Just now',
        actionTarget: 'Most Likely Wins'
      };
      setAlerts(prev => [newAlert, ...prev]);
    }, 15000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const markAsRead = (id, e) => {
    e.stopPropagation();
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
  };

  const dismissAlert = (id, e) => {
    e.stopPropagation();
    setAlerts(alerts.filter(a => a.id !== id));
  };

  const clearAll = () => {
    setAlerts([]);
  };

  const markAllRead = () => {
    setReadIds(new Set(alerts.map(a => a.id)));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span>Notification Center</span>
        {alerts.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', marginRight: '24px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 600 }} onClick={markAllRead}>Mark all read</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: 600 }} onClick={clearAll}>Clear all</span>
          </div>
        )}
      </div>
    } size="md">
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '600px', paddingRight: '8px' }}>
        {alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-secondary)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
            <p>No new alerts.</p>
            <p style={{ fontSize: '12px' }}>You're all caught up!</p>
          </div>
        ) : (
          alerts.map(alert => {
            const isRead = readIds.has(alert.id);
            const styleConfig = SEVERITY_COLORS[alert.type] || SEVERITY_COLORS.info;

            return (
              <div 
                key={alert.id}
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: `1px solid ${styleConfig.border}`,
                  background: isRead ? 'var(--color-surface)' : styleConfig.bg,
                  opacity: isRead ? 0.7 : 1,
                  display: 'flex',
                  gap: '12px',
                  position: 'relative',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '20px', marginTop: '2px' }}>{styleConfig.icon}</div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '14px' }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                      {alert.time}
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
                    {alert.desc}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        if (!isRead) {
                          const next = new Set(readIds);
                          next.add(alert.id);
                          setReadIds(next);
                        }
                        onInvestigate(alert.actionTarget);
                        onClose();
                      }}
                      style={{ fontSize: '12px', padding: '4px 12px', height: '28px' }}
                    >
                      Investigate
                    </Button>
                    
                    {!isRead && (
                      <span 
                        onClick={(e) => markAsRead(alert.id, e)} 
                        style={{ fontSize: '12px', color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 500, padding: '4px 8px' }}
                      >
                        Mark as read
                      </span>
                    )}
                  </div>
                </div>

                <div 
                  onClick={(e) => dismissAlert(alert.id, e)}
                  style={{ position: 'absolute', top: '12px', right: '12px', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px', borderRadius: '4px', lineHeight: 1 }}
                >
                  ×
                </div>
              </div>
            );
          })
        )}
      </div>

    </Modal>
  );
}
