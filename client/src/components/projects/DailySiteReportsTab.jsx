/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from 'react';
import styles from './DailySiteReportsTab.module.css';
import { Button, Modal, Input, Select, Badge } from '../ui';
import { getDailyReports, submitDailyReport } from '../../api/projects';
import { useS3Upload } from '../../hooks/useS3Upload';
import { useToast } from '../../store/toastContext';
import { useAuth } from '../../store/authContext';

const TRADES = [
  { value: 'civil', label: 'Civil / Demolition', icon: '🧱' },
  { value: 'electrical', label: 'Electrical Work', icon: '⚡' },
  { value: 'plumbing', label: 'Plumbing Work', icon: '🚰' },
  { value: 'false_ceiling', label: 'False Ceiling', icon: '📐' },
  { value: 'flooring', label: 'Flooring & Tiling', icon: '🏁' },
  { value: 'painting', label: 'Painting & Putty', icon: '🎨' },
  { value: 'carpentry', label: 'Carpentry & Modular', icon: '🔨' },
  { value: 'glass_metal', label: 'Glass & Metal Work', icon: '🪟' },
  { value: 'furnishing', label: 'Soft Furnishing', icon: '🛋️' }
];

export default function DailySiteReportsTab({ projectId }) {
  const { user } = useAuth();
  const toast = useToast();
  const { uploadRaw, uploading: s3Uploading, progress: uploadProgress } = useS3Upload();

  // Core Data States
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [tradeFilter, setTradeFilter] = useState('all');
  const [issuesOnly, setIssuesOnly] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  // Form State
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formWorkDone, setFormWorkDone] = useState('');
  const [formTomorrowsPlan, setFormTomorrowsPlan] = useState('');
  const [formSupervisorSignature, setFormSupervisorSignature] = useState(user?.name || '');
  const [formIssues, setFormIssues] = useState('');
  const [formManpower, setFormManpower] = useState([]);
  const [formMaterials, setFormMaterials] = useState([]);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [localPhotoUrls, setLocalPhotoUrls] = useState({});

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
      const list = Array.isArray(data) ? data : [];
      setReports(list);
      if (list.length > 0 && !selectedReport) {
        setSelectedReport(list[0]);
      }
    } catch (err) {
      toast.error('Failed to load daily site reports.');
    } finally {
      setLoading(false);
    }
  };

  // KPI Calculations
  const totalReportsCount = reports.length;
  const latestReport = reports[0];
  const latestManpowerCount = (latestReport?.manpower || []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  const totalBlockersCount = reports.filter(r => Boolean(r.issues_encountered && r.issues_encountered.trim())).length;
  const totalPhotosCount = reports.reduce((sum, r) => sum + (Array.isArray(r.photos) ? r.photos.length : 0), 0);

  // Filtered Reports
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesWork = (r.work_done || '').toLowerCase().includes(q);
        const matchesIssues = (r.issues_encountered || '').toLowerCase().includes(q);
        const matchesPlan = (r.tomorrows_plan || '').toLowerCase().includes(q);
        const matchesDate = (r.report_date || '').includes(q);
        if (!matchesWork && !matchesIssues && !matchesPlan && !matchesDate) return false;
      }

      if (issuesOnly && (!r.issues_encountered || !r.issues_encountered.trim())) {
        return false;
      }

      if (tradeFilter !== 'all') {
        const hasTrade = (r.manpower || []).some(m => m.trade === tradeFilter);
        if (!hasTrade) return false;
      }

      return true;
    });
  }, [reports, searchQuery, tradeFilter, issuesOnly]);

  const handleAddManpower = () => {
    if (workerCount <= 0) return;
    const item = TRADES.find(t => t.value === selectedTrade);
    const label = item?.label || selectedTrade;
    
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

    setSubmitting(true);
    try {
      const payload = {
        reportDate: formDate,
        workDone: formWorkDone.trim(),
        tomorrowsPlan: formTomorrowsPlan.trim() || null,
        supervisorSignature: formSupervisorSignature.trim() || user?.name || 'Site Supervisor',
        manpower: formManpower.map(m => ({ trade: m.trade, count: m.count })),
        materials: formMaterials,
        issuesEncountered: formIssues.trim() || null,
        photos: uploadedPhotos
      };

      await submitDailyReport(projectId, payload);
      toast.success('Daily site report submitted successfully!');
      setIsModalOpen(false);
      
      // Reset form
      setFormWorkDone('');
      setFormTomorrowsPlan('');
      setFormIssues('');
      setFormManpower([]);
      setFormMaterials([]);
      setUploadedPhotos([]);
      setLocalPhotoUrls({});
      setFormDate(new Date().toISOString().split('T')[0]);

      fetchReports();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to submit daily report.');
    } finally {
      setSubmitting(false);
    }
  };

  const resolvePhotoUrl = (key) => {
    if (!key) return '';
    if (localPhotoUrls[key]) return localPhotoUrls[key];
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    if (key.includes('mock-dsr-photo') || key.includes('photo-')) {
      return 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80';
    }
    return key;
  };

  // Generate WhatsApp Message
  const handleCopyWhatsApp = (report) => {
    if (!report) return;
    const dateStr = new Date(report.report_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const totalWorkers = (report.manpower || []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);

    let msg = `*📋 Daily Site Report — ${dateStr}*\n\n`;
    msg += `*✅ Work Completed Today:*\n${report.work_done}\n\n`;

    if (report.tomorrows_plan) {
      msg += `*🎯 Tomorrow's Planned Work:*\n${report.tomorrows_plan}\n\n`;
    }

    if (totalWorkers > 0) {
      msg += `*👥 Manpower Deployed (${totalWorkers} Total):*\n`;
      (report.manpower || []).forEach(m => {
        const trObj = TRADES.find(t => t.value === m.trade);
        msg += `- ${trObj?.label || m.trade}: ${m.count} workers\n`;
      });
      msg += '\n';
    }

    if (report.materials && report.materials.length > 0) {
      msg += `*📦 Materials Received / Consumed:*\n`;
      report.materials.forEach(m => {
        msg += `- ${m.material}: ${m.quantity}\n`;
      });
      msg += '\n';
    }

    if (report.issues_encountered) {
      msg += `*⚠️ Issues / Site Blockers:*\n${report.issues_encountered}\n\n`;
    }

    msg += `_Submitted by: ${report.submitted_by_name || report.supervisor_signature || 'Site Incharge'}_`;

    navigator.clipboard.writeText(msg);
    toast.success('Daily Site Report formatted & copied to clipboard!');
  };

  if (loading && reports.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading site reports history...</div>;
  }

  return (
    <div className={styles.wrapper}>
      {/* KPI Stats Bar */}
      <div className={styles.kpiBar}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>📋</div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiVal}>{totalReportsCount}</span>
            <span className={styles.kpiTitle}>Total Reports Logged</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>👷</div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiVal}>{latestManpowerCount}</span>
            <span className={styles.kpiTitle}>Latest Site Workers</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>⚠️</div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiVal} style={{ color: totalBlockersCount > 0 ? 'var(--color-warning)' : 'var(--color-text)' }}>
              {totalBlockersCount}
            </span>
            <span className={styles.kpiTitle}>Reported Blockers</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>📸</div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiVal}>{totalPhotosCount}</span>
            <span className={styles.kpiTitle}>Progress Photos</span>
          </div>
        </div>
      </div>

      {/* Main Split Container */}
      <div className={styles.container}>
        {/* Left Column: Timeline List */}
        <div className={styles.leftCol}>
          <div className={styles.headerRow}>
            <h3 className={styles.title}>Daily Reports</h3>
            <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>+ New Report</Button>
          </div>

          {/* Search & Filter Bar */}
          <div className={styles.filterRow}>
            <input 
              type="text"
              className={styles.searchInput}
              placeholder="Search work done, date..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select 
              className={styles.filterSelect}
              value={tradeFilter}
              onChange={e => setTradeFilter(e.target.value)}
            >
              <option value="all">All Trades</option>
              {TRADES.map(t => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
            <button
              type="button"
              className={`${styles.filterPill} ${issuesOnly ? styles.filterPillActive : ''}`}
              onClick={() => setIssuesOnly(prev => !prev)}
              title="Filter reports with reported blockers or site issues"
            >
              ⚠️ Blockers Only
            </button>
          </div>

          {filteredReports.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📋</div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>No matching daily reports</p>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 4 }}>
                {reports.length === 0 ? 'Click "+ New Report" to log the first site entry.' : 'Try adjusting your search filters.'}
              </span>
              {(searchQuery || tradeFilter !== 'all' || issuesOnly) && (
                <button
                  type="button"
                  className={styles.resetFilterBtn}
                  onClick={() => {
                    setSearchQuery('');
                    setTradeFilter('all');
                    setIssuesOnly(false);
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className={styles.reportsList}>
              {filteredReports.map(report => {
                const totalWorkers = (report.manpower || []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
                const photoCount = Array.isArray(report.photos) ? report.photos.length : 0;
                const isSelected = selectedReport?.id === report.id;

                return (
                  <div 
                    key={report.id} 
                    className={`${styles.reportCard} ${isSelected ? styles.reportCardActive : ''}`}
                    onClick={() => setSelectedReport(report)}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.cardDate}>
                        📅 {new Date(report.report_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className={styles.cardSubmitter}>
                        {report.submitted_by_name || report.supervisor_signature || 'Supervisor'}
                      </span>
                    </div>

                    <div className={styles.cardSnippet}>{report.work_done}</div>

                    <div className={styles.cardBadges}>
                      {totalWorkers > 0 && (
                        <span className={`${styles.badge} ${styles.badgeManpower}`}>
                          👥 {totalWorkers} Workers
                        </span>
                      )}
                      {photoCount > 0 && (
                        <span className={`${styles.badge} ${styles.badgePhotos}`}>
                          📸 {photoCount} Photos
                        </span>
                      )}
                      {report.issues_encountered && (
                        <span className={`${styles.badge} ${styles.badgeIssue}`}>
                          ⚠️ Blocker
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
                <div className={styles.detailHeaderLeft}>
                  <h2 className={styles.detailDate}>
                    <span>📋</span>
                    DSR — {new Date(selectedReport.report_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h2>
                  <div className={styles.detailMeta}>
                    Logged by <strong>{selectedReport.submitted_by_name || selectedReport.supervisor_signature || 'Site Incharge'}</strong> on {new Date(selectedReport.created_at || selectedReport.report_date).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className={styles.detailActions}>
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    🖨️ Print DSR
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => handleCopyWhatsApp(selectedReport)}>
                    💬 Copy WhatsApp Update
                  </Button>
                </div>
              </div>

              {/* Work Completed */}
              <div>
                <h4 className={styles.sectionTitle}>
                  <span>🔨</span> Work Completed Today
                </h4>
                <div className={styles.sectionBox}>{selectedReport.work_done}</div>
              </div>

              {/* Tomorrow's Plan */}
              {selectedReport.tomorrows_plan && (
                <div>
                  <h4 className={styles.sectionTitle}>
                    <span>🎯</span> Tomorrow's Planned Work
                  </h4>
                  <div className={styles.planBox}>{selectedReport.tomorrows_plan}</div>
                </div>
              )}

              {/* Issues & Blockers */}
              {selectedReport.issues_encountered && (
                <div>
                  <h4 className={styles.sectionTitle}>
                    <span>⚠️</span> Issues & Site Blockers
                  </h4>
                  <div className={styles.issueCallout}>
                    <strong>Identified Delay / Block:</strong><br />
                    {selectedReport.issues_encountered}
                  </div>
                </div>
              )}

              {/* Manpower Deployed */}
              <div>
                <h4 className={styles.sectionTitle}>
                  <span>👥</span> Manpower Deployed
                </h4>
                {selectedReport.manpower && selectedReport.manpower.length > 0 ? (
                  <div className={styles.gridList}>
                    {selectedReport.manpower.map((m, idx) => {
                      const trObj = TRADES.find(t => t.value === m.trade);
                      return (
                        <div key={idx} className={styles.gridItem}>
                          <span className={styles.gridLabel}>
                            <span>{trObj?.icon || '👷'}</span>
                            {trObj?.label || m.trade}
                          </span>
                          <span className={styles.gridVal}>{m.count} workers</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontStyle: 'italic', fontSize: '13px', color: 'var(--color-text-muted)' }}>No manpower recorded for this day.</p>
                )}
              </div>

              {/* Materials Consumed */}
              <div>
                <h4 className={styles.sectionTitle}>
                  <span>📦</span> Materials Received / Consumed
                </h4>
                {selectedReport.materials && selectedReport.materials.length > 0 ? (
                  <div className={styles.gridList}>
                    {selectedReport.materials.map((m, idx) => (
                      <div key={idx} className={styles.gridItem}>
                        <span className={styles.gridLabel}>
                          <span>🧱</span>
                          {m.material}
                        </span>
                        <span className={styles.gridVal}>{m.quantity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontStyle: 'italic', fontSize: '13px', color: 'var(--color-text-muted)' }}>No materials recorded for this day.</p>
                )}
              </div>

              {/* Progress Photos Gallery */}
              <div>
                <h4 className={styles.sectionTitle}>
                  <span>📸</span> Site Progress Photos
                </h4>
                {selectedReport.photos && selectedReport.photos.length > 0 ? (
                  <div className={styles.gallery}>
                    {selectedReport.photos.map((key, idx) => (
                      <div key={idx} className={styles.galleryCard} onClick={() => setLightboxPhoto(resolvePhotoUrl(key))}>
                        <img 
                          src={resolvePhotoUrl(key)} 
                          alt={`Site Progress ${idx + 1}`} 
                          className={styles.galleryImg} 
                        />
                        <div className={styles.galleryOverlay}>
                          <span>Photo #{idx + 1}</span>
                          <span>🔍 Zoom</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontStyle: 'italic', fontSize: '13px', color: 'var(--color-text-muted)' }}>No progress photos uploaded for this report.</p>
                )}
              </div>
            </>
          ) : (
            <div className={styles.emptySelection}>
              <div style={{ fontSize: '48px', marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>Select a report to view full details</p>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Click on any date in the timeline to inspect work details, manpower, and site photos.</span>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxPhoto(null)}>
          <div className={styles.lightboxContent} onClick={e => e.stopPropagation()}>
            <button className={styles.lightboxClose} onClick={() => setLightboxPhoto(null)}>×</button>
            <img src={lightboxPhoto} alt="Full resolution site inspection" className={styles.lightboxImg} />
          </div>
        </div>
      )}

      {/* Submit Report Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Log Daily Site Report (DSR)"
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className={styles.inputGroup}>
                <Input 
                  label="Report Date *" 
                  type="date" 
                  value={formDate} 
                  onChange={e => setFormDate(e.target.value)} 
                />
              </div>
              <div className={styles.inputGroup}>
                <Input 
                  label="Supervisor / Incharge" 
                  value={formSupervisorSignature} 
                  onChange={e => setFormSupervisorSignature(e.target.value)} 
                  placeholder="Supervisor Name"
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Work Done Today *</label>
              <textarea 
                className={styles.textarea} 
                placeholder="Detail today's activities (e.g. Completed master bedroom false ceiling framing, began primer coat in hallway, 4 electrical points shifted)..."
                value={formWorkDone}
                onChange={e => setFormWorkDone(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Tomorrow's Planned Work</label>
              <textarea 
                className={styles.textarea} 
                style={{ minHeight: 70 }}
                placeholder="What is targeted for tomorrow? (e.g. Electrical wiring pull-through, tile grouting in guest bathroom)..."
                value={formTomorrowsPlan}
                onChange={e => setFormTomorrowsPlan(e.target.value)}
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
                        style={{ background: 'none', border: 'none', color: 'var(--color-danger)', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.dynamicRow}>
                <div style={{ flex: 2 }}>
                  <Select 
                    options={TRADES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }))}
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
                <Button type="button" variant="outline" onClick={handleAddManpower}>+ Add Trade</Button>
              </div>
            </div>

            {/* Materials Manager */}
            <div className={styles.dynamicManager}>
              <label className={styles.label} style={{ marginBottom: 10, display: 'block' }}>Materials Consumed / Received</label>
              
              {formMaterials.length > 0 && (
                <div className={styles.addedItems}>
                  {formMaterials.map((m, idx) => (
                    <div key={idx} className={styles.addedItem}>
                      <span><strong>{m.material}</strong>: {m.quantity}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveMaterial(idx)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-danger)', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.dynamicRow}>
                <div style={{ flex: 2 }}>
                  <Input 
                    placeholder="Material Name (e.g. Gyproc Board, Primer)"
                    value={materialName}
                    onChange={e => setMaterialName(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1.5 }}>
                  <Input 
                    placeholder="Qty (e.g. 15 Sheets, 20 Ltr)"
                    value={materialQty}
                    onChange={e => setMaterialQty(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" onClick={handleAddMaterial}>+ Add Material</Button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Issues / Blockers Encountered</label>
              <textarea 
                className={styles.textarea} 
                style={{ minHeight: 70 }}
                placeholder="Mention any material delays, power outage, customer changes, site access restrictions..."
                value={formIssues}
                onChange={e => setFormIssues(e.target.value)}
              />
            </div>

            {/* Photo Uploader */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>Progress Photos (Recommended for documentation)</label>
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
                    Uploading to cloud storage ({uploadProgress}%)...
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
