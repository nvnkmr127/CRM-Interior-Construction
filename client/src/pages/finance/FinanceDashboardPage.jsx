import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Badge, Input, Select } from '../../components/ui';
import styles from './FinanceDashboardPage.module.css';
import { useDebounce } from '../../hooks';
import { getProjects } from '../../api/projects';
import { getAllInvoices } from '../../api/invoices';
import { getAllReceipts } from '../../api/financials';
import { getAllPaymentMilestones } from '../../api/paymentMilestones';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

const formatValue = (val) => {
  if (!val) return '₹0';
  return `₹${Number(val).toLocaleString('en-IN')}`;
};

const CHART_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#f97316'];

export default function FinanceDashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const currentTabFromUrl = searchParams.get('tab') || 'overview';
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState(currentTabFromUrl);
  const subTabsRef = useRef(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveSubTab(tabParam);
    } else {
      setActiveSubTab('overview');
    }
  }, [searchParams]);

  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [milestones, setMilestones] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [globalStats, setGlobalStats] = useState({
    activePipeline: 0,
    totalBilled: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    totalArea: 0,
    totalProjects: 0
  });

  useEffect(() => {
    fetchGlobalData();
  }, []);

  const fetchGlobalData = async () => {
    setLoading(true);
    try {
      const [projRes, invRes, recRes, mileRes] = await Promise.all([
        getProjects(),
        getAllInvoices().catch(() => ({ data: { data: [] } })),
        getAllReceipts().catch(() => ({ data: { data: [] } })),
        getAllPaymentMilestones().catch(() => ({ data: { data: [] } }))
      ]);

      const allProjs = projRes.data?.data || projRes.data || [];
      let allInvs = invRes.data?.data || invRes.data || [];
      let allRecs = recRes.data?.data || recRes.data || [];
      let allMiles = mileRes.data?.data || mileRes.data || [];

      // Extract milestones directly from projects if milestone API returned empty
      allProjs.forEach(p => {
        if (p.payments && Array.isArray(p.payments)) {
          p.payments.forEach(m => {
            if (!allMiles.some(existing => existing.id === m.id)) {
              allMiles.push({ ...m, project_id: m.project_id || p.id });
            }
          });
        }
      });

      // Synthesize missing Invoices & Receipts for all paid milestones (e.g. Booking Advance)
      allMiles.forEach(m => {
        const pId = m.project_id || m.projectId;
        const proj = allProjs.find(p => p.id === pId);
        const amountPaid = Number(m.paid_amount || m.collectedAmount || (m.status === 'paid' ? m.amount : 0));

        if (amountPaid > 0) {
          // Ensure Invoice exists
          if (!allInvs.some(i => (i.milestoneId || i.payment_milestone_id) === m.id || (i.milestoneName === m.name && (i.projectId || i.project_id) === pId))) {
            allInvs.push({
              id: 'INV-' + (m.id || Date.now()).toString().slice(-8),
              projectId: pId,
              invoiceDate: m.paid_at || new Date().toISOString(),
              milestoneId: m.id,
              milestoneName: m.name || m.milestone || 'Booking Advance',
              customerName: proj?.client_name || proj?.customerName || 'Client',
              amount: amountPaid,
              total_amount: amountPaid,
              status: 'PAID',
              type: 'TAX_INVOICE'
            });
          }

          // Ensure Receipt exists
          if (!allRecs.some(r => ((r.milestoneName === (m.name || m.milestone)) || (r.milestoneId || r.payment_milestone_id) === m.id) && (r.projectId || r.project_id) === pId)) {
            allRecs.push({
              id: 'REC-' + (m.id || Date.now()).toString().slice(-8),
              projectId: pId,
              receiptDate: m.paid_at || new Date().toISOString(),
              milestoneName: m.name || m.milestone || 'Booking Advance',
              customerName: proj?.client_name || proj?.customerName || 'Client',
              amount: amountPaid,
              paymentMode: m.payment_entries?.[0]?.mode || 'Bank Transfer',
              reference: m.invoice_reference || 'REF-' + (m.id || Date.now()).toString().slice(-6),
              status: 'ISSUED'
            });
          }
        }
      });

      setProjects(allProjs);
      setInvoices(allInvs);
      setReceipts(allRecs);
      setMilestones(allMiles);

      let pipeline = 0;
      let billed = 0;
      let collected = 0;
      let outstanding = 0;
      let area = 0;
      let activeCount = 0;

      allProjs.forEach(p => {
        if (p.status !== 'cancelled' && p.status !== 'archived') {
          activeCount++;
          const projPipeline = Number(p.stats?.netContractValue || p.contract_value || 0);
          
          // Calculate collected payment directly from project stats or payment entries/milestones
          let projCollected = Number(p.stats?.netCollections ?? p.stats?.collectedPayment ?? 0);
          if (projCollected === 0 && p.payments && Array.isArray(p.payments)) {
            projCollected = p.payments.reduce((sum, m) => sum + Number(m.paid_amount || m.collectedAmount || (m.status === 'paid' ? m.amount : 0)), 0);
          }
          if (projCollected === 0 && allRecs.length > 0) {
            projCollected = allRecs.filter(r => (r.projectId || r.project_id) === p.id).reduce((sum, r) => sum + Number(r.amount || 0), 0);
          }

          let projInvoiced = allInvs.filter(i => (i.projectId || i.project_id) === p.id && i.status !== 'cancelled').reduce((sum, i) => sum + Number(i.total_amount || i.grandTotal || i.amount || 0), 0);
          let projMilestoneBilled = 0;
          if (p.payments && Array.isArray(p.payments)) {
            projMilestoneBilled = p.payments.filter(m => m.status === 'invoice_raised' || m.status === 'partially_paid' || m.status === 'paid' || Boolean(m.invoice_reference)).reduce((sum, m) => sum + Number(m.amount || 0), 0);
          }

          let projBilled = Math.max(projInvoiced, projMilestoneBilled, projCollected);
          if (projBilled === 0 && p.stats?.netBilled !== undefined) {
            projBilled = Number(p.stats.netBilled);
          }

          const projOutstanding = Math.max(0, projBilled - projCollected);
          const projArea = Number(p.area || p.sqft || p.totalArea || 0);

          pipeline += projPipeline;
          billed += projBilled;
          collected += projCollected;
          outstanding += projOutstanding;
          area += projArea;
        }
      });

      setGlobalStats({
        activePipeline: pipeline,
        totalBilled: billed,
        totalCollected: collected,
        totalOutstanding: outstanding,
        totalArea: area,
        totalProjects: activeCount
      });
    } catch (err) {
      console.error('Error fetching global finance data', err);
    } finally {
      setLoading(false);
    }
  };

  const avgRate = globalStats.totalArea > 0 ? Math.round(globalStats.activePipeline / globalStats.totalArea) : 0;

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Filter Data
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const projName = projects.find(p => p.id === inv.projectId)?.name || '';
      const matchSearch = inv.id.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || projName.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, projects, debouncedSearchQuery, statusFilter]);

  const filteredReceipts = useMemo(() => {
    return receipts.filter(rec => {
      const projName = projects.find(p => p.id === rec.projectId)?.name || '';
      const matchSearch = rec.id.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || projName.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      return matchSearch;
    });
  }, [receipts, projects, debouncedSearchQuery]);

  // Calculate Ledger
  const ledger = useMemo(() => {
    return [
      ...invoices.map(i => ({ type: 'Invoice', date: i.invoiceDate || i.date, ref: i.id, amount: i.amount, projectId: i.projectId, milestone: i.milestoneName, status: i.status })),
      ...receipts.map(r => ({ type: 'Receipt', date: r.receiptDate || r.date, ref: r.id, amount: r.amount, projectId: r.projectId, milestone: r.milestoneName, status: r.status }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [invoices, receipts]);

  const filteredLedger = useMemo(() => {
    return ledger.filter(entry => {
      const projName = projects.find(p => p.id === entry.projectId)?.name || '';
      const matchSearch = entry.ref.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || projName.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || entry.type === statusFilter; // Can filter by Invoice/Receipt
      return matchSearch && matchStatus;
    });
  }, [ledger, projects, debouncedSearchQuery, statusFilter]);

  const exportLedgerToCSV = () => {
    const headers = ['Date', 'Project', 'Type', 'Reference', 'Milestone', 'Debit (INR)', 'Credit (INR)'];
    const rows = filteredLedger.map(entry => {
      const proj = projects.find(p => p.id === entry.projectId);
      const debit = entry.type === 'Invoice' ? entry.amount : 0;
      const credit = entry.type === 'Receipt' ? entry.amount : 0;
      return [
        new Date(entry.date).toLocaleDateString('en-GB'),
        `"${proj?.name || 'Unknown Project'}"`,
        entry.type,
        entry.ref,
        `"${entry.milestone || 'N/A'}"`,
        debit,
        credit
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `global_ledger_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render Helpers
  const renderFilters = (type) => (
    <div className={styles.filtersRow}>
      <Input 
        placeholder="Search by ID or Project..." 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ width: '300px' }}
      />
      {type === 'invoices' && (
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '150px' }}>
          <option value="ALL">All Status</option>
          <option value="GENERATED">Generated</option>
          <option value="SENT">Sent</option>
          <option value="PAID">Paid</option>
        </Select>
      )}
      {type === 'ledger' && (
        <>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '150px' }}>
            <option value="ALL">All Types</option>
            <option value="Invoice">Invoices (Debit)</option>
            <option value="Receipt">Receipts (Credit)</option>
          </Select>
          <Button variant="outline" onClick={exportLedgerToCSV} style={{ marginLeft: 'auto' }}>
            Export CSV
          </Button>
        </>
      )}
    </div>
  );

  const renderInvoices = () => (
    <div className={styles.tableCard}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Global Invoices</h3>
      </div>
      {renderFilters('invoices')}
      <div className={styles.tableWrap}>
        <table className={styles.customTable}>
          <thead>
            <tr>
              <th className={styles.th}>Invoice ID</th>
              <th className={styles.th}>Project</th>
              <th className={styles.th}>Date</th>
              <th className={styles.th}>Milestone</th>
              <th className={styles.th}>Customer</th>
              <th className={styles.th}>Amount</th>
              <th className={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr><td colSpan="7" className={styles.emptyText}>No invoices found</td></tr>
            ) : (
              filteredInvoices.map(inv => {
                const proj = projects.find(p => p.id === inv.projectId);
                return (
                  <tr key={inv.id} className={styles.tr}>
                    <td className={`${styles.td} fw-medium`}>{inv.id}</td>
                    <td className={styles.td}>{proj?.name || 'Unknown Project'}</td>
                    <td className={styles.td}>{new Date(inv.invoiceDate || inv.date).toLocaleDateString('en-GB')}</td>
                    <td className={styles.td}>{inv.milestoneName || 'N/A'}</td>
                    <td className={styles.td}>{inv.customerName || proj?.client_name || 'N/A'}</td>
                    <td className={`${styles.td} fw-medium`}>₹{Number(inv.amount || 0).toLocaleString('en-IN')}</td>
                    <td className={styles.td}>
                      <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'SENT' ? 'info' : 'warning'}>
                        {inv.status}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReceipts = () => (
    <div className={styles.tableCard}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Global Receipts</h3>
      </div>
      {renderFilters('receipts')}
      <div className={styles.tableWrap}>
        <table className={styles.customTable}>
          <thead>
            <tr>
              <th className={styles.th}>Receipt ID</th>
              <th className={styles.th}>Project</th>
              <th className={styles.th}>Date</th>
              <th className={styles.th}>Milestone</th>
              <th className={styles.th}>Payment Mode</th>
              <th className={styles.th}>Reference</th>
              <th className={styles.th}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceipts.length === 0 ? (
              <tr><td colSpan="7" className={styles.emptyText}>No receipts found</td></tr>
            ) : (
              filteredReceipts.map(rec => {
                const proj = projects.find(p => p.id === rec.projectId);
                return (
                  <tr key={rec.id} className={styles.tr}>
                    <td className={`${styles.td} fw-medium`}>{rec.id}</td>
                    <td className={styles.td}>{proj?.name || 'Unknown Project'}</td>
                    <td className={styles.td}>{new Date(rec.receiptDate || rec.date).toLocaleDateString('en-GB')}</td>
                    <td className={styles.td}>{rec.milestoneName || 'N/A'}</td>
                    <td className={styles.td}>{rec.paymentMode || 'Bank Transfer'}</td>
                    <td className={styles.td}>{rec.reference || 'N/A'}</td>
                    <td className={`${styles.td} text-success fw-medium`}>₹{Number(rec.amount || 0).toLocaleString('en-IN')}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderLedger = () => (
    <div className={styles.tableCard}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>Master Ledger</h3>
      </div>
      {renderFilters('ledger')}
      <div className={styles.tableWrap}>
        <table className={styles.customTable}>
          <thead>
            <tr>
              <th className={styles.th}>Date</th>
              <th className={styles.th}>Project</th>
              <th className={styles.th}>Type</th>
              <th className={styles.th}>Reference</th>
              <th className={styles.th}>Milestone</th>
              <th className={`${styles.th} text-end`}>Debit (₹)</th>
              <th className={`${styles.th} text-end`}>Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {filteredLedger.length === 0 ? (
              <tr><td colSpan="7" className={styles.emptyText}>No ledger entries found</td></tr>
            ) : (
              filteredLedger.map((entry, idx) => {
                const proj = projects.find(p => p.id === entry.projectId);
                return (
                  <tr key={idx} className={styles.tr}>
                    <td className={styles.td}>{new Date(entry.date).toLocaleDateString('en-GB')}</td>
                    <td className={styles.td}>{proj?.name || 'Unknown Project'}</td>
                    <td className={styles.td}>
                      <Badge variant={entry.type === 'Receipt' ? 'success' : 'primary'}>{entry.type}</Badge>
                    </td>
                    <td className={`${styles.td} fw-medium`}>{entry.ref}</td>
                    <td className={styles.td}>{entry.milestone || 'N/A'}</td>
                    <td className={`${styles.td} text-end text-danger`}>{entry.type === 'Invoice' ? Number(entry.amount).toLocaleString('en-IN') : '-'}</td>
                    <td className={`${styles.td} text-end text-success`}>{entry.type === 'Receipt' ? Number(entry.amount).toLocaleString('en-IN') : '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCollections = () => {
    // Show all payment milestones across all projects
    const sortedMilestones = [...milestones].sort((a, b) => new Date(a.due_date || a.dueDate || Date.now()) - new Date(b.due_date || b.dueDate || Date.now()));
    
    return (
      <div className={styles.tableCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Global Collections Pipeline</h3>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.customTable}>
            <thead>
              <tr>
                <th className={styles.th}>Project</th>
                <th className={styles.th}>Milestone</th>
                <th className={styles.th}>Due Date</th>
                <th className={styles.th}>Amount Due</th>
                <th className={styles.th}>Amount Paid</th>
                <th className={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedMilestones.length === 0 ? (
                <tr><td colSpan="6" className={styles.emptyText}>No upcoming milestones found</td></tr>
              ) : (
                sortedMilestones.map(m => {
                  const proj = projects.find(p => p.id === (m.project_id || m.projectId));
                  return (
                    <tr key={m.id} className={styles.tr}>
                      <td className={styles.td}>{proj?.name || 'Unknown Project'}</td>
                      <td className={`${styles.td} fw-medium`}>{m.name || m.milestone}</td>
                      <td className={styles.td}>{m.due_date || m.dueDate ? new Date(m.due_date || m.dueDate).toLocaleDateString('en-GB') : 'N/A'}</td>
                      <td className={`${styles.td} fw-medium`}>₹{Number(m.amount || 0).toLocaleString('en-IN')}</td>
                      <td className={`${styles.td} text-success`}>₹{Number(m.paid_amount || m.collectedAmount || 0).toLocaleString('en-IN')}</td>
                      <td className={styles.td}>
                        <Badge variant={m.status === 'paid' ? 'success' : m.status === 'overdue' ? 'danger' : m.status === 'scheduled' ? 'info' : 'warning'}>
                          {m.status?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderReceivables = () => {
    // Receivables Aging Report
    const today = new Date();
    let bucket0_30 = 0, bucket31_60 = 0, bucket61_90 = 0, bucket90Plus = 0;
    
    const unpaidInvoices = invoices.filter(i => i.status !== 'PAID');
    unpaidInvoices.forEach(inv => {
        const invDate = new Date(inv.invoiceDate || inv.date);
        const diffDays = Math.floor((today - invDate) / (1000 * 60 * 60 * 24));
        const amt = Number(inv.amount || 0);
        if (diffDays <= 30) bucket0_30 += amt;
        else if (diffDays <= 60) bucket31_60 += amt;
        else if (diffDays <= 90) bucket61_90 += amt;
        else bucket90Plus += amt;
    });

    const agingData = [
      { name: '0-30 Days', amount: bucket0_30 },
      { name: '31-60 Days', amount: bucket31_60 },
      { name: '61-90 Days', amount: bucket61_90 },
      { name: '90+ Days', amount: bucket90Plus }
    ];

    return (
      <div className={styles.overviewContainer}>
        <div className={styles.financialPanel}>
          <div className={styles.financialPanelHeader}>Accounts Receivable Aging Report</div>
          <div className={styles.financialGrid}>
            {agingData.map((bucket, i) => (
              <div key={i} className={styles.financialCard}>
                <span className={styles.financialLabel}>{bucket.name}</span>
                <span className={styles.financialValue} style={{ color: i > 1 ? '#ef4444' : '#f59e0b' }}>
                  {formatValue(bucket.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div className={styles.chartContainer}>
           <h4>Aging Distribution</h4>
           <div style={{ height: 300, marginTop: 20 }}>
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={agingData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} />
                 <YAxis tickFormatter={(val) => `₹${val/1000}k`} axisLine={false} tickLine={false} />
                 <Tooltip formatter={(value) => formatValue(value)} cursor={{fill: 'var(--color-surface-hover)'}} />
                 <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    // Generate Chart Data
    const projectStatusData = projects.reduce((acc, p) => {
        const stat = p.status || 'unknown';
        if (!acc[stat]) acc[stat] = 0;
        acc[stat] += 1;
        return acc;
    }, {});
    const pieData = Object.keys(projectStatusData).map(k => ({ name: k.toUpperCase(), value: projectStatusData[k] }));

    const topProjects = [...projects].sort((a,b) => Number(b.contract_value || 0) - Number(a.contract_value || 0)).slice(0, 5);
    const barData = topProjects.map(p => ({
        name: p.name.substring(0, 10) + '...',
        Billed: Number(p.stats?.totalPayment || 0),
        Collected: Number(p.stats?.collectedPayment || 0)
    }));

    return (
      <div className={styles.overviewContainer}>
        {/* Global Financial Overview Cards Panel */}
        <div className={styles.financialPanel} style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className={styles.financialPanelHeader} style={{ padding: '16px 20px', fontSize: '16px', fontWeight: 600, borderBottom: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a' }}>
            Global Financial Overview
          </div>
          <div className={styles.financialGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', backgroundColor: '#e2e8f0' }}>
            <div className={styles.financialCard} style={{ padding: '20px 24px', backgroundColor: '#ffffff' }}>
              <span className={styles.financialLabel} style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Active Pipeline (Net)
              </span>
              <span className={styles.financialValue} style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>
                {formatValue(globalStats.activePipeline)}
              </span>
            </div>
            <div className={styles.financialCard} style={{ padding: '20px 24px', backgroundColor: '#ffffff' }}>
              <span className={styles.financialLabel} style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Billed (Net)
              </span>
              <span className={styles.financialValue} style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>
                {formatValue(globalStats.totalBilled)}
              </span>
            </div>
            <div className={styles.financialCard} style={{ padding: '20px 24px', backgroundColor: '#ffffff' }}>
              <span className={styles.financialLabel} style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Collected (Net)
              </span>
              <span className={styles.financialValue} style={{ fontSize: '22px', fontWeight: 700, color: '#16a34a' }}>
                {formatValue(globalStats.totalCollected)}
              </span>
            </div>
            <div className={styles.financialCard} style={{ padding: '20px 24px', backgroundColor: '#ffffff' }}>
              <span className={styles.financialLabel} style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                Outstanding Balance
              </span>
              <span className={styles.financialValue} style={{ fontSize: '22px', fontWeight: 700, color: '#d97706' }}>
                {formatValue(globalStats.totalOutstanding)}
              </span>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className={styles.chartsRow}>
            <div className={styles.chartCard}>
                <h4 className={styles.chartTitle}>Top 5 Projects (Billed vs Collected)</h4>
                <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)"/>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(val) => `₹${val/1000}k`} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value) => formatValue(value)} />
                        <Legend />
                        <Bar dataKey="Billed" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="Collected" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className={styles.chartCard}>
                <h4 className={styles.chartTitle}>Project Status Distribution</h4>
                <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Project Level Details */}
        <h3 className={styles.sectionTitle}>Project Breakdowns</h3>
        <div className={styles.projectListGrid}>
          {projects.map(proj => (
            <div key={proj.id} className={styles.projectCard} onClick={() => navigate(`/projects/${proj.id}?tab=Payments`)}>
              <div className={styles.projectCardHeader}>
                <h4 className={styles.projectName}>{proj.name}</h4>
                <Badge variant={proj.status === 'active' ? 'success' : 'secondary'}>{proj.status}</Badge>
              </div>
              <div className={styles.projectCardBody}>
                <div className={styles.projectStat}>
                  <span>Contract:</span>
                  <span className="fw-medium">₹{Number(proj.stats?.netContractValue || proj.contract_value || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className={styles.projectStat}>
                  <span>Collected:</span>
                  <span className="text-success fw-medium">₹{Number(proj.stats?.collectedPayment || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className={styles.projectStat}>
                  <span>Outstanding:</span>
                  <span className="text-primary fw-medium">₹{Number(proj.stats?.outstandingBalance || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      {/* Top Header Summary Strip */}
      <div style={{ width: '100%', flexShrink: 0, background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ fontWeight: 700, fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>💰</span> Finance Master Center
          </div>
          <Badge variant="primary" size="sm">
            {globalStats.totalProjects} Active Project(s)
          </Badge>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', backgroundColor: '#e2e8f0' }}>
          
          <div style={{ padding: '16px 24px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Active Pipeline Value
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0284c7' }}>
              ₹{globalStats.activePipeline.toLocaleString('en-IN')}/-
            </div>
          </div>
          
          <div style={{ padding: '16px 24px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Global Avg. Rate
            </div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
              ₹{avgRate}/sqft
            </div>
          </div>

          <div style={{ padding: '16px 24px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Total Area
            </div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
              {globalStats.totalArea.toLocaleString('en-IN')} sqft
            </div>
          </div>

          <div style={{ padding: '16px 24px', backgroundColor: '#ffffff' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Total Outstanding Balance
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#d97706' }}>
              ₹{globalStats.totalOutstanding > 0 ? globalStats.totalOutstanding.toLocaleString('en-IN') : 0}
            </div>
          </div>

        </div>
      </div>

      {/* Sub-Tabs Navigation Bar - PERMANENT & GUARANTEED DISPLAY */}
      <div 
        className={styles.subTabsContainer} 
        ref={subTabsRef} 
        style={{ 
          width: '100%',
          flexShrink: 0,
          display: 'flex', 
          gap: '6px', 
          borderBottom: '2px solid #e2e8f0', 
          padding: '6px 8px 0 8px', 
          overflowX: 'auto',
          background: '#ffffff',
          borderRadius: '8px 8px 0 0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}
      >
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'collections', label: 'Collections', icon: '📈' },
          { id: 'receivables', label: 'AR Aging', icon: '⏳' },
          { id: 'invoices', label: 'Global Invoices', icon: '🧾' },
          { id: 'receipts', label: 'Global Receipts', icon: '💵' },
          { id: 'ledger', label: 'Master Ledger', icon: '📓' }
        ].map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`${styles.subTab} ${isActive ? styles.subTabActive : ''}`}
              style={{
                padding: '10px 18px',
                fontSize: '14px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#2563eb' : '#475569',
                borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
                background: isActive ? '#eff6ff' : 'transparent',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setActiveSubTab(tab.id);
                setSearchParams({ tab: tab.id });
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.tabContent}>
        {loading ? (
          <div className="p-4 text-center">Loading finance data...</div>
        ) : (
          <>
            {activeSubTab === 'collections' ? renderCollections() :
             activeSubTab === 'receivables' ? renderReceivables() :
             activeSubTab === 'invoices' ? renderInvoices() :
             activeSubTab === 'receipts' ? renderReceipts() :
             activeSubTab === 'ledger' ? renderLedger() :
             renderOverview()}
          </>
        )}
      </div>
    </div>
  );
}
