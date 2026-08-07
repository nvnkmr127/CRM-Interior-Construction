import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge, Input, Select } from '../../components/ui';
import styles from './FinanceDashboardPage.module.css';
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
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const subTabsRef = useRef(null);

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
      const allInvs = invRes.data?.data || invRes.data || [];
      const allRecs = recRes.data?.data || recRes.data || [];
      let allMiles = mileRes.data?.data || mileRes.data || [];

      // If mock interceptor failed to provide all milestones, try extracting from projects
      if (allMiles.length === 0) {
          allProjs.forEach(p => {
              if (p.payments) {
                  allMiles = [...allMiles, ...p.payments.map(m => ({...m, project_id: p.id}))];
              }
          });
      }

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
          pipeline += Number(p.stats?.netContractValue || p.contract_value || 0);
          billed += Number(p.stats?.totalPayment || 0);
          collected += Number(p.stats?.collectedPayment || 0);
          outstanding += Number(p.stats?.outstandingBalance || 0);
          area += Number(p.area || 0);
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

  // Filter Data
  const filteredInvoices = invoices.filter(inv => {
    const projName = projects.find(p => p.id === inv.projectId)?.name || '';
    const matchSearch = inv.id.toLowerCase().includes(searchQuery.toLowerCase()) || projName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredReceipts = receipts.filter(rec => {
    const projName = projects.find(p => p.id === rec.projectId)?.name || '';
    const matchSearch = rec.id.toLowerCase().includes(searchQuery.toLowerCase()) || projName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  // Calculate Ledger
  const ledger = [
    ...invoices.map(i => ({ type: 'Invoice', date: i.invoiceDate || i.date, ref: i.id, amount: i.amount, projectId: i.projectId, milestone: i.milestoneName, status: i.status })),
    ...receipts.map(r => ({ type: 'Receipt', date: r.receiptDate || r.date, ref: r.id, amount: r.amount, projectId: r.projectId, milestone: r.milestoneName, status: r.status }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const filteredLedger = ledger.filter(entry => {
    const projName = projects.find(p => p.id === entry.projectId)?.name || '';
    const matchSearch = entry.ref.toLowerCase().includes(searchQuery.toLowerCase()) || projName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || entry.type === statusFilter; // Can filter by Invoice/Receipt
    return matchSearch && matchStatus;
  });

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
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Project</th>
              <th>Date</th>
              <th>Milestone</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr><td colSpan="7" className={styles.emptyText}>No invoices found</td></tr>
            ) : (
              filteredInvoices.map(inv => {
                const proj = projects.find(p => p.id === inv.projectId);
                return (
                  <tr key={inv.id}>
                    <td className="fw-medium">{inv.id}</td>
                    <td>{proj?.name || 'Unknown Project'}</td>
                    <td>{new Date(inv.invoiceDate || inv.date).toLocaleDateString('en-GB')}</td>
                    <td>{inv.milestoneName || 'N/A'}</td>
                    <td>{inv.customerName || proj?.client_name || 'N/A'}</td>
                    <td className="fw-medium">₹{Number(inv.amount || 0).toLocaleString('en-IN')}</td>
                    <td>
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
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Receipt ID</th>
              <th>Project</th>
              <th>Date</th>
              <th>Milestone</th>
              <th>Payment Mode</th>
              <th>Reference</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceipts.length === 0 ? (
              <tr><td colSpan="7" className={styles.emptyText}>No receipts found</td></tr>
            ) : (
              filteredReceipts.map(rec => {
                const proj = projects.find(p => p.id === rec.projectId);
                return (
                  <tr key={rec.id}>
                    <td className="fw-medium">{rec.id}</td>
                    <td>{proj?.name || 'Unknown Project'}</td>
                    <td>{new Date(rec.receiptDate || rec.date).toLocaleDateString('en-GB')}</td>
                    <td>{rec.milestoneName || 'N/A'}</td>
                    <td>{rec.paymentMode || 'Bank Transfer'}</td>
                    <td>{rec.reference || 'N/A'}</td>
                    <td className="text-success fw-medium">₹{Number(rec.amount || 0).toLocaleString('en-IN')}</td>
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
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Project</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Milestone</th>
              <th className="text-end">Debit (₹)</th>
              <th className="text-end">Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {filteredLedger.length === 0 ? (
              <tr><td colSpan="7" className={styles.emptyText}>No ledger entries found</td></tr>
            ) : (
              filteredLedger.map((entry, idx) => {
                const proj = projects.find(p => p.id === entry.projectId);
                return (
                  <tr key={idx}>
                    <td>{new Date(entry.date).toLocaleDateString('en-GB')}</td>
                    <td>{proj?.name || 'Unknown Project'}</td>
                    <td>
                      <Badge variant={entry.type === 'Receipt' ? 'success' : 'primary'}>{entry.type}</Badge>
                    </td>
                    <td className="fw-medium">{entry.ref}</td>
                    <td>{entry.milestone || 'N/A'}</td>
                    <td className="text-end text-danger">{entry.type === 'Invoice' ? Number(entry.amount).toLocaleString('en-IN') : '-'}</td>
                    <td className="text-end text-success">{entry.type === 'Receipt' ? Number(entry.amount).toLocaleString('en-IN') : '-'}</td>
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
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Milestone</th>
                <th>Due Date</th>
                <th>Amount Due</th>
                <th>Amount Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedMilestones.length === 0 ? (
                <tr><td colSpan="6" className={styles.emptyText}>No upcoming milestones found</td></tr>
              ) : (
                sortedMilestones.map(m => {
                  const proj = projects.find(p => p.id === (m.project_id || m.projectId));
                  return (
                    <tr key={m.id}>
                      <td>{proj?.name || 'Unknown Project'}</td>
                      <td className="fw-medium">{m.name || m.milestone}</td>
                      <td>{m.due_date || m.dueDate ? new Date(m.due_date || m.dueDate).toLocaleDateString('en-GB') : 'N/A'}</td>
                      <td className="fw-medium">₹{Number(m.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="text-success">₹{Number(m.paid_amount || m.collectedAmount || 0).toLocaleString('en-IN')}</td>
                      <td>
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
        <div className={styles.financialPanel}>
          <div className={styles.financialPanelHeader}>Global Financial Overview</div>
          <div className={styles.financialGrid}>
            <div className={styles.financialCard}>
              <span className={styles.financialLabel}>Active Pipeline (Net)</span>
              <span className={styles.financialValue}>
                {formatValue(globalStats.activePipeline)}
              </span>
            </div>
            <div className={styles.financialCard}>
              <span className={styles.financialLabel}>Billed (Net)</span>
              <span className={styles.financialValue}>
                {formatValue(globalStats.totalBilled)}
              </span>
            </div>
            <div className={styles.financialCard}>
              <span className={styles.financialLabel}>Collected (Net)</span>
              <span className={styles.financialValue} style={{ color: 'var(--color-success, #22c55e)' }}>
                {formatValue(globalStats.totalCollected)}
              </span>
            </div>
            <div className={styles.financialCard}>
              <span className={styles.financialLabel}>Outstanding Balance</span>
              <span className={styles.financialValue} style={{ color: 'var(--color-accent, #3b82f6)' }}>
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
      {/* Header Section as a standard card */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            Finance Master Center
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1px', backgroundColor: 'var(--color-border)' }}>
          
          <div style={{ padding: '14px 20px', backgroundColor: 'var(--color-surface)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Pipeline Value
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: '#0284c7' }}>
              ₹{globalStats.activePipeline.toLocaleString('en-IN')}/-
            </div>
          </div>
          
          <div style={{ padding: '14px 20px', backgroundColor: 'var(--color-surface)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Global Avg. Rate
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text)' }}>
              ₹{avgRate}/sqft
            </div>
          </div>

          <div style={{ padding: '14px 20px', backgroundColor: 'var(--color-surface)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Area
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text)' }}>
              {globalStats.totalArea.toLocaleString('en-IN')} sqft
            </div>
          </div>

          <div style={{ padding: '14px 20px', backgroundColor: 'var(--color-surface)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Outstanding Balance
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: '#eab308' }}>
              ₹{globalStats.totalOutstanding > 0 ? globalStats.totalOutstanding.toLocaleString('en-IN') : 0}
            </div>
          </div>

        </div>
      </div>

      {/* Sub-Tabs */}
      <div className={styles.subTabsContainer} ref={subTabsRef}>
        {['overview', 'collections', 'invoices', 'receipts', 'ledger', 'receivables', 'approvals'].map(tab => (
          <button
            key={tab}
            className={`${styles.subTab} ${activeSubTab === tab ? styles.subTabActive : ''}`}
            onClick={() => {
              // reset filters on tab change
              setSearchQuery('');
              setStatusFilter('ALL');

              if (tab === 'approvals') {
                navigate('/financial-approvals');
              } else {
                setActiveSubTab(tab);
              }
            }}
          >
            {tab === 'overview' ? 'Overview' :
             tab === 'collections' ? 'Collections' :
             tab === 'receivables' ? 'AR Aging' :
             tab === 'invoices' ? 'Global Invoices' :
             tab === 'receipts' ? 'Global Receipts' :
             tab === 'ledger' ? 'Master Ledger' :
             'Financial Approvals'}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {loading ? (
          <div className="p-4 text-center">Loading finance data...</div>
        ) : (
          <>
            {activeSubTab === 'overview' && renderOverview()}
            {activeSubTab === 'collections' && renderCollections()}
            {activeSubTab === 'receivables' && renderReceivables()}
            {activeSubTab === 'invoices' && renderInvoices()}
            {activeSubTab === 'receipts' && renderReceipts()}
            {activeSubTab === 'ledger' && renderLedger()}
          </>
        )}
      </div>
    </div>
  );
}
