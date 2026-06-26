import React, { useState, useEffect } from 'react';
import { Button, Badge, Modal, Input, Textarea, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './ChangeOrdersTab.module.css';
import {
  getChangeOrders,
  createChangeOrder,
  deleteChangeOrder,
  getProject
} from '../../api/projects';

export default function ChangeOrdersTab({ projectId }) {
  const toast = useToast();
  const [changeOrders, setChangeOrders] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    amount: ''
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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 0) {
      return toast.error('Valid positive amount is required');
    }

    try {
      const res = await createChangeOrder(projectId, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        amount: Number(form.amount),
        status: 'pending'
      });

      if (res.data?.success) {
        setChangeOrders([res.data.data, ...changeOrders]);
        setIsModalOpen(false);
        setForm({ title: '', description: '', amount: '' });
        toast.success('Change order raised successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to raise change order.');
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
      default:
        return <Badge variant="warning">Pending Client Approval</Badge>;
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
            <Button variant="danger" onClick={() => setIsModalOpen(true)}>
              Raise Change Order
            </Button>
          </div>
        )}
      </div>

      <div className={styles.header}>
        <h2>Change Orders</h2>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          + Raise Change Order
        </Button>
      </div>

      {changeOrders.length === 0 ? (
        <EmptyState
          title="No Change Orders"
          description="Raise a change order when revision limits are exceeded or scope has expanded to authorize commercial recovery."
          actionLabel="Raise Change Order"
          onAction={() => setIsModalOpen(true)}
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

              {co.status === 'pending' && (
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

      {/* Raise Change Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Raise Change Order"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate}>Raise Change Order</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className={styles.modalForm}>
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
          <Textarea
            label="Description"
            placeholder="Describe the reason for the change order (e.g. client requested 4th design revision on drawings, exceeding contract terms)."
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            rows={4}
          />
        </form>
      </Modal>
    </div>
  );
}
