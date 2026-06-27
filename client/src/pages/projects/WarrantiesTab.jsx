import React, { useState, useEffect, useMemo } from 'react';
import styles from './WarrantiesTab.module.css';
import { Button, Input, Modal, FormField, Textarea } from '../../components/ui';
import { getWarranties, createWarranty, updateWarranty, deleteWarranty } from '../../api/warranties';
import { getHandoverChecklist } from '../../api/handover';
import { getClaims, createClaim, updateClaim, deleteClaim } from '../../api/warrantyClaims';
import { usersApi } from '../../api/users';
import { useToast } from '../../store/toastContext';

export default function WarrantiesTab({ projectId }) {
  const toast = useToast();
  const [warranties, setWarranties] = useState([]);
  const [handoverItems, setHandoverItems] = useState([]);
  const [claims, setClaims] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimsLoading, setClaimsLoading] = useState(true);
  
  // Filters & Search
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Form States (Warranty)
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [formData, setFormData] = useState({
    productName: '',
    serialNumber: '',
    brand: '',
    brandWarrantyMonths: 12,
    companyWarrantyMonths: 12,
    startDate: '',
    endDate: '',
    warrantyDocument: '',
    notes: '',
    handoverItemId: '',
    // Vendor pass-through details
    productCategory: 'general',
    vendorName: '',
    vendorContact: '',
    vendorWarrantyMonths: 0,
    vendorClaimProcedure: ''
  });

  // Modals & Form States (Claims)
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState(null);
  
  const [claimForm, setClaimForm] = useState({
    warrantyId: '',
    natureOfDefect: '',
    claimDate: ''
  });

  const [reviewForm, setReviewForm] = useState({
    eligibilityDecision: 'pending',
    eligibilityReason: '',
    assignedTechnicianId: '',
    status: 'open',
    resolutionDetails: ''
  });

  const getDownloadUrl = (key) => {
    const base = import.meta.env.VITE_API_URL || '';
    return `${base}/api/local-download?key=${encodeURIComponent(key)}`;
  };

  const fetchWarranties = () => {
    setLoading(true);
    getWarranties(projectId)
      .then(res => {
        setWarranties(res.data?.data || res.data || []);
      })
      .catch(err => {
        console.error('Failed to fetch warranties:', err);
        setWarranties([]);
      })
      .finally(() => setLoading(false));
  };

  const fetchClaims = () => {
    setClaimsLoading(true);
    getClaims(projectId)
      .then(res => {
        setClaims(res.data?.data || res.data || []);
      })
      .catch(err => {
        console.error('Failed to fetch claims:', err);
        setClaims([]);
      })
      .finally(() => setClaimsLoading(false));
  };

  useEffect(() => {
    if (!projectId) return;
    fetchWarranties();
    fetchClaims();

    // Fetch handover document-type checklist items to link them optionally
    getHandoverChecklist(projectId)
      .then(checklist => {
        if (checklist && checklist.items) {
          const documentItems = checklist.items.filter(item => item.item_type === 'document');
          setHandoverItems(documentItems);
        }
      })
      .catch(() => setHandoverItems([]));

    // Fetch staff list for technician assignment
    usersApi.getAll({ status: 'active' })
      .then(res => {
        setStaffList(res.data?.data || res.data || []);
      })
      .catch(() => setStaffList([]));
  }, [projectId]);

  // Compute metrics
  const metrics = useMemo(() => {
    const stats = { total: warranties.length, active: 0, expired: 0, voided: 0 };
    warranties.forEach(w => {
      const status = w.eligibility_status;
      if (status === 'active') stats.active++;
      else if (status === 'expired') stats.expired++;
      else if (status === 'voided') stats.voided++;
    });
    return stats;
  }, [warranties]);

  // Handle filter/search
  const filteredWarranties = useMemo(() => {
    return warranties.filter(w => {
      const matchFilter = activeFilter === 'All' || w.eligibility_status === activeFilter.toLowerCase();
      const matchSearch = w.product_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (w.brand && w.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (w.serial_number && w.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (w.vendor_name && w.vendor_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (w.product_category && w.product_category.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchFilter && matchSearch;
    });
  }, [warranties, activeFilter, searchTerm]);

  const handleOpenAdd = () => {
    setSelectedWarranty(null);
    setFormData({
      productName: '',
      serialNumber: '',
      brand: '',
      brandWarrantyMonths: 12,
      companyWarrantyMonths: 12,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      warrantyDocument: '',
      notes: '',
      handoverItemId: '',
      productCategory: 'general',
      vendorName: '',
      vendorContact: '',
      vendorWarrantyMonths: 12,
      vendorClaimProcedure: ''
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (w) => {
    setSelectedWarranty(w);
    setFormData({
      productName: w.product_name || '',
      serialNumber: w.serial_number || '',
      brand: w.brand || '',
      brandWarrantyMonths: w.brand_warranty_months || 0,
      companyWarrantyMonths: w.company_warranty_months || 0,
      startDate: w.start_date ? w.start_date.split('T')[0] : '',
      endDate: w.end_date ? w.end_date.split('T')[0] : '',
      warrantyDocument: w.warranty_document || '',
      notes: w.notes || '',
      handoverItemId: w.handover_item_id || '',
      productCategory: w.product_category || 'general',
      vendorName: w.vendor_name || '',
      vendorContact: w.vendor_contact || '',
      vendorWarrantyMonths: w.vendor_warranty_months || 0,
      vendorClaimProcedure: w.vendor_claim_procedure || ''
    });
    setModalOpen(true);
  };

  const handleSelectHandoverItem = (itemId) => {
    const item = handoverItems.find(i => i.id === itemId);
    if (item) {
      const productName = item.description ? item.description.replace(' Manual & Warranty', '') : '';
      setFormData(prev => ({
        ...prev,
        handoverItemId: itemId,
        productName: productName,
        serialNumber: item.serial_number || prev.serialNumber,
        endDate: item.warranty_expiry_date ? item.warranty_expiry_date.split('T')[0] : prev.endDate
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        productName: formData.productName,
        serialNumber: formData.serialNumber || null,
        brand: formData.brand || null,
        brandWarrantyMonths: parseInt(formData.brandWarrantyMonths) || 0,
        companyWarrantyMonths: parseInt(formData.companyWarrantyMonths) || 0,
        startDate: formData.startDate,
        endDate: formData.endDate,
        warrantyDocument: formData.warrantyDocument || null,
        notes: formData.notes || null,
        handoverItemId: formData.handoverItemId || null,
        productCategory: formData.productCategory || 'general',
        vendorName: formData.vendorName || null,
        vendorContact: formData.vendorContact || null,
        vendorWarrantyMonths: parseInt(formData.vendorWarrantyMonths) || 0,
        vendorClaimProcedure: formData.vendorClaimProcedure || null
      };

      if (selectedWarranty) {
        await updateWarranty(projectId, selectedWarranty.id, payload);
        toast.success('Warranty details updated successfully.');
      } else {
        await createWarranty(projectId, payload);
        toast.success('Warranty registered successfully.');
      }
      setModalOpen(false);
      fetchWarranties();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save warranty record.');
    }
  };

  const handleVoidWarranty = async (w) => {
    if (window.confirm(`Are you sure you want to void warranty for ${w.product_name}?`)) {
      try {
        await updateWarranty(projectId, w.id, { status: 'voided' });
        toast.success('Warranty has been voided.');
        fetchWarranties();
      } catch (err) {
        toast.error('Failed to void warranty.');
      }
    }
  };

  const handleDeleteWarranty = async (id) => {
    if (window.confirm('Are you sure you want to delete this warranty record?')) {
      try {
        await deleteWarranty(projectId, id);
        toast.success('Warranty record deleted.');
        fetchWarranties();
      } catch (err) {
        toast.error('Failed to delete warranty.');
      }
    }
  };

  // Claim Form handlers
  const handleOpenLogClaim = (warrantyId = '') => {
    setClaimForm({
      warrantyId: warrantyId,
      natureOfDefect: '',
      claimDate: new Date().toISOString().split('T')[0]
    });
    setClaimModalOpen(true);
  };

  const handleLogClaim = async (e) => {
    e.preventDefault();
    try {
      const claimNumber = `CLM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      await createClaim(projectId, {
        warrantyId: claimForm.warrantyId || null,
        claimNumber,
        claimDate: claimForm.claimDate,
        natureOfDefect: claimForm.natureOfDefect
      });

      toast.success('Warranty claim logged successfully.');
      setClaimModalOpen(false);
      fetchClaims();
    } catch (err) {
      toast.error('Failed to log claim.');
    }
  };

  const handleOpenReviewClaim = (claim) => {
    setSelectedClaim(claim);
    setReviewForm({
      eligibilityDecision: claim.eligibility_decision || 'pending',
      eligibilityReason: claim.eligibility_reason || '',
      assignedTechnicianId: claim.assigned_technician_id || '',
      status: claim.status || 'open',
      resolutionDetails: claim.resolution_details || ''
    });
    setReviewModalOpen(true);
  };

  const handleReviewClaim = async (e) => {
    e.preventDefault();
    try {
      await updateClaim(projectId, selectedClaim.id, {
        eligibilityDecision: reviewForm.eligibilityDecision,
        eligibilityReason: reviewForm.eligibilityReason || null,
        assignedTechnicianId: reviewForm.assignedTechnicianId || null,
        status: reviewForm.status,
        resolutionDetails: reviewForm.resolutionDetails || null
      });

      toast.success('Claim details updated successfully.');
      setReviewModalOpen(false);
      fetchClaims();
    } catch (err) {
      toast.error('Failed to update claim review.');
    }
  };

  const handleDeleteClaim = async (id) => {
    if (window.confirm('Are you sure you want to delete this claim?')) {
      try {
        await deleteClaim(projectId, id);
        toast.success('Claim deleted.');
        fetchClaims();
      } catch (err) {
        toast.error('Failed to delete claim.');
      }
    }
  };

  return (
    <div className={styles.container}>
      {/* Metric stats strip */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Warranties</span>
          <span className={styles.metricValue}>{metrics.total}</span>
        </div>
        <div className={styles.metricCard} style={{ borderLeft: '4px solid var(--color-success)' }}>
          <span className={styles.metricLabel}>Active</span>
          <span className={styles.metricValue} style={{ color: 'var(--color-success)' }}>{metrics.active}</span>
        </div>
        <div className={styles.metricCard} style={{ borderLeft: '4px solid var(--color-text-secondary)' }}>
          <span className={styles.metricLabel}>Expired</span>
          <span className={styles.metricValue}>{metrics.expired}</span>
        </div>
        <div className={styles.metricCard} style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <span className={styles.metricLabel}>Voided</span>
          <span className={styles.metricValue} style={{ color: 'var(--color-danger)' }}>{metrics.voided}</span>
        </div>
      </div>

      {/* ActionBar with filters & search */}
      <div className={styles.actionBar}>
        <div className={styles.filters}>
          {['All', 'Active', 'Expired', 'Voided'].map(f => (
            <button
              key={f}
              className={`${styles.pill} ${activeFilter === f ? styles.pillActive : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search category, brand, vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
            style={{ width: 250, padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
          />
          <Button onClick={handleOpenAdd}>+ Register Warranty</Button>
        </div>
      </div>

      {/* Table grid of records */}
      {filteredWarranties.length > 0 ? (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product & Category</th>
                <th>Brand / Manufacturer</th>
                <th>Vendor Pass-Through</th>
                <th>Coverage Period</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWarranties.map(w => {
                const isVoided = w.eligibility_status === 'voided';
                const isExpired = w.eligibility_status === 'expired';
                
                let badgeClass = styles.badgeActive;
                if (isVoided) badgeClass = styles.badgeVoided;
                else if (isExpired) badgeClass = styles.badgeExpired;

                return (
                  <tr key={w.id}>
                    <td>
                      <div className={styles.productCell}>
                        <span className={styles.productName}>{w.product_name}</span>
                        <span className={styles.serialNumber}>{w.serial_number || 'No Serial'}</span>
                        <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 'bold' }}>
                          {w.product_category || 'general'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.productCell}>
                        <span style={{ fontWeight: 600 }}>{w.brand || '—'}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          Brand Term: {w.brand_warranty_months}m
                        </span>
                      </div>
                    </td>
                    <td>
                      {w.vendor_name ? (
                        <div className={styles.productCell}>
                          <span style={{ fontWeight: 600 }}>{w.vendor_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                            Term: {w.vendor_warranty_months}m | Contact: {w.vendor_contact || '—'}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>No vendor details</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.dateCell}>
                        <span>Start: {new Date(w.start_date).toLocaleDateString('en-IN')}</span>
                        <span className={styles.dateValue}>End: {new Date(w.end_date).toLocaleDateString('en-IN')}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass}`}>
                        {w.eligibility_status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actionCell}>
                        {w.warranty_document && (
                          <a
                            href={getDownloadUrl(w.warranty_document)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline"
                            style={{ display: 'inline-flex', padding: '4px 8px', fontSize: 12, borderRadius: 4, textDecoration: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-surface)' }}
                          >
                            📄 Doc
                          </a>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleOpenLogClaim(w.id)}>Raise Claim</Button>
                        <Button variant="outline" size="sm" onClick={() => handleOpenEdit(w)}>Edit</Button>
                        {w.eligibility_status === 'active' && (
                          <Button variant="outline" size="sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => handleVoidWarranty(w)}>Void</Button>
                        )}
                        <Button variant="outline" size="sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteWarranty(w.id)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🛡️</div>
          <h3>No warranty records found</h3>
          <p>Register product-wise brand and vendor warranties to track pass-through claims coverage.</p>
          <Button onClick={handleOpenAdd} style={{ marginTop: 12 }}>Register First Warranty</Button>
        </div>
      )}

      {/* CLAIMS WORKFLOW SECTION */}
      <div style={{ marginTop: 40, borderTop: '1px solid var(--color-border)', paddingTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)' }}>Warranty Claims workflow</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>Review client-raised claims, assign technicians, check eligibility against brand/vendor details, and log resolutions.</p>
          </div>
          <Button variant="outline" onClick={() => handleOpenLogClaim()}>+ Log Manual Claim</Button>
        </div>

        {claimsLoading && claims.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading claims…</div>
        ) : claims.length > 0 ? (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Claim Number</th>
                  <th>Product Details</th>
                  <th>Claim Date</th>
                  <th>Nature of Defect</th>
                  <th>Eligibility Decision</th>
                  <th>Technician & status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(c => {
                  let statusBadge = styles.badgeScheduled;
                  if (c.status === 'resolved') statusBadge = styles.badgeActive;
                  else if (c.status === 'closed') statusBadge = styles.badgeExpired;

                  let decisionBadge = styles.badgeExpired;
                  if (c.eligibility_decision === 'approved') decisionBadge = styles.badgeActive;
                  else if (c.eligibility_decision === 'rejected') decisionBadge = styles.badgeVoided;

                  return (
                    <tr key={c.id}>
                      <td>
                        <strong style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{c.claim_number}</strong>
                      </td>
                      <td>
                        {c.product_name ? (
                          <div className={styles.productCell}>
                            <span style={{ fontWeight: 600 }}>{c.product_name}</span>
                            {c.brand && <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Brand: {c.brand}</span>}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>Untracked Item</span>
                        )}
                      </td>
                      <td>{new Date(c.claim_date).toLocaleDateString('en-IN')}</td>
                      <td>
                        <p style={{ maxWidth: 220, fontSize: 12, margin: 0, whiteSpace: 'normal', overflowWrap: 'break-word', lineHeight: 1.4 }}>
                          {c.nature_of_defect}
                        </p>
                      </td>
                      <td>
                        <div className={styles.productCell}>
                          <span className={`${styles.badge} ${decisionBadge}`}>{c.eligibility_decision}</span>
                          {c.eligibility_reason && <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>{c.eligibility_reason}</span>}
                        </div>
                      </td>
                      <td>
                        <div className={styles.productCell}>
                          <span className={`${styles.badge} ${statusBadge}`}>{c.status.replace('_', ' ')}</span>
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                            👤 {c.technician_name || 'Unassigned'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.actionCell}>
                          <Button variant="outline" size="sm" onClick={() => handleOpenReviewClaim(c)}>Review / Update</Button>
                          <Button variant="outline" size="sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteClaim(c.id)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 32, border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No claims logged for this project yet. Clients can submit claims directly from the portal, or you can record them manually.
          </div>
        )}
      </div>

      {/* Register / Edit Modal (Warranty) */}
      {modalOpen && (
        <Modal 
          isOpen={modalOpen} 
          onClose={() => setModalOpen(false)}
          title={selectedWarranty ? 'Edit Warranty Record' : 'Register Product Warranty'}
        >
          <form onSubmit={handleSubmit} className={styles.modalForm}>
            {handoverItems.length > 0 && !selectedWarranty && (
              <FormField label="Link Handover Checklist Item (Optional)">
                <select
                  value={formData.handoverItemId}
                  onChange={(e) => handleSelectHandoverItem(e.target.value)}
                  className="input"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  <option value="">-- Standalone Product (No link) --</option>
                  {handoverItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.room} - {item.description} {item.serial_number ? `(${item.serial_number})` : ''}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <div className={styles.formGrid}>
              <FormField label="Product Name *" required>
                <Input
                  value={formData.productName}
                  onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
                  placeholder="e.g. Chimney, TV Unit"
                  required
                />
              </FormField>
              
              <FormField label="Product Category">
                <select
                  value={formData.productCategory}
                  onChange={(e) => setFormData(prev => ({ ...prev, productCategory: e.target.value }))}
                  className="input"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  <option value="modular_kitchen">Modular Kitchen</option>
                  <option value="hardware">Hardware & Fittings</option>
                  <option value="appliances">Appliances</option>
                  <option value="tiles">Tiles & Countertops</option>
                  <option value="general">General Interior</option>
                </select>
              </FormField>
            </div>

            <div className={styles.formGrid}>
              <FormField label="Brand / Manufacturer">
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  placeholder="e.g. Faber, Blum"
                />
              </FormField>
              
              <FormField label="Serial Number">
                <Input
                  value={formData.serialNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                  placeholder="e.g. SN-9988-ABC"
                />
              </FormField>
            </div>

            <div className={styles.formGrid}>
              <FormField label="Brand Warranty (Months)">
                <Input
                  type="number"
                  value={formData.brandWarrantyMonths}
                  onChange={(e) => setFormData(prev => ({ ...prev, brandWarrantyMonths: parseInt(e.target.value) || 0 }))}
                  min="0"
                />
              </FormField>
              
              <FormField label="Company Warranty (Months)">
                <Input
                  type="number"
                  value={formData.companyWarrantyMonths}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyWarrantyMonths: parseInt(e.target.value) || 0 }))}
                  min="0"
                />
              </FormField>
            </div>

            <div className={styles.formGrid}>
              <FormField label="Coverage Start Date *" required>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  required
                />
              </FormField>
              
              <FormField label="Coverage End Date *" required>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  required
                />
              </FormField>
            </div>

            {/* Vendor warranty details section */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 12, margin: '8px 0' }}>
              <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>📦 Vendor Pass-Through Warranty Details</strong>
              
              <div className={styles.formGrid}>
                <FormField label="Vendor Partner Name">
                  <Input
                    value={formData.vendorName}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendorName: e.target.value }))}
                    placeholder="e.g. Hafele Distributor"
                  />
                </FormField>
                
                <FormField label="Vendor Contact Info">
                  <Input
                    value={formData.vendorContact}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendorContact: e.target.value }))}
                    placeholder="Email or Phone number"
                  />
                </FormField>
              </div>

              <div className={styles.formGrid}>
                <FormField label="Vendor Warranty Term (Months)">
                  <Input
                    type="number"
                    value={formData.vendorWarrantyMonths}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendorWarrantyMonths: parseInt(e.target.value) || 0 }))}
                    min="0"
                  />
                </FormField>
                
                <FormField label="Warranty Document Reference Key">
                  <Input
                    value={formData.warrantyDocument}
                    onChange={(e) => setFormData(prev => ({ ...prev, warrantyDocument: e.target.value }))}
                    placeholder="Upload file key / reference URL"
                  />
                </FormField>
              </div>

              <FormField label="Vendor Claim Procedure Instruction">
                <Textarea
                  value={formData.vendorClaimProcedure}
                  onChange={(e) => setFormData(prev => ({ ...prev, vendorClaimProcedure: e.target.value }))}
                  placeholder="e.g. Raise ticket at support@hafele.com with serial invoice copy..."
                  rows={2}
                />
              </FormField>
            </div>

            <FormField label="Staff Notes">
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Exemptions, service history details..."
                rows={2}
              />
            </FormField>

            <div className={styles.modalFooter}>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit">{selectedWarranty ? 'Save Changes' : 'Register'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Log Manual Claim Modal */}
      {claimModalOpen && (
        <Modal
          isOpen={claimModalOpen}
          onClose={() => setClaimModalOpen(false)}
          title="Log Warranty Claim"
        >
          <form onSubmit={handleLogClaim} className={styles.modalForm}>
            <FormField label="Link Installed Product Warranty">
              <select
                value={claimForm.warrantyId}
                onChange={(e) => setClaimForm(prev => ({ ...prev, warrantyId: e.target.value }))}
                className="input"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              >
                <option value="">-- Untracked Product Claim --</option>
                {warranties.map(w => (
                  <option key={w.id} value={w.id}>
                    [{w.product_category || 'general'}] {w.product_name} {w.brand ? `(${w.brand})` : ''} - expires {new Date(w.end_date).toLocaleDateString('en-IN')}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Claim Date *" required>
              <Input
                type="date"
                value={claimForm.claimDate}
                onChange={(e) => setClaimForm(prev => ({ ...prev, claimDate: e.target.value }))}
                required
              />
            </FormField>

            <FormField label="Describe Defect/Complaint Details *" required>
              <Textarea
                value={claimForm.natureOfDefect}
                onChange={(e) => setClaimForm(prev => ({ ...prev, natureOfDefect: e.target.value }))}
                placeholder="What is loose, squeaking, broken, or malfunctioning? Provide detailed info..."
                rows={4}
                required
              />
            </FormField>

            <div className={styles.modalFooter}>
              <Button type="button" variant="outline" onClick={() => setClaimModalOpen(false)}>Cancel</Button>
              <Button type="submit">Log Claim</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review / Update Claim Modal */}
      {reviewModalOpen && (
        <Modal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          title={`Review Claim #${selectedClaim?.claim_number}`}
        >
          <form onSubmit={handleReviewClaim} className={styles.modalForm}>
            <div style={{ background: 'var(--color-surface-2)', padding: 12, borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 8 }}>
              <div><strong>Defect Reported:</strong> {selectedClaim?.nature_of_defect}</div>
            </div>

            <div className={styles.formGrid}>
              <FormField label="Eligibility Decision">
                <select
                  value={reviewForm.eligibilityDecision}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, eligibilityDecision: e.target.value }))}
                  className="input"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  <option value="pending">Pending review</option>
                  <option value="approved">Approved (In-Warranty)</option>
                  <option value="rejected">Rejected (Out-Of-Warranty / Chargeable)</option>
                </select>
              </FormField>

              <FormField label="Assign Repair Technician">
                <select
                  value={reviewForm.assignedTechnicianId}
                  onChange={(e) => setReviewForm(prev => ({ ...prev, assignedTechnicianId: e.target.value }))}
                  className="input"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  <option value="">-- Unassigned --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Eligibility Decision Rationale">
              <Input
                value={reviewForm.eligibilityReason}
                onChange={(e) => setReviewForm(prev => ({ ...prev, eligibilityReason: e.target.value }))}
                placeholder="Reason for approval or rejection (e.g. 'Within 1-year company warranty' or 'Damage due to water leakage')"
              />
            </FormField>

            <FormField label="Workflow Status">
              <select
                value={reviewForm.status}
                onChange={(e) => setReviewForm(prev => ({ ...prev, status: e.target.value }))}
                className="input"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              >
                <option value="open">Open (Logged)</option>
                <option value="in_progress">In Progress (Tech assigned/visiting)</option>
                <option value="resolved">Resolved (Repairs completed)</option>
                <option value="closed">Closed (Signed off)</option>
              </select>
            </FormField>

            <FormField label="Resolution Details">
              <Textarea
                value={reviewForm.resolutionDetails}
                onChange={(e) => setReviewForm(prev => ({ ...prev, resolutionDetails: e.target.value }))}
                placeholder="Document parts replaced, repairs completed, billing amount if out-of-warranty..."
                rows={3}
              />
            </FormField>

            <div className={styles.modalFooter}>
              <Button type="button" variant="outline" onClick={() => setReviewModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
