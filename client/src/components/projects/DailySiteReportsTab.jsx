/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import styles from './DailySiteReportsTab.module.css';
import { Button, Modal, Input, Select } from '../ui';
import { getDailyReports, submitDailyReport } from '../../api/projects';
import { useS3Upload } from '../../hooks/useS3Upload';
import { useToast } from '../../store/toastContext';

const TRADES = [
  { value: 'civil', label: 'Civil / Demolition' },
  { value: 'electrical', label: 'Electrical Work' },
  { value: 'plumbing', label: 'Plumbing Work' },
  { value: 'false_ceiling', label: 'False Ceiling' },
  { value: 'flooring', label: 'Flooring & Tiling' },
  { value: 'painting', label: 'Painting & Putty' },
  { value: 'carpentry', label: 'Carpentry & Modular' },
  { value: 'glass_metal', label: 'Glass & Metal Work' },
  { value: 'furnishing', label: 'Soft Furnishing' }
];

export default function DailySiteReportsTab({ projectId }) {
  const toast = useToast();
  const { uploadRaw, uploading: s3Uploading, progress: uploadProgress } = useS3Upload();

  // State
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formWorkDone, setFormWorkDone] = useState('');
  const [formIssues, setFormIssues] = useState('');
  const [formManpower, setFormManpower] = useState([]);
  const [formMaterials, setFormMaterials] = useState([]);
  const [uploadedPhotos, setUploadedPhotos] = useState([]); // List of storage keys
  const [localPhotoUrls, setLocalPhotoUrls] = useState({}); // key -> local object URL for instant preview

  // Dynamic add manpower state
  const [selectedTrade, setSelectedTrade] = useState('carpentry');
  const [workerCount, setWorkerCount] = useState(1);

  // Dynamic add material state
  const [materialName, setMaterialName] = useState('');
  const [materialQty, setMaterialQty] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [projectId]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await getDailyReports(projectId);
      const data = res.data?.data || res.data || [];
      setReports(data);
      if (data.length > 0 && !selectedReport) {
        setSelectedReport(data[0]);
      }
    } catch (err) {
      toast.error('Failed to load daily site reports.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddManpower = () => {
    if (workerCount <= 0) return;
    const label = TRADES.find(t => t.value === selectedTrade)?.label || selectedTrade;
    
    // Check if trade already exists
    if (formManpower.some(m => m.trade === selectedTrade)) {
      toast.error('Trade already added. Modify or remove it first.');
      return;
    }

    setFormManpower(prev => [...prev, { trade: selectedTrade, label, count: Number(workerCount) }]);
    setWorkerCount(1);
  };

  const handleRemoveManpower = (trade) => {
    setFormManpower(prev => prev.filter(m => m.trade !== trade));
  };

  const handleAddMaterial = () => {
    if (!materialName.trim() || !materialQty.trim()) return;
    setFormMaterials(prev => [...prev, { material: materialName.trim(), quantity: materialQty.trim() }]);
    setMaterialName('');
    setMaterialQty('');
  };

  const handleRemoveMaterial = (index) => {
    setFormMaterials(prev => prev.filter((_, idx) => idx !== index));
  };

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const localUrl = URL.createObjectURL(file);
        const storageKey = await uploadRaw({ file, projectId, purpose: 'dsr-photo' });
        
        setUploadedPhotos(prev => [...prev, storageKey]);
        setLocalPhotoUrls(prev => ({ ...prev, [storageKey]: localUrl }));
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  };

  const handleRemovePhoto = (storageKey) => {
    setUploadedPhotos(prev => prev.filter(key => key !== storageKey));
    // Clean local object URL if exists
    if (localPhotoUrls[storageKey]) {
      URL.revokeObjectURL(localPhotoUrls[storageKey]);
      setLocalPhotoUrls(prev => {
        const copy = { ...prev };
        delete copy[storageKey];
        return copy;
      });
    }
  };

  const handleSubmitReport = async () => {
    if (!formWorkDone.trim()) {
      toast.error('Please enter a description of work done today.');
      return;
    }

    if (uploadedPhotos.length === 0) {
      toast.error('Submission blocked: At least one progress photo is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        reportDate: formDate,
        workDone: formWorkDone,
        manpower: formManpower.map(m => ({ trade: m.trade, count: m.count })),
        materials: formMaterials,
        issuesEncountered: formIssues.trim() || null,
        photos: uploadedPhotos
      };

      const res = await submitDailyReport(projectId, payload);
      toast.success('Daily site report submitted successfully!');
      setIsModalOpen(false);
      
      // Reset form
      setFormWorkDone('');
      setFormIssues('');
      setFormManpower([]);
      setFormMaterials([]);
      setUploadedPhotos([]);
      setLocalPhotoUrls({});
      setFormDate(new Date().toISOString().split('T')[0]);

      // Refresh list
      fetchReports();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to submit daily report.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to render image thumbnails
  const resolvePhotoUrl = (key) => {
    if (localPhotoUrls[key]) return localPhotoUrls[key];
    // Mock image source mapping to look professional offline
    if (key.includes('mock-dsr-photo') || key.includes('photo-')) {
      return 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=400&q=80';
    }
    return key; // Fallback or S3 URL
  };

  if (loading && reports.length === 0) {
    return <div style={{ padding: 40, text: 'center', color: 'var(--color-text-muted)' }}>Loading reports history...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Left Column: Timeline List */}
      <div className={styles.leftCol}>
        <div className={styles.headerRow}>
          <h3 className={styles.title}>Daily Reports</h3>
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>+ Submit Report</Button>
        </div>

        {reports.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📋</div>
            <p style={{ margin: 0, fontSize: '13px' }}>No daily reports submitted yet.</p>
          </div>
        ) : (
          <div className={styles.reportsList}>
            {reports.map(report => {
              const totalWorkers = (report.manpower || []).reduce((sum, item) => sum + item.count, 0);
              return (
                <div 
                  key={report.id} 
                  className={`${styles.reportCard} ${selectedReport?.id === report.id ? styles.reportCardActive : ''}`}
                  onClick={() => setSelectedReport(report)}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.cardDate}>
                      {new Date(report.report_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className={styles.cardSubmitter}>{report.submitted_by_name || 'Supervisor'}</span>
                  </div>
                  <div className={styles.cardSnippet}>{report.work_done}</div>
                  <div className={styles.cardBadges}>
                    {totalWorkers > 0 && (
                      <span className={`${styles.badge} ${styles.badgeManpower}`}>
                        👥 {totalWorkers} Workers
                      </span>
                    )}
                    {report.issues_encountered && (
                      <span className={`${styles.badge} ${styles.badgeIssue}`}>
                        ⚠️ Issue Reported
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Detail View */}
      <div className={styles.rightCol}>
        {selectedReport ? (
          <>
            <div className={styles.detailHeader}>
              <h2 className={styles.detailDate}>
                DSR - {new Date(selectedReport.report_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
              <div className={styles.detailMeta}>
                Submitted by: <strong>{selectedReport.submitted_by_name || 'Supervisor'}</strong> on {new Date(selectedReport.created_at).toLocaleString('en-IN')}
              </div>
            </div>

            <div>
              <h4 className={styles.sectionTitle}>Work Completed</h4>
              <div className={styles.sectionBox}>{selectedReport.work_done}</div>
            </div>

            {selectedReport.issues_encountered && (
              <div>
                <h4 className={styles.sectionTitle}>Issues & Blockers</h4>
                <div className={styles.issueCallout}>
                  <strong>⚠️ Issue Details:</strong><br />
                  {selectedReport.issues_encountered}
                </div>
              </div>
            )}

            <div>
              <h4 className={styles.sectionTitle}>Manpower Deployed</h4>
              {selectedReport.manpower && selectedReport.manpower.length > 0 ? (
                <div className={styles.gridList}>
                  {selectedReport.manpower.map((m, idx) => {
                    const label = TRADES.find(t => t.value === m.trade)?.label || m.trade;
                    return (
                      <div key={idx} className={styles.gridItem}>
                        <span className={styles.gridLabel}>{label}</span>
                        <span className={styles.gridVal}>{m.count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: '13px', color: 'var(--color-text-muted)' }}>No manpower recorded.</p>
              )}
            </div>

            <div>
              <h4 className={styles.sectionTitle}>Materials Consumed</h4>
              {selectedReport.materials && selectedReport.materials.length > 0 ? (
                <div className={styles.gridList}>
                  {selectedReport.materials.map((m, idx) => (
                    <div key={idx} className={styles.gridItem}>
                      <span className={styles.gridLabel}>{m.material}</span>
                      <span className={styles.gridVal}>{m.quantity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: '13px', color: 'var(--color-text-muted)' }}>No materials recorded.</p>
              )}
            </div>

            <div>
              <h4 className={styles.sectionTitle}>Progress Photos</h4>
              {selectedReport.photos && selectedReport.photos.length > 0 ? (
                <div className={styles.gallery}>
                  {selectedReport.photos.map((key, idx) => (
                    <img 
                      key={idx} 
                      src={resolvePhotoUrl(key)} 
                      alt={`Site Progress ${idx + 1}`} 
                      className={styles.galleryImg} 
                      onClick={() => window.open(resolvePhotoUrl(key), '_blank')}
                    />
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: '13px', color: 'var(--color-text-danger)' }}>⚠️ Error: No photos submitted.</p>
              )}
            </div>
          </>
        ) : (
          <div className={styles.emptySelection}>
            <div style={{ fontSize: '48px', marginBottom: 12 }}>📋</div>
            <p>Select a daily site report from the list to view its details.</p>
          </div>
        )}
      </div>

      {/* Submit Report Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Submit Daily Site Report"
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={submitting}>Cancel</Button>
              <Button variant="primary" onClick={handleSubmitReport} loading={submitting || s3Uploading}>
                Submit Daily Report
              </Button>
            </>
          }
        >
          <div className={styles.formGrid}>
            <div className={styles.inputGroup}>
              <Input 
                label="Report Date *" 
                type="date" 
                value={formDate} 
                onChange={e => setFormDate(e.target.value)} 
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Work Done Today *</label>
              <textarea 
                className={styles.textarea} 
                placeholder="Describe the tasks executed today (e.g. Completed living room electrical piping, started kitchen wall putty)..."
                value={formWorkDone}
                onChange={e => setFormWorkDone(e.target.value)}
              />
            </div>

            {/* Manpower Manager */}
            <div className={styles.dynamicManager}>
              <label className={styles.label} style={{ marginBottom: 10, display: 'block' }}>Manpower Deployed</label>
              
              {formManpower.length > 0 && (
                <div className={styles.addedItems}>
                  {formManpower.map(m => (
                    <div key={m.trade} className={styles.addedItem}>
                      <span><strong>{m.label}</strong>: {m.count} workers</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveManpower(m.trade)}
                        className="text-red-500 hover:text-red-400 font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.dynamicRow}>
                <div style={{ flex: 2 }}>
                  <Select 
                    options={TRADES}
                    value={selectedTrade}
                    onChange={v => setSelectedTrade(v)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Input 
                    type="number"
                    min="1"
                    value={workerCount}
                    onChange={e => setWorkerCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <Button type="button" variant="outline" onClick={handleAddManpower}>+ Add</Button>
              </div>
            </div>

            {/* Materials Manager */}
            <div className={styles.dynamicManager}>
              <label className={styles.label} style={{ marginBottom: 10, display: 'block' }}>Materials Consumed Today</label>
              
              {formMaterials.length > 0 && (
                <div className={styles.addedItems}>
                  {formMaterials.map((m, idx) => (
                    <div key={idx} className={styles.addedItem}>
                      <span><strong>{m.material}</strong>: {m.quantity}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveMaterial(idx)}
                        className="text-red-500 hover:text-red-400 font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.dynamicRow}>
                <div style={{ flex: 2 }}>
                  <Input 
                    placeholder="Material Name (e.g. Paint)"
                    value={materialName}
                    onChange={e => setMaterialName(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1.5 }}>
                  <Input 
                    placeholder="Qty (e.g. 20 Liters)"
                    value={materialQty}
                    onChange={e => setMaterialQty(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" onClick={handleAddMaterial}>+ Add</Button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Issues / Blockers Encountered</label>
              <textarea 
                className={styles.textarea} 
                placeholder="Mention any material delays, power failure, client change request, or design mismatch..."
                value={formIssues}
                onChange={e => setFormIssues(e.target.value)}
              />
            </div>

            {/* Photo Uploader */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>Progress Photos * (Mandatory - upload at least 1 photo)</label>
              <div 
                className={styles.uploadSection}
                onClick={() => document.getElementById('dsr-file-upload').click()}
              >
                <span>📸 Click to upload progress images</span>
                <input 
                  type="file"
                  id="dsr-file-upload"
                  style={{ display: 'none' }}
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                />
                {s3Uploading && (
                  <div style={{ marginTop: 8, fontSize: '11px', color: 'var(--color-accent)' }}>
                    Uploading to storage ({uploadProgress}%)...
                  </div>
                )}
              </div>

              {uploadedPhotos.length > 0 && (
                <div className={styles.uploadThumbnails}>
                  {uploadedPhotos.map(key => (
                    <div key={key} className={styles.uploadThumb}>
                      <img src={resolvePhotoUrl(key)} className={styles.thumbImg} alt="Preview" />
                      <button 
                        type="button" 
                        className={styles.removeThumb}
                        onClick={() => handleRemovePhoto(key)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
