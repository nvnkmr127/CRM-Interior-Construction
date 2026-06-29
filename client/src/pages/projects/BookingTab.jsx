import React, { useState, useEffect } from 'react';
import styles from './BookingTab.module.css';
import { getProjectBooking, confirmProjectBooking } from '../../api/projects';
import { Button, Input, Select } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import { useS3Upload } from '../../hooks/useS3Upload';
import api from '../../api/axios';

const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Credit/Debit Card' },
  { id: 'upi', label: 'UPI / Digital Wallet' },
  { id: 'cheque', label: 'Cheque' }
];

export default function BookingTab({ projectId, projectStatus, onProjectUpdated }) {
  const toast = useToast();
  const { uploadContract, uploading, progress } = useS3Upload();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [designers, setDesigners] = useState([]);
  
  // Form fields
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [scopeSummary, setScopeSummary] = useState('');
  const [designFreezeDate, setDesignFreezeDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [assignedDesigner, setAssignedDesigner] = useState('');
  const [contractFile, setContractFile] = useState(null);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const res = await getProjectBooking(projectId);
      const data = res.data?.data || res.data;
      if (data) {
        setBooking(data);
      } else {
        setBooking(null);
        // Pre-populate with existing project values if any
        const projRes = await api.get(`/projects/${projectId}`);
        const proj = projRes.data?.data || projRes.data;
        if (proj) {
          if (proj.booking_amount) setAdvanceAmount(Math.round(proj.booking_amount).toString());
          if (proj.start_date) setStartDate(proj.start_date.split('T')[0]);
          if (proj.designer_id) setAssignedDesigner(proj.designer_id);
        }
      }
    } catch (err) {
      console.error('[BookingTab] Failed to fetch booking details', err);
      toast.error('Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  };

  const loadDesigners = async () => {
    try {
      const res = await api.get('/users?limit=100');
      const users = res.data?.data || res.data || [];
      // Filter for designers/PMs/admins
      const filtered = users.filter(u => 
        ['designer', 'admin', 'pm', 'general_manager', 'gm'].includes(String(u.role_name).toLowerCase())
      );
      setDesigners(filtered);
    } catch (err) {
      console.error('[BookingTab] Failed to load designers list', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadBooking();
      loadDesigners();
    }
  }, [projectId]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setContractFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!advanceAmount || Number(advanceAmount) < 0) {
      toast.error('Please enter a valid advance amount.');
      return;
    }
    if (!paymentMethod) {
      toast.error('Please select a payment method.');
      return;
    }
    if (!scopeSummary.trim()) {
      toast.error('Please write an agreed scope summary.');
      return;
    }
    if (!designFreezeDate) {
      toast.error('Please select a target design freeze date.');
      return;
    }
    if (!startDate) {
      toast.error('Please select a project start date.');
      return;
    }
    if (!assignedDesigner) {
      toast.error('Please assign a designer.');
      return;
    }

    try {
      setSubmitting(true);

      let agreementDetails = {};
      if (contractFile) {
        toast.info('Uploading signed agreement file...');
        agreementDetails = await uploadContract({ file: contractFile });
      }

      const payload = {
        advance_amount: Number(advanceAmount),
        payment_method: paymentMethod,
        agreed_scope_summary: scopeSummary,
        design_freeze_target_date: designFreezeDate,
        project_start_date: startDate,
        assigned_designer_id: assignedDesigner,
        agreement_file_key: agreementDetails.storageKey || null,
        agreement_file_name: agreementDetails.fileName || null,
        agreement_file_size: agreementDetails.fileSize || null,
        agreement_file_mime: agreementDetails.mimeType || null
      };

      await confirmProjectBooking(projectId, payload);
      toast.success('Booking confirmed! Project is now active.');
      
      // Reload booking and notify project details parent to refresh
      await loadBooking();
      if (onProjectUpdated) {
        onProjectUpdated();
      }
    } catch (err) {
      console.error('[BookingTab] Booking confirmation failed', err);
      toast.error(err.response?.data?.error?.message || 'Failed to confirm booking.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading booking commitment data...</div>;
  }

  // Helper to format dates
  const formatDate = (dStr) => {
    if (!dStr) return '—';
    return new Date(dStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Helper to format currency
  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  // Helper to format clean text
  const capitalizeText = (str) => {
    if (!str) return '—';
    return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // 1. Readonly View (Booking already confirmed)
  if (booking) {
    return (
      <div className={styles.container}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>Booking Confirmation Record</h2>
          <p className={styles.subtitle}>Recorded commercial commitment baseline for this project.</p>
        </div>

        <div className={styles.successPanel}>
          <span className={styles.successIcon}>✓</span>
          <div>
            <h3 className={styles.successTitle}>Commercial Booking Locked</h3>
            <p className={styles.successDesc}>
              This project is fully confirmed and active. Confirmed by <strong>{booking.confirmed_by_name || 'System'}</strong> on {formatDate(booking.confirmed_at)}.
            </p>
          </div>
        </div>

        <div className={styles.formCard}>
          <div className={styles.cardHeader}>Commitment Summary</div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCell}>
              <div className={styles.summaryLabel}>Advance Amount Collected</div>
              <div className={styles.summaryValue}>{formatCurrency(booking.advance_amount)}</div>
            </div>
            <div className={styles.summaryCell}>
              <div className={styles.summaryLabel}>Payment Method</div>
              <div className={styles.summaryValue}>{capitalizeText(booking.payment_method)}</div>
            </div>
            <div className={styles.summaryCell}>
              <div className={styles.summaryLabel}>Project Start Date</div>
              <div className={styles.summaryValue}>{formatDate(booking.project_start_date)}</div>
            </div>
            <div className={styles.summaryCell}>
              <div className={styles.summaryLabel}>Design Freeze Target</div>
              <div className={styles.summaryValue}>{formatDate(booking.design_freeze_target_date)}</div>
            </div>
            <div className={styles.summaryCell}>
              <div className={styles.summaryLabel}>Assigned Designer</div>
              <div className={styles.summaryValue}>{booking.designer_name || 'Unassigned'}</div>
            </div>
            <div className={styles.summaryCell}>
              <div className={styles.summaryLabel}>Signed Agreement File</div>
              <div className={styles.summaryValue}>
                {booking.agreement_file_key ? (
                  <a 
                    href={`/api/local-download?key=${booking.agreement_file_key}`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={styles.agreementLink}
                  >
                    📄 Open Signed Agreement ({booking.agreement_file_name || 'document.pdf'})
                  </a>
                ) : (
                  <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No document uploaded</span>
                )}
              </div>
            </div>
            <div className={styles.summaryCellFull}>
              <div className={styles.summaryLabel}>Agreed Scope Summary</div>
              <div className={styles.summaryValue} style={{ whiteSpace: 'pre-wrap' }}>
                {booking.agreed_scope_summary || '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Interactive Form View (Booking pending confirmation)
  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>Confirm Commercial Booking</h2>
        <p className={styles.subtitle}>Enter the baseline commitment values to activate this project.</p>
      </div>

      <div className={styles.warningBanner}>
        <span className={styles.warningIcon}>⚠</span>
        <div>
          <p className={styles.warningText}>
            <strong>Booking Confirmation Required:</strong> Downstream operations (tasks, milestones, budgets, procurement orders) are locked until booking details are submitted.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.formCard}>
        <div className={styles.cardHeader}>Commercial & Scheduling Details</div>
        
        <div className={styles.cardBody}>
          <div className={styles.formGrid}>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>Advance Amount Collected (₹)</label>
              <Input
                type="number"
                placeholder="e.g. 50000"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Payment Method</label>
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={PAYMENT_METHODS}
                placeholder="Select payment method"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Project Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Design Freeze Target Date</label>
              <Input
                type="date"
                value={designFreezeDate}
                onChange={(e) => setDesignFreezeDate(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Assigned Designer</label>
              <Select
                value={assignedDesigner}
                onChange={(e) => setAssignedDesigner(e.target.value)}
                options={designers.map(u => ({ id: u.id, label: `${u.name} (${capitalizeText(u.role_name)})` }))}
                placeholder="Assign designer"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Signed Agreement (PDF/Image)</label>
              {!contractFile ? (
                <div className={styles.fileUploadArea} onClick={() => document.getElementById('contract-upload-input').click()}>
                  <input
                    id="contract-upload-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: 24 }}>📤</span>
                  <span className={styles.fileUploadText}>Click to browse and upload signed agreement</span>
                  <span className={styles.fileUploadSubtext}>Accepts PDF, PNG, JPG (Max 5MB)</span>
                </div>
              ) : (
                <div className={styles.fileSelectedInfo}>
                  <span>📄 {contractFile.name} ({(contractFile.size / 1024).toFixed(1)} KB)</span>
                  <button type="button" onClick={() => setContractFile(null)} className={styles.removeFileBtn}>
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className={styles.formGroupFull}>
              <label className={styles.label}>Agreed Scope Summary</label>
              <textarea
                className={styles.textarea}
                placeholder="Summarize the core rooms, materials, or inclusions agreed upon (e.g., modular kitchen with acrylic finishes, master bedroom wardrobe, living room wallpaper)."
                value={scopeSummary}
                onChange={(e) => setScopeSummary(e.target.value)}
                required
              />
            </div>

          </div>
        </div>

        {uploading && (
          <div style={{ padding: '0 24px 12px 24px', fontSize: 'var(--text-xs)', color: 'var(--color-accent)' }}>
            Uploading contract... {progress}%
          </div>
        )}

        <div className={styles.submitBtnArea}>
          <Button 
            type="submit" 
            variant="primary" 
            disabled={submitting || uploading}
          >
            {submitting ? 'Confirming Booking...' : 'Confirm Commercial Booking'}
          </Button>
        </div>
      </form>
    </div>
  );
}
