import React, { useState, useEffect } from 'react';
import styles from './FinancialOverviewPanel.module.css';

function formatValue(val) {
  if (val === undefined || val === null || val === '') return '—';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return val;
  if (num === 0) return '₹0';
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
}

const FinancialOverviewPanel = React.memo(function FinancialOverviewPanel({ 
  project, 
  projectId,
  headerActions,
  extraCards = []
}) {
  const [stats, setStats] = useState({
    contractValue: 0,
    billed: 0,
    collected: 0,
    outstanding: 0,
    overdue: 0,
    pending: 0,
    totalCost: 0
  });

  useEffect(() => {
    let mounted = true;
    
    const refreshData = () => {
      // Initial fallback from project.stats
      const rawContractValue = project?.stats?.netContractValue ?? project?.contract_value;
      const contractValue = Number(rawContractValue) || 0;
      const billed = project?.stats?.netBilled !== undefined ? project.stats.netBilled : (project?.stats?.totalPayment || 0);
      const collected = project?.stats?.netCollections !== undefined ? project.stats.netCollections : (project?.stats?.collectedPayment || 0);
      const outstanding = project?.stats?.outstandingBalance !== undefined ? project.stats.outstandingBalance : Math.max(0, billed - collected);
      
      setStats({
        contractValue,
        billed,
        collected,
        outstanding,
        overdue: project?.stats?.overduePayments || 0,
        pending: project?.stats?.pendingInvoices || 0,
        totalCost: project?.stats?.totalActualCost || 0
      });

      // Fetch payments to recalculate collected and outstanding (identical to PaymentsTab mock/fetch logic)
      import('../../api/paymentMilestones').then(({ getPaymentMilestones }) => {
        getPaymentMilestones(projectId).then(res => {
           if (!mounted) return;
           const _r = res.data?.data || res.data;
           let raw = Array.isArray(_r) ? _r : [];
           
           const totalBudgetFallback = Number(project?.booking_amount || 0) > 0 ? Number(project.booking_amount) * 10 : 0;
           const totalB = Number(project?.contract_value || 0) || totalBudgetFallback || 0;
           
           const defaultMilestoneConfig = [
            { key: 'booking', name: 'Booking', percentage: 10, enabled: true, dependency: null },
            { key: 'design', name: 'Design Advance', percentage: 15, enabled: true, dependency: 'booking' },
            { key: 'production', name: 'Production', percentage: 40, enabled: true, dependency: 'design advance' },
            { key: 'dispatch', name: 'Dispatch', percentage: 20, enabled: true, dependency: 'production' },
            { key: 'installation', name: 'Installation', percentage: 10, enabled: true, dependency: 'dispatch' },
            { key: 'handover', name: 'Final Handover', percentage: 5, enabled: true, dependency: 'installation' }
           ];

           const adminConfig = project?.milestone_config || defaultMilestoneConfig;
           const activeMilestones = adminConfig.filter(m => m.enabled);

           if (raw.length === 0) {
              activeMilestones.forEach((mConf, index) => {
                let mockDate = new Date(project?.createdAt || Date.now());
                mockDate.setDate(mockDate.getDate() + (index * 15));
                const milestoneAmount = (totalB * mConf.percentage) / 100;
                let mockPaymentEntries = [];
                let mockStatus = index === 0 ? 'pending' : 'scheduled';
                if (index === 0) {
                   mockStatus = 'paid';
                   mockPaymentEntries = [{ amount: milestoneAmount }];
                } else if (index === 1) {
                   mockStatus = 'partially_paid';
                   mockPaymentEntries = [{ amount: milestoneAmount * 0.5 }];
                }
                const mockEntry = {
                  id: `mock_m_${index}`,
                  amount: milestoneAmount,
                  payment_entries: mockPaymentEntries,
                  status: mockStatus
                };
                if (index === 0) raw.unshift(mockEntry);
                else raw.push(mockEntry);
              });
           }
           
           let computedCollected = 0;
           let computedRemaining = 0;
           let computedBilled = 0;

           raw.forEach((p) => {
              const entries = p.payment_entries ? [...p.payment_entries] : [];
              if (p.status === 'paid' && entries.length === 0) {
                 entries.push({ amount: Number(p.amount || p.paid_amount || 0) });
              }
              const pCollected = entries.reduce((s, e) => s + Number(e.amount || 0), 0);
              const pAmount = Number(p.amount || p.paid_amount || 0);
              computedCollected += pCollected;

              const isInvoiced = p.status === 'invoice_raised' || p.status === 'partially_paid' || p.status === 'overdue' || p.status === 'paid' || Boolean(p.invoice_reference);
              if (isInvoiced) {
                 computedBilled += pAmount;
                 computedRemaining += Math.max(0, pAmount - pCollected);
              }
           });

           setStats(prev => ({
             ...prev,
             collected: computedCollected,
             outstanding: computedRemaining,
             billed: Math.max(computedBilled, computedCollected)
           }));
        }).catch(err => console.log('Error fetching milestones for overview', err));
      });
    };

    refreshData();
    window.addEventListener('app:mock-db-change', refreshData);
    
    return () => { 
      mounted = false; 
      window.removeEventListener('app:mock-db-change', refreshData);
    };
  }, [projectId, project]);

  const effectiveRevenue = stats.contractValue > 0 ? stats.contractValue : stats.billed;
  const grossProfit = project?.stats?.grossProfit !== undefined 
      ? project.stats.grossProfit 
      : (effectiveRevenue > 0 || stats.totalCost > 0 ? effectiveRevenue - stats.totalCost : 0);
      
  const grossMarginPct = project?.stats?.grossMarginPct !== undefined 
      ? project.stats.grossMarginPct 
      : (effectiveRevenue > 0 ? Math.round((grossProfit / effectiveRevenue) * 100) : 0);

  // Extract Total Area & Avg Rate if passed or compute from project
  const areaCard = extraCards.find(c => c.label?.toLowerCase().includes('area'));
  const rateCard = extraCards.find(c => c.label?.toLowerCase().includes('rate'));
  const remainingExtraCards = extraCards.filter(c => c !== areaCard && c !== rateCard);

  const fallbackArea = project?.measurements?.reduce((sum, r) => sum + (Number(r.area) || 0), 0) || project?.carpet_area || project?.super_builtup_area || (project?.area ? Number(project.area) : 0);
  const effectiveAreaVal = areaCard ? areaCard.value : (fallbackArea > 0 ? `${fallbackArea} sqft` : '—');

  const effectiveCV = stats.contractValue > 0 ? stats.contractValue : Number(project?.contract_value || 0);
  const fallbackAvgRate = fallbackArea > 0 ? Math.round(effectiveCV / fallbackArea) : 0;
  const effectiveRateVal = rateCard ? rateCard.value : (fallbackAvgRate > 0 ? `₹${fallbackAvgRate}/sqft` : '—');

  return (
    <div className={styles.financialPanel}>
      <div className={styles.financialPanelHeader}>
        <div className={styles.headerTitle}>
          <span className={styles.headerTitleIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </span>
          Financial Overview
        </div>
        {headerActions && <div>{headerActions}</div>}
      </div>
      <div className={styles.financialGrid}>
        {/* Row 1 / Scope & Contract Sizing */}
        <div className={`${styles.financialCard} ${styles.featuredCard}`}>
          <span className={styles.financialLabel}>Contract Value (Net)</span>
          <span className={`${styles.financialValue} ${styles.featuredValue}`}>
            {formatValue(stats.contractValue > 0 ? stats.contractValue : project?.contract_value)}
          </span>
        </div>
        <div className={styles.financialCard}>
          <span className={styles.financialLabel}>Total Area</span>
          <span className={styles.financialValue}>
            {effectiveAreaVal}
          </span>
        </div>
        <div className={styles.financialCard}>
          <span className={styles.financialLabel}>Avg. Rate</span>
          <span className={styles.financialValue}>
            {effectiveRateVal}
          </span>
        </div>

        {/* Row 2 / Invoicing & Receivables */}
        <div className={styles.financialCard}>
          <span className={styles.financialLabel}>Billed (Net)</span>
          <span className={styles.financialValue}>
            {formatValue(stats.billed)}
          </span>
        </div>
        <div className={styles.financialCard}>
          <span className={styles.financialLabel}>Collected (Net)</span>
          <span className={`${styles.financialValue} ${styles.financialSuccess}`}>
            {formatValue(stats.collected)}
          </span>
        </div>
        <div className={styles.financialCard}>
          <span className={styles.financialLabel}>Outstanding Balance</span>
          <span className={`${styles.financialValue} ${stats.outstanding > 0 ? styles.financialWarning : ''}`}>
            {formatValue(stats.outstanding)}
          </span>
        </div>
        <div className={styles.financialCard}>
          <span className={styles.financialLabel}>Overdue Amount</span>
          <span className={`${styles.financialValue} ${stats.overdue > 0 ? styles.financialDanger : ''}`}>
            {formatValue(stats.overdue)}
          </span>
        </div>

        {/* Row 3 / Costs, Margins & Pending */}
        <div className={styles.financialCard}>
          <span className={styles.financialLabel}>Pending Invoices</span>
          <span className={`${styles.financialValue} ${stats.pending > 0 ? styles.financialInfo : ''}`}>
            {formatValue(stats.pending)}
          </span>
        </div>
        <div className={styles.financialCard}>
          <span className={styles.financialLabel}>Total Cost</span>
          <span className={`${styles.financialValue} ${stats.totalCost > 0 ? styles.financialDanger : ''}`}>
            {formatValue(stats.totalCost)}
          </span>
        </div>
        <div className={styles.financialCard}>
          <span className={styles.financialLabel}>Gross Profit</span>
          <span className={`${styles.financialValue} ${grossProfit >= 0 && effectiveRevenue > 0 ? styles.financialSuccess : grossProfit < 0 ? styles.financialDanger : ''}`}>
            {effectiveRevenue > 0 || stats.totalCost > 0 ? formatValue(grossProfit) : '—'}
          </span>
        </div>
        <div className={styles.financialCard}>
          <span className={styles.financialLabel}>Gross Margin</span>
          <span className={`${styles.financialValue} ${grossMarginPct >= 20 ? styles.financialSuccess : (grossMarginPct > 0 ? styles.financialWarning : (grossMarginPct < 0 ? styles.financialDanger : ''))}`}>
            {effectiveRevenue > 0 ? `${grossMarginPct}%` : '—'}
          </span>
        </div>

        {/* Custom Extra Cards (if any) */}
        {remainingExtraCards.map((card, idx) => (
          <div key={card.label || idx} className={styles.financialCard}>
            <span className={styles.financialLabel}>{card.label}</span>
            <span className={styles.financialValue} style={card.style}>
              {card.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default FinancialOverviewPanel;
