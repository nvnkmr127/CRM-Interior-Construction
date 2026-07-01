import React, { useState, useEffect } from 'react';
import { Button, Badge, Modal, Input, Textarea, EmptyState, Spinner, Select } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './ChangeOrdersTab.module.css';
import {
  getChangeOrders,
  createChangeOrder,
  updateChangeOrder,
  deleteChangeOrder,
  getProject
} from '../../api/projects';

const REASON_LABELS = {
  'client-requested': 'Client Requested',
  'design-required': 'Design Required',
  'site-required': 'Site Required'
};

export default function ChangeOrdersTab({ projectId }) {
  const toast = useToast();
  const [changeOrders, setChangeOrders] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    reason: '',
    timeline_impact_days: '0',
    amount: '',
    design_cost: '0',
    material_impact: '',
    procurement_impact: ''
  });

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, projectRes] = await Promise.all([
        getChangeOrders(projectId),
        getProject(projectId)
      ]);

      if (ordersRes.data?.success) {
        setChangeOrders(ordersRes.data.data || []);
      }
      
      const projData = projectRes.data?.data || projectRes.data;
      if (projData) {
        setProject(projData);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load change orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditId(null);
    setForm({
      title: '',
      description: '',
      reason: '',
      timeline_impact_days: '0',
      amount: '',
      design_cost: '0',
      material_impact: '',
      procurement_impact: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (co) => {
    setEditId(co.id);
    setForm({
      title: co.title,
      description: co.description || '',
      reason: co.reason || '',
      timeline_impact_days: String(co.timeline_impact_days ?? 0),
      amount: String(co.amount),
      design_cost: String(co.design_cost ?? 0),
      material_impact: co.material_impact || '',
      procurement_impact: co.procurement_impact || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 0) {
      return toast.error('Valid positive amount is required');
    }
    if (form.timeline_impact_days === '' || isNaN(Number(form.timeline_impact_days))) {
      return toast.error('Timeline impact is required and must be an integer (days added or removed)');
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      reason: form.reason.trim() || null,
      timeline_impact_days: Number(form.timeline_impact_days),
      amount: Number(form.amount),
      design_cost: Number(form.design_cost) || 0,
      material_impact: form.material_impact.trim() || null,
      procurement_impact: form.procurement_impact.trim() || null
    };

    try {
      if (editId) {
        // Edit Change Order
        const res = await updateChangeOrder(projectId, editId, payload);
        if (res.data?.success) {
          toast.success('Change order updated.');
          fetchData(); // Refresh list to get items re-fetched and totals updated
          setIsModalOpen(false);
        }
      } else {
        // Create Change Order
        const res = await createChangeOrder(projectId, {
          ...payload,
          status: 'draft' // Raised as draft by default
        });

        if (res.data?.success) {
          setChangeOrders([res.data.data, ...changeOrders]);
          setIsModalOpen(false);
          toast.success('Change order raised as draft.');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(editId ? 'Failed to update change order.' : 'Failed to raise change order.');
    }
  };

  const handlePublish = async (id) => {
    if (!window.confirm('Are you sure you want to submit this change order to the client for approval?')) return;
    try {
      const res = await updateChangeOrder(projectId, id, { status: 'submitted' });
      if (res.data?.success) {
        setChangeOrders(changeOrders.map(co => co.id === id ? { ...co, status: 'submitted' } : co));
        toast.success('Change order submitted to client.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit change order.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this change order?')) return;
    try {
      const res = await deleteChangeOrder(projectId, id);
      if (res.data?.success) {
        setChangeOrders(changeOrders.filter(co => co.id !== id));
        toast.success('Change order deleted.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete change order.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      case 'submitted':
        return <Badge variant="info">Submitted / Awaiting Client</Badge>;
      case 'draft':
      default:
        return <Badge variant="warning">Draft</Badge>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="lg" />
        <p>Loading Change Orders...</p>
      </div>
    );
  }

  const allowedRevisions = project?.allowed_design_revisions ?? 3;
  const currentRevisions = project?.current_design_revisions ?? 0;
  const limitExceeded = currentRevisions >= allowedRevisions;
  const baseContractValue = Number(project?.contract_value || project?.total_amount || 0);

  return (
    <div className={styles.container}>
      {/* Revision Tracker Banner */}
      <div className={`${styles.trackerBanner} ${limitExceeded ? styles.bannerWarning : styles.bannerInfo}`}>
        <div className={styles.bannerHeader}>
          <div className={styles.bannerTitle}>
            <span className={styles.bannerIcon}>{limitExceeded ? '⚠️' : 'ℹ️'}</span>
            <h3>Design Revision Tracker</h3>
          </div>
          <div className={styles.revisionPills}>
            <span className={styles.revisionPill}>Allowed: <strong>{allowedRevisions}</strong></span>
            <span className={styles.revisionPill}>Used: <strong>{currentRevisions}</strong></span>
          </div>
        </div>
        <p className={styles.bannerText}>
          {limitExceeded
            ? `Warning: The client has used ${currentRevisions} out of ${allowedRevisions} allowed contract revisions. Any subsequent design reviews or drawing approvals will require client consent to additional terms. Please raise a Change Order below to recover commercial costs.`
            : `Client has used ${currentRevisions} out of ${allowedRevisions} contractually allowed design revisions. Once this limit is reached, warnings will trigger and you can raise commercial Change Orders.`}
        </p>
        {limitExceeded && (
          <div className={styles.bannerActions}>
            <Button variant="danger" onClick={handleOpenCreateModal}>
              Raise Change Order
            </Button>
          </div>
        )}
      </div>

      <div className={styles.header}>
        <h2>Change Orders</h2>
        <Button variant="primary" onClick={handleOpenCreateModal}>
          + Raise Change Order
        </Button>
      </div>

      {changeOrders.length === 0 ? (
        <EmptyState
          title="No Change Orders"
          description="Raise a change order when revision limits are exceeded or scope has expanded to authorize commercial recovery."
          actionLabel="Raise Change Order"
          onAction={handleOpenCreateModal}
        />
      ) : (
        <div className={styles.list}>
          {changeOrders.map(co => (
            <div key={co.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h4 className={styles.cardTitle}>{co.title}</h4>
                  <span className={styles.cardDate}>
                    Raised on {new Date(co.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className={styles.cardStatusGroup}>
                  <span className={styles.cardAmount}>{formatCurrency(co.amount)}</span>
                  {getStatusBadge(co.status)}
                </div>
              </div>
              
              {co.description && (
                <p className={styles.cardDescription}>{co.description}</p>
              )}

              {/* Reason & Timeline Grid */}
              <div className={styles.metaGrid}>
                {co.reason && (
                  <div className={styles.metaItem}>
                    Reason for Change
                    <strong>{REASON_LABELS[co.reason] || co.reason}</strong>
                  </div>
                )}
                <div className={styles.metaItem}>
                  Timeline Impact
                  <strong>{co.timeline_impact_days > 0 ? `+${co.timeline_impact_days} Days` : 'No Timeline Impact'}</strong>
                </div>
                {co.design_cost > 0 && (
                  <div className={styles.metaItem}>
                    Design Cost
                    <strong>{formatCurrency(co.design_cost)}</strong>
                  </div>
                )}
                {co.material_impact && (
                  <div className={styles.metaItem}>
                    Material Impact
                    <strong>{co.material_impact}</strong>
                  </div>
                )}
                {co.procurement_impact && (
                  <div className={styles.metaItem}>
                    Procurement Impact
                    <strong>{co.procurement_impact}</strong>
                  </div>
                )}
              </div>

              {/* Revised Cost Highlights */}
              <div className={styles.revisedCostHighlight}>
                <span>Projected Revised Contract Value:</span>
                <strong>{formatCurrency(baseContractValue + (co.status === 'approved' ? 0 : Number(co.amount)))}</strong>
              </div>

              {/* BOQ Delta Items */}
              <div className={styles.deltaSection}>
                <h5 className={styles.deltaTitle}>BOQ Scope Delta</h5>
                {!co.items || co.items.length === 0 ? (
                  <p className={styles.cardDescription} style={{ fontStyle: 'italic' }}>
                    No BOQ items linked to this change order. You can link addition/reduction items to this change order under the Quotations tab.
                  </p>
                ) : (
                  <div className={styles.deltaTableWrapper}>
                    <table className={styles.deltaTable}>
                      <thead>
                        <tr>
                          <th>Area/Room</th>
                          <th>Item Name</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                          <th>Scope Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {co.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.room_or_area || 'N/A'}</td>
                            <td>{item.item_name}</td>
                            <td>{Number(item.quantity).toFixed(2)}</td>
                            <td>{item.unit || 'Nos'}</td>
                            <td>{formatCurrency(item.unit_price)}</td>
                            <td>{formatCurrency(item.total_price)}</td>
                            <td>
                              <span className={item.scope_type === 'addition' ? styles.badgeAddition : styles.badgeReduction}>
                                {item.scope_type === 'addition' ? '+ Addition' : '- Reduction'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Client Signature details */}
              {co.status === 'approved' && co.client_signature && (
                <div className={styles.signatureSection}>
                  <span className={styles.signatureIcon}>✍️</span>
                  <div className={styles.signatureDetails}>
                    Approved via digital sign-off
                    <strong>Digitally Signed by: {co.client_signature}</strong>
                    <span>on {new Date(co.client_signed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              )}

              {/* Staff Actions */}
              {co.status === 'draft' && (
                <div className={styles.cardActions}>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(co.id)}>
                    Cancel
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(co)}>
                    Edit Details
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => handlePublish(co.id)}>
                    Submit to Client
                  </Button>
                </div>
              )}

              {co.status === 'submitted' && (
                <div className={styles.cardActions}>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(co.id)}>
                    Cancel Change Order
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Raise / Edit Change Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editId ? "Edit Change Order" : "Raise Change Order"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit}>{editId ? "Save Changes" : "Raise Change Order"}</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <Input
            label="Title"
            placeholder="e.g. Additional Revision Fee - Kitchen Layout"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            required
          />
          <Input
            label="Amount (₹)"
            type="number"
            placeholder="e.g. 5000"
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            required
          />
          <Input
            label="Timeline Impact (Days added/removed) *"
            type="number"
            placeholder="e.g. 5 or -2 (Use 0 for no impact)"
            value={form.timeline_impact_days}
            onChange={e => setForm({ ...form, timeline_impact_days: e.target.value })}
            required
          />
          <Select
            label="Reason for Change"
            placeholder="Select reason..."
            value={form.reason}
            onChange={val => setForm({ ...form, reason: val })}
            options={[
              { value: 'client-requested', label: 'Client Requested' },
              { value: 'design-required', label: 'Design Required' },
              { value: 'site-required', label: 'Site Required' }
            ]}
          />
          
          {form.reason === 'design-required' && (
            <>
              <Input
                label="Design Cost (₹)"
                type="number"
                placeholder="e.g. 2000"
                value={form.design_cost}
                onChange={e => setForm({ ...form, design_cost: e.target.value })}
              />
              <Input
                label="Material Impact"
                placeholder="e.g. Custom fabrication required for new layout"
                value={form.material_impact}
                onChange={e => setForm({ ...form, material_impact: e.target.value })}
              />
              <Input
                label="Procurement Impact"
                placeholder="e.g. Needs specialized hardware from international vendor"
                value={form.procurement_impact}
                onChange={e => setForm({ ...form, procurement_impact: e.target.value })}
              />
            </>
          )}
          
          <Textarea
            label="Description / Scope Details"
            placeholder="Describe the specific modifications and additions to be performed."
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3}
          />
        </form>
      </Modal>
    </div>
  );
}
