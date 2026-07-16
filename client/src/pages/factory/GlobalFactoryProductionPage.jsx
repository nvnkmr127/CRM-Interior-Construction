/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getGlobalProductionOrders, getGlobalCNCRequests, updateCNCRequestStatus, getCoordinationDashboard } from '../../api/projects';
import { Button, Modal, Input, Textarea, Spinner } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import styles from './GlobalFactoryProductionPage.module.css';

export default function GlobalFactoryProductionPage() {
  const toast = useToast();

  // Tab View ('orders', 'cnc', 'timeline')
  const [activeTab, setActiveTab] = useState('orders');

  // Loading States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Data States
  const [orders, setOrders] = useState([]);
  const [cncRequests, setCncRequests] = useState([]);
  const [coordinationData, setCoordinationData] = useState([]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State - Update CNC Status
  const [selectedCnc, setSelectedCnc] = useState(null);
  const [isCncModalOpen, setIsCncModalOpen] = useState(false);
  const [cncForm, setCncForm] = useState({
    status: 'completed',
    programFileName: '',
    notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'orders') {
        const res = await getGlobalProductionOrders({ search: searchQuery, status: statusFilter });
        setOrders(res.data?.data || res.data || []);
      } else if (activeTab === 'cnc') {
        const res = await getGlobalCNCRequests();
        setCncRequests(res.data?.data || res.data || []);
      } else if (activeTab === 'timeline') {
        const res = await getCoordinationDashboard();
        setCoordinationData(res.data?.data || res.data || []);
      }
    } catch (err) {
      console.error('[GlobalFactoryProductionPage] Fetch error:', err);
      toast.error('Failed to load factory production data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const openCncModal = (cnc) => {
    setSelectedCnc(cnc);
    setCncForm({
      status: cnc.status || 'completed',
      programFileName: cnc.program_file_name || '',
      notes: cnc.notes || ''
    });
    setIsCncModalOpen(true);
  };

  const handleCncUpdate = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await updateCNCRequestStatus(
        selectedCnc.project_id,
        selectedCnc.production_order_id,
        selectedCnc.id,
        {
          status: cncForm.status,
          programFileName: cncForm.programFileName,
          notes: cncForm.notes
        }
      );
      if (res.data?.success) {
        toast.success(`CNC request updated to ${cncForm.status}.`);
        setIsCncModalOpen(false);
        const updatedRes = await getGlobalCNCRequests();
        setCncRequests(updatedRes.data?.data || updatedRes.data || []);
      }
    } catch (err) {
      console.error('[GlobalFactoryProductionPage] CNC Update error:', err);
      toast.error('Failed to update CNC program request.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const calculateProgress = (order) => {
    if (!order.total_items) return 0;
    return Math.round((order.completed_items / order.total_items) * 100);
  };

  // High-level statistics
  const totalOrdersCount = orders.length;
  const activeOrdersCount = orders.filter(o => o.status === 'in_production' || o.status === 'scheduled').length;
  const completedOrdersCount = orders.filter(o => o.status === 'completed').length;
  const pendingCncCount = cncRequests.filter(c => c.status === 'pending' || c.status === 'in_progress').length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🏭 Factory Production Schedule</h1>
          <p className={styles.subtitle}>
            Unified operations panel for woodwork batches, CNC program routing, panel cutting lists, and timeline readiness sync.
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Production Batches</div>
          <div className={styles.metricValue}>{totalOrdersCount}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricBlue}`}>
          <div className={styles.metricLabel}>Active in Factory</div>
          <div className={styles.metricValue}>{activeOrdersCount}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricGreen}`}>
          <div className={styles.metricLabel}>Completed Batches</div>
          <div className={styles.metricValue}>{completedOrdersCount}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricOrange}`}>
          <div className={styles.metricLabel}>Pending CNC Programs</div>
          <div className={styles.metricValue}>{pendingCncCount}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'orders' ? styles.activeTab : ''}`}
            onClick={() => { setActiveTab('orders'); setSearchQuery(''); setStatusFilter('all'); }}
          >
            Manufacturing Schedule
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'cnc' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('cnc')}
          >
            CNC Request Portal
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'timeline' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline Coordination ({coordinationData.filter(i => i.alertType === 'factory_delay' || i.alertType === 'site_delay').length})
          </button>
        </div>

        {/* Dynamic Filters depending on Tab */}
        {activeTab === 'orders' && (
          <form onSubmit={handleSearchSubmit} className={styles.filtersForm}>
            <div className={styles.searchWrapper}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search orders, projects, factories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className={styles.statusSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_production">In Production</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Button type="submit" variant="secondary" size="sm">Search</Button>
          </form>
        )}
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className={styles.loadingSpinner}>
          <Spinner />
          <p>Loading factory schedule details...</p>
        </div>
      ) : (
        <div className={styles.content}>
          {activeTab === 'orders' && (
            orders.length === 0 ? (
              <div className={styles.noData}>No manufacturing batches scheduled matching current criteria.</div>
            ) : (
              <div className={styles.ordersGrid}>
                {orders.map(order => {
                  const progress = calculateProgress(order);
                  return (
                    <div key={order.id} className={styles.orderCard}>
                      <div className={styles.orderCardHeader}>
                        <div>
                          <span className={styles.poNumber}>{order.order_number}</span>
                          <h4 className={styles.projectName}>{order.project_name}</h4>
                        </div>
                        <span className={`${styles.badge} ${styles[`badge-${order.status}`]}`}>
                          {order.status.replace('_', ' ')}
                        </span>
                      </div>
                      
                      <div className={styles.orderDetails}>
                        <div className={styles.detailRow}>
                          <span>Factory:</span> <strong>{order.factory_name || 'Unassigned'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                          <span>PM Owner:</span> <span>{order.pm_name || 'Unassigned'}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span>Completion Target:</span> <strong>{formatDate(order.expected_completion_date)}</strong>
                        </div>
                      </div>

                      <div className={styles.progressSection}>
                        <div className={styles.progressLabel}>
                          <span>Production Progress</span>
                          <span>{progress}% ({order.completed_items}/{order.total_items} items)</span>
                        </div>
                        <div className={styles.progressBarContainer}>
                          <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      <div className={styles.cardActions}>
                        <Link to={`/projects/${order.project_id}?tab=Factory Production`} className={styles.viewLink}>
                          Manage Batches & QC →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeTab === 'cnc' && (
            cncRequests.length === 0 ? (
              <div className={styles.noData}>No CNC program requests logged.</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Request Number</th>
                      <th>Production Order</th>
                      <th>Project</th>
                      <th>Status</th>
                      <th>CNC Program Name</th>
                      <th>Requested By</th>
                      <th>Requested Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cncRequests.map(cnc => (
                      <tr key={cnc.id}>
                        <td className={styles.bold}>{cnc.request_number}</td>
                        <td>{cnc.order_number}</td>
                        <td>{cnc.project_name}</td>
                        <td>
                          <span className={`${styles.badge} ${styles[`badge-${cnc.status}`]}`}>
                            {cnc.status}
                          </span>
                        </td>
                        <td>
                          {cnc.program_file_name ? (
                            <span className={styles.programFile}>💻 {cnc.program_file_name}</span>
                          ) : (
                            <span className={styles.pendingText}>Pending Programming</span>
                          )}
                        </td>
                        <td>{cnc.designer_name || 'Designer'}</td>
                        <td>{formatDate(cnc.created_at)}</td>
                        <td>
                          <Button onClick={() => openCncModal(cnc)} variant="secondary" size="sm">
                            Update Status
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'timeline' && (
            coordinationData.length === 0 ? (
              <div className={styles.noData}>No active projects with timelines to coordinate.</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Project Name</th>
                      <th>Project Manager</th>
                      <th>Site Readiness Date</th>
                      <th>Expected Factory Finish</th>
                      <th>Timeline Status</th>
                      <th>Divergence Days</th>
                      <th>Active Batches</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coordinationData.map((item, index) => (
                      <tr key={`${item.projectId}-${index}`}>
                        <td className={styles.bold}>{item.projectName}</td>
                        <td>{item.pmName}</td>
                        <td>{formatDate(item.siteReadinessDate)}</td>
                        <td>{formatDate(item.factoryReadinessDate)}</td>
                        <td>
                          {item.alertType === 'factory_delay' && (
                            <span className={`${styles.badge} ${styles.badgeRed}`}>
                              🚨 Factory Delay (Critical Path)
                            </span>
                          )}
                          {item.alertType === 'site_delay' && (
                            <span className={`${styles.badge} ${styles.badgeOrange}`}>
                              ⚠️ Site Delay (Early Finish)
                            </span>
                          )}
                          {item.alertType === 'aligned' && (
                            <span className={`${styles.badge} ${styles.badgeGreen}`}>
                              ✓ Aligned
                            </span>
                          )}
                          {item.alertType === 'pending_setup' && (
                            <span className={`${styles.badge} ${styles.badgeGray}`}>
                              Pending Setup
                            </span>
                          )}
                        </td>
                        <td className={styles.bold}>
                          {item.alertType === 'pending_setup' || item.divergenceDays === 0
                            ? '—'
                            : `${item.divergenceDays} day(s)`}
                        </td>
                        <td>{item.activeOrdersCount} order(s)</td>
                        <td>
                          <Link to={`/projects/${item.projectId}`} className={styles.actionBtn}>
                            View Project
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}

      {/* CNC status update Modal */}
      {isCncModalOpen && (
        <Modal
          title={`Update CNC request: ${selectedCnc?.request_number}`}
          onClose={() => setIsCncModalOpen(false)}
        >
          <form onSubmit={handleCncUpdate} className={styles.cncForm}>
            <div className={styles.formGroup}>
              <label>Program Request Status</label>
              <select
                value={cncForm.status}
                onChange={(e) => setCncForm(prev => ({ ...prev, status: e.target.value }))}
                required
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed / Saved</option>
                <option value="failed">Failed / Correction Required</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>CNC Program File Name / Reference Code</label>
              <Input
                type="text"
                placeholder="e.g. kitchen_cabinet_bottom_v1.cnc"
                value={cncForm.programFileName}
                onChange={(e) => setCncForm(prev => ({ ...prev, programFileName: e.target.value }))}
              />
              <span className={styles.inputHelp}>Filename of the program uploaded to the factory CNC machine.</span>
            </div>

            <div className={styles.formGroup}>
              <label>Programming Notes / Specifications</label>
              <Textarea
                placeholder="Details of feed rate, drilling program, or corrections needed..."
                value={cncForm.notes}
                onChange={(e) => setCncForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <div className={styles.modalActions}>
              <Button type="button" variant="secondary" onClick={() => setIsCncModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={actionLoading}>
                {actionLoading ? 'Updating...' : 'Save CNC Request'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
