import React, { useState, useEffect } from 'react';
import styles from './ServiceTicketsTab.module.css';
import {
  getServiceTickets,
  createServiceTicket,
  updateServiceTicket,
  scheduleServiceVisit,
  updateServiceVisit,
  getCsatMetrics,
  addServiceTicketPart,
  removeServiceTicketPart
} from '../../api/handover';
import { usersApi } from '../../api/users';
import { Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';

export default function ServiceTicketsTab({ projectId }) {
  const toast = useToast();

  const [tickets, setTickets] = useState([]);
  const [csatMetrics, setCsatMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState(null);

  // Form states for creating a ticket
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Installation');
  const [affectedItem, setAffectedItem] = useState('');
  const [priority, setPriority] = useState('medium');
  const [warrantyEligibility, setWarrantyEligibility] = useState('checking');
  const [assignedEngineerId, setAssignedEngineerId] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // Form states for scheduling a visit
  const [visitDate, setVisitDate] = useState('');
  const [visitSummary, setVisitSummary] = useState('');
  const [visitEngineerId, setVisitEngineerId] = useState('');
  const [submittingVisit, setSubmittingVisit] = useState(false);

  // Form states for completing a ticket / visit
  const [resolutionDetails, setResolutionDetails] = useState('');
  const [visitOutcome, setVisitOutcome] = useState('');
  const [submittingResolution, setSubmittingResolution] = useState(false);

  // Form states for adding parts
  const [partName, setPartName] = useState('');
  const [partQuantity, setPartQuantity] = useState(1);
  const [partCost, setPartCost] = useState('');
  const [submittingPart, setSubmittingPart] = useState(false);

  // Form states for classification
  const [classificationEligibility, setClassificationEligibility] = useState('');
  const [chargeableEstimate, setChargeableEstimate] = useState('');
  const [submittingClassification, setSubmittingClassification] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ticketsList, metrics, usersList] = await Promise.all([
        getServiceTickets(projectId),
        getCsatMetrics(projectId),
        usersApi.getAll()
      ]);
      setTickets(ticketsList || []);
      setCsatMetrics(metrics || null);
      setUsers(usersList || []);
    } catch (err) {
      console.error('[ServiceTicketsTab] Load error:', err);
      toast.error('Failed to load support tickets data.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClassification = async (ticketId) => {
    try {
      setSubmittingClassification(true);
      await updateServiceTicket(projectId, ticketId, {
        warranty_eligibility: classificationEligibility,
        chargeable_estimate: classificationEligibility === 'chargeable' ? (parseFloat(chargeableEstimate) || null) : null
      });
      toast.success('Classification updated successfully.');
      await loadData();
    } catch (err) {
      console.error('Update classification error:', err);
      toast.error(err.response?.data?.message || 'Failed to update classification.');
    } finally {
      setSubmittingClassification(false);
    }
  };

  const handleApproveEstimate = async (ticketId, action) => {
    try {
      setSubmittingClassification(true);
      await updateServiceTicket(projectId, ticketId, {
        chargeable_estimate_status: action
      });
      toast.success(`Estimate ${action} successfully.`);
      await loadData();
    } catch (err) {
      console.error('Approve estimate error:', err);
      toast.error('Failed to update estimate status.');
    } finally {
      setSubmittingClassification(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning('Please enter a ticket title.');
      return;
    }

    try {
      setSubmittingTicket(true);
      const res = await createServiceTicket(projectId, {
        title,
        description: description || null,
        category,
        affectedItem: affectedItem || null,
        priority,
        warrantyEligibility,
        assignedEngineerId: assignedEngineerId || null
      });
      toast.success('Support ticket raised successfully.');
      setTitle('');
      setDescription('');
      setAffectedItem('');
      setCategory('Installation');
      setPriority('medium');
      setWarrantyEligibility('checking');
      setAssignedEngineerId('');
      await loadData();
    } catch (err) {
      console.error('[ServiceTicketsTab] Create ticket error:', err);
      toast.error(err.response?.data?.message || 'Failed to raise support ticket.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleScheduleVisit = async (ticketId) => {
    if (!visitDate) {
      toast.warning('Please select a visit date and time.');
      return;
    }

    try {
      setSubmittingVisit(true);
      await scheduleServiceVisit(projectId, ticketId, {
        scheduledDate: new Date(visitDate).toISOString(),
        engineerId: visitEngineerId || null,
        visitSummary: visitSummary || null
      });
      toast.success('Service visit scheduled successfully.');
      setVisitDate('');
      setVisitSummary('');
      setVisitEngineerId('');
      await loadData();
    } catch (err) {
      console.error('[ServiceTicketsTab] Schedule visit error:', err);
      toast.error(err.response?.data?.message || 'Failed to schedule visit.');
    } finally {
      setSubmittingVisit(false);
    }
  };

  const handleAddPart = async (ticketId) => {
    if (!partName.trim()) {
      toast.warning('Please enter a part name.');
      return;
    }
    try {
      setSubmittingPart(true);
      await addServiceTicketPart(projectId, ticketId, {
        partName,
        quantity: parseInt(partQuantity, 10),
        cost: partCost ? parseFloat(partCost) : null
      });
      toast.success('Part added successfully.');
      setPartName('');
      setPartQuantity(1);
      setPartCost('');
      await loadData();
    } catch (err) {
      console.error('[ServiceTicketsTab] Add part error:', err);
      toast.error('Failed to add part.');
    } finally {
      setSubmittingPart(false);
    }
  };

  const handleRemovePart = async (ticketId, partId) => {
    if (!window.confirm('Remove this part?')) return;
    try {
      await removeServiceTicketPart(projectId, ticketId, partId);
      toast.success('Part removed.');
      await loadData();
    } catch (err) {
      console.error('[ServiceTicketsTab] Remove part error:', err);
      toast.error('Failed to remove part.');
    }
  };

  const handleResolveTicket = async (ticket) => {
    if (!resolutionDetails.trim()) {
      toast.warning('Please enter resolution details.');
      return;
    }

    try {
      setSubmittingResolution(true);

      // 1. If there's a scheduled visit, mark it completed first
      const scheduledVisit = ticket.visits?.find(v => v.status === 'scheduled');
      if (scheduledVisit) {
        await updateServiceVisit(projectId, ticket.id, scheduledVisit.id, {
          status: 'completed',
          completedDate: new Date().toISOString(),
          clientConfirmed: true,
          visitOutcome: visitOutcome || 'Issue resolved by engineer.'
        });
      }

      // 2. Resolve the ticket
      await updateServiceTicket(projectId, ticket.id, {
        status: 'resolved',
        resolutionDetails,
        resolvedAt: new Date().toISOString()
      });

      toast.success('Service ticket resolved successfully.');
      setResolutionDetails('');
      setVisitOutcome('');
      await loadData();
    } catch (err) {
      console.error('[ServiceTicketsTab] Resolve ticket error:', err);
      toast.error(err.response?.data?.message || 'Failed to resolve ticket.');
    } finally {
      setSubmittingResolution(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading post-sales support tickets...</div>;
  }

  const activeTickets = tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length;
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Post-Sales Service Tickets</h2>
          <p className={styles.subtitle}>Manage warranty service tickets, technician visits, and resolution SLA tracking.</p>
        </div>
      </div>

      {/* Metrics Header */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Active Tickets</div>
          <div className={styles.metricValue}>{activeTickets}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Resolved / Closed</div>
          <div className={styles.metricValue}>{resolvedTickets}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Average Resolution SLA</div>
          <div className={styles.metricValue}>
            {csatMetrics?.average_resolution_hours ? `${Math.round(csatMetrics.average_resolution_hours)} hrs` : 'N/A'}
          </div>
        </div>
      </div>

      <div className={styles.ticketGrid}>
        {/* Left Side: Tickets List */}
        <div className={styles.ticketsListSection}>
          <h3 className={styles.listHeader}>Raised Tickets ({tickets.length})</h3>
          {tickets.length === 0 ? (
            <div className={styles.emptyState}>No service tickets raised for this project yet.</div>
          ) : (
            tickets.map(ticket => {
              const isExpanded = expandedTicketId === ticket.id;
              return (
                <div key={ticket.id} className={styles.ticketCard}>
                  <div
                    className={styles.ticketCardHeader}
                    onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                  >
                    <div className={styles.ticketPrimary}>
                      <span className={styles.ticketTitle}>
                        {ticket.title}
                        {ticket.is_repeat_complaint && (
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#ef4444', color: 'white', fontWeight: 700, marginLeft: '8px' }}>
                            REPEAT COMPLAINT
                          </span>
                        )}
                        <span className={`${styles.badge} ${styles['priority_' + ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                        <span className={`${styles.badge} ${styles['status_' + ticket.status]}`}>
                          {ticket.status}
                        </span>
                      </span>
                      <div className={styles.ticketMeta}>
                        <span>Category: <strong>{ticket.category}</strong></span>
                        {ticket.affected_item && <span>Item: <strong>{ticket.affected_item}</strong></span>}
                        <span>Warranty: <strong>{ticket.warranty_eligibility}</strong></span>
                        <span>Assigned to: <strong>{ticket.engineer_name || 'Unassigned'}</strong></span>
                        {(ticket.first_response_due_date || ticket.resolution_due_date || ticket.due_date) && (
                          <div style={{ marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {(ticket.first_response_due_date) && (
                              <span style={{ fontSize: '10px', color: (new Date() > new Date(ticket.first_response_due_date) && !ticket.first_responded_at && ticket.status === 'open') ? '#ef4444' : 'var(--color-text-secondary)' }}>
                                1st Response Due: {new Date(ticket.first_response_due_date).toLocaleString()}
                                {(new Date() > new Date(ticket.first_response_due_date) && !ticket.first_responded_at && ticket.status === 'open') && ' (Breached!)'}
                              </span>
                            )}
                            {(ticket.resolution_due_date || ticket.due_date) && (
                              <span style={{ fontSize: '10px', color: (new Date() > new Date(ticket.resolution_due_date || ticket.due_date) && ticket.status !== 'resolved' && ticket.status !== 'closed') ? '#ef4444' : 'var(--color-text-secondary)' }}>
                                Resolution Due: {new Date(ticket.resolution_due_date || ticket.due_date).toLocaleString()}
                                {(new Date() > new Date(ticket.resolution_due_date || ticket.due_date) && ticket.status !== 'resolved' && ticket.status !== 'closed') && ' (Breached!)'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <span>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className={styles.ticketDetails}>
                      {/* Ticket Description */}
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Description</span>
                        <span className={styles.detailText}>{ticket.description || 'No description provided.'}</span>
                      </div>

                      {/* Resolution Log (if resolved) */}
                      {ticket.status === 'resolved' && (
                        <div className={styles.detailRow} style={{ background: '#ecfdf5', padding: '12px', borderRadius: '8px', border: '1px solid #10b981' }}>
                          <span className={styles.detailLabel} style={{ color: '#047857' }}>Resolution details</span>
                          <span className={styles.detailText}><strong>{ticket.resolution_details}</strong></span>
                          {ticket.resolved_at && <span style={{ fontSize: '10px', color: '#047857' }}>Resolved at: {new Date(ticket.resolved_at).toLocaleString()}</span>}
                        </div>
                      )}

                      {/* Classification Section */}
                      <div className={styles.visitsSection} style={{ marginTop: '16px' }}>
                        <h4 className={styles.visitsTitle}>Service Classification</h4>
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                              <label className={styles.label} style={{ fontSize: '10px' }}>Warranty Status</label>
                              <select 
                                className={styles.select}
                                value={classificationEligibility || ticket.warranty_eligibility}
                                onChange={(e) => {
                                  setClassificationEligibility(e.target.value);
                                  if (e.target.value !== 'chargeable') {
                                    setChargeableEstimate('');
                                  } else if (ticket.chargeable_estimate) {
                                    setChargeableEstimate(ticket.chargeable_estimate);
                                  }
                                }}
                              >
                                <option value="checking">Checking / Reviewing</option>
                                <option value="eligible">Eligible (Under Warranty)</option>
                                <option value="chargeable">Chargeable (Out of Warranty)</option>
                                <option value="not_eligible">Not Eligible</option>
                              </select>
                            </div>
                            {(classificationEligibility === 'chargeable' || (ticket.warranty_eligibility === 'chargeable' && !classificationEligibility)) && (
                              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                <label className={styles.label} style={{ fontSize: '10px' }}>Chargeable Estimate (₹)</label>
                                <input 
                                  type="number" 
                                  className={styles.input} 
                                  placeholder="e.g. 5000"
                                  value={chargeableEstimate !== '' ? chargeableEstimate : (ticket.chargeable_estimate || '')}
                                  onChange={(e) => setChargeableEstimate(e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                          <Button 
                            variant="secondary" 
                            onClick={() => handleUpdateClassification(ticket.id)}
                            disabled={submittingClassification}
                          >
                            {submittingClassification ? 'Saving...' : 'Update Classification'}
                          </Button>

                          {ticket.warranty_eligibility === 'chargeable' && ticket.chargeable_estimate_status === 'pending_approval' && (
                            <div style={{ marginTop: '8px', padding: '12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: '#92400e' }}>
                                Client Approval Pending for <strong>₹{ticket.chargeable_estimate}</strong>
                              </span>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <Button variant="secondary" onClick={() => handleApproveEstimate(ticket.id, 'rejected')} disabled={submittingClassification}>Reject</Button>
                                <Button variant="primary" onClick={() => handleApproveEstimate(ticket.id, 'approved')} disabled={submittingClassification}>Approve</Button>
                              </div>
                            </div>
                          )}
                          {ticket.warranty_eligibility === 'chargeable' && ticket.chargeable_estimate_status === 'approved' && (
                            <div style={{ marginTop: '8px', padding: '8px', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '6px', fontSize: '12px', color: '#047857' }}>
                              Estimate of ₹{ticket.chargeable_estimate} was <strong>Approved</strong>.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Parts Used */}
                      <div className={styles.visitsSection} style={{ marginTop: '16px' }}>
                        <h4 className={styles.visitsTitle}>Parts Used</h4>
                        {(!ticket.parts_used || ticket.parts_used.length === 0) ? (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No parts logged.</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {ticket.parts_used.map(part => (
                              <div key={part.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '12px' }}>
                                <div>
                                  <strong>{part.part_name}</strong> (x{part.quantity})
                                  {part.cost != null && <span style={{ marginLeft: '8px', color: 'var(--color-text-secondary)' }}>Cost: ₹{part.cost}</span>}
                                </div>
                                {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                                  <span style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleRemovePart(ticket.id, part.id)}>Remove</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Scheduled Visits */}
                      <div className={styles.visitsSection}>
                        <h4 className={styles.visitsTitle}>Technician Service Visits</h4>
                        {(!ticket.visits || ticket.visits.length === 0) ? (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No visits scheduled yet.</span>
                        ) : (
                          <div className={styles.visitsList}>
                            {ticket.visits.map(visit => (
                              <div key={visit.id} className={styles.visitItem}>
                                <div className={styles.visitInfo}>
                                  <span className={styles.visitDate}>
                                    📅 {new Date(visit.scheduled_date).toLocaleString()}
                                  </span>
                                  {visit.visit_summary && <span style={{ color: 'var(--color-text-secondary)' }}>{visit.visit_summary}</span>}
                                  {visit.visit_outcome && <span className={styles.visitOutcome}>Outcome: {visit.visit_outcome}</span>}
                                </div>
                                <span className={`${styles.badge} ${visit.status === 'completed' ? styles.status_resolved : styles.status_scheduled}`}>
                                  {visit.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions for Active Tickets */}
                      {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                          
                          {ticket.warranty_eligibility === 'chargeable' && ticket.chargeable_estimate_status === 'pending_approval' ? (
                            <div style={{ padding: '16px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '8px', color: '#b45309' }}>
                                <strong>Estimate Pending Approval:</strong> Client must approve the estimate of ₹{ticket.chargeable_estimate} before service actions can begin.
                            </div>
                          ) : (
                            <>
                              {/* Schedule Visit Form */}
                              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>Schedule Service Visit</span>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  <div className={styles.formGroup}>
                                    <label className={styles.label}>Scheduled Date & Time</label>
                                    <input
                                      type="datetime-local"
                                      className={styles.input}
                                      value={visitDate}
                                      onChange={(e) => setVisitDate(e.target.value)}
                                    />
                                  </div>
                                  <div className={styles.formGroup}>
                                    <label className={styles.label}>Technician Engineer</label>
                                    <select
                                      className={styles.select}
                                      value={visitEngineerId}
                                      onChange={(e) => setVisitEngineerId(e.target.value)}
                                    >
                                      <option value="">Select Technician...</option>
                                      {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                
                                <div className={styles.formGroup}>
                                  <label className={styles.label}>Visit Instructions</label>
                                  <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Instructions for technician..."
                                    value={visitSummary}
                                    onChange={(e) => setVisitSummary(e.target.value)}
                                  />
                                </div>

                                <Button
                                  variant="secondary"
                                  onClick={() => handleScheduleVisit(ticket.id)}
                                  disabled={submittingVisit}
                                >
                                  {submittingVisit ? 'Scheduling...' : 'Schedule Visit'}
                                </Button>
                              </div>

                              {/* Add Parts Form */}
                              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>Log Parts Used</span>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                    <label className={styles.label} style={{ fontSize: '10px' }}>Part Name</label>
                                    <input type="text" className={styles.input} value={partName} onChange={e => setPartName(e.target.value)} placeholder="e.g. Door Hinge" />
                                  </div>
                                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                    <label className={styles.label} style={{ fontSize: '10px' }}>Qty</label>
                                    <input type="number" min="1" className={styles.input} value={partQuantity} onChange={e => setPartQuantity(e.target.value)} />
                                  </div>
                                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                    <label className={styles.label} style={{ fontSize: '10px' }}>Cost (₹)</label>
                                    <input type="number" min="0" className={styles.input} value={partCost} onChange={e => setPartCost(e.target.value)} placeholder="Opt" />
                                  </div>
                                  <Button variant="secondary" onClick={() => handleAddPart(ticket.id)} disabled={submittingPart}>
                                    Add Part
                                  </Button>
                                </div>
                              </div>

                              {/* Complete Ticket Form */}
                              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>Resolve Service Ticket</span>
                                
                                <div className={styles.formGroup}>
                                  <label className={styles.label}>Visit Outcome Notes</label>
                                  <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Outcome details (e.g. replaced pipes)"
                                    value={visitOutcome}
                                    onChange={(e) => setVisitOutcome(e.target.value)}
                                  />
                                </div>

                                <div className={styles.formGroup}>
                                  <label className={styles.label}>Resolution Summary</label>
                                  <textarea
                                    className={styles.textarea}
                                    placeholder="Summary of resolution for client confirmation..."
                                    value={resolutionDetails}
                                    onChange={(e) => setResolutionDetails(e.target.value)}
                                  />
                                </div>

                                <Button
                                  variant="primary"
                                  onClick={() => handleResolveTicket(ticket)}
                                  disabled={submittingResolution}
                                >
                                  {submittingResolution ? 'Resolving...' : 'Resolve Ticket & Complete'}
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Raise Support Ticket Form */}
        <form onSubmit={handleCreateTicket} className={styles.createFormSection}>
          <h3 className={styles.formTitle}>Raise Support Ticket</h3>

          <div className={styles.formGroup}>
            <label className={styles.label}>Ticket Title</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. Scratched door cabinet hinge leaking"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Support Category</label>
            <select
              className={styles.select}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Installation">Installation & Fitout</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Electrical">Electrical</option>
              <option value="Hardware">Hardware & Fittings</option>
              <option value="Modular Furniture">Modular Woodwork</option>
              <option value="General">General / Others</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Affected Item (For Repeat Tracking)</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. Master Bedroom Wardrobe Hinge"
              value={affectedItem}
              onChange={(e) => setAffectedItem(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Severity / Priority</label>
            <select
              className={styles.select}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low (Standard maintenance check)</option>
              <option value="medium">Medium (General issue)</option>
              <option value="high">High (Affects usability)</option>
              <option value="critical">Critical (Immediate leak / risk)</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Warranty Status</label>
            <select
              className={styles.select}
              value={warrantyEligibility}
              onChange={(e) => setWarrantyEligibility(e.target.value)}
            >
              <option value="checking">Checking / Reviewing</option>
              <option value="eligible">Eligible (Under Warranty)</option>
              <option value="chargeable">Chargeable (Out of Warranty)</option>
              <option value="not_eligible">Not Eligible</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Assign Support Engineer</label>
            <select
              className={styles.select}
              value={assignedEngineerId}
              onChange={(e) => setAssignedEngineerId(e.target.value)}
            >
              <option value="">Select Engineer...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Complaint Description</label>
            <textarea
              className={styles.textarea}
              placeholder="Describe issue in detail for support team..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={submittingTicket}
          >
            {submittingTicket ? 'Raising Ticket...' : 'File Support Ticket'}
          </Button>
        </form>
      </div>
    </div>
  );
}
