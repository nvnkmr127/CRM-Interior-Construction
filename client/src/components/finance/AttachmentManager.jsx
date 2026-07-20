import React, { useState, useEffect, useRef } from 'react';
import styles from './AttachmentManager.module.css';
import api from '../../../utils/api';
import DocumentPreviewModal from './DocumentPreviewModal';

export default function AttachmentManager({ approvalId, currentUserRole, currentUserId }) {
  const [attachments, setAttachments] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [previewDocs, setPreviewDocs] = useState([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [currentHistory, setCurrentHistory] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (approvalId) {
      fetchAttachments();
    }
  }, [approvalId]);

  const fetchAttachments = async () => {
    try {
      const { data } = await api.get(`/api/financial-approvals/${approvalId}/attachments`);
      setAttachments(data || []);
    } catch (err) {
      console.error('Failed to fetch attachments:', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const onFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files) => {
    const validFiles = files.filter(f => {
      // Basic validation
      if (f.size > 50 * 1024 * 1024) {
        alert(`${f.name} is too large. Max 50MB.`);
        return false;
      }
      return true;
    });
    
    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }
  };

  const uploadFiles = async (files) => {
    // Add to uploading state to show progress
    const newUploads = files.map(f => ({
      id: Math.random().toString(36),
      name: f.name,
      progress: 0,
      status: 'uploading' // uploading, scanning
    }));
    setUploadingFiles(prev => [...prev, ...newUploads]);

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      // Simulate progress for UI
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev => prev.map(uf => {
          if (uf.progress < 90) return { ...uf, progress: uf.progress + 10 };
          if (uf.progress >= 90 && uf.status === 'uploading') return { ...uf, status: 'scanning' };
          return uf;
        }));
      }, 300);

      const res = await api.post(`/api/financial-approvals/${approvalId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      clearInterval(progressInterval);
      
      setUploadingFiles(prev => prev.filter(uf => !newUploads.find(nu => nu.id === uf.id)));
      fetchAttachments();
    } catch (err) {
      console.error(err);
      alert('Upload failed');
      setUploadingFiles(prev => prev.filter(uf => !newUploads.find(nu => nu.id === uf.id)));
    }
  };

  const handleReplace = async (attachmentId, file) => {
    if (file.size > 50 * 1024 * 1024) return alert('File too large');

    setUploadingFiles(prev => [...prev, { id: 'replace', name: 'Replacing...', progress: 50, status: 'scanning' }]);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.put(`/api/financial-approvals/${approvalId}/attachments/${attachmentId}/replace`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadingFiles(prev => prev.filter(uf => uf.id !== 'replace'));
      fetchAttachments();
    } catch (err) {
      alert('Failed to replace file');
      setUploadingFiles(prev => prev.filter(uf => uf.id !== 'replace'));
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm('Delete this attachment? This action cannot be undone.')) return;
    try {
      await api.delete(`/api/financial-approvals/${approvalId}/attachments/${attachmentId}`);
      fetchAttachments();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const handlePreview = (doc) => {
    // Log "Opened" asynchronously
    api.post(`/api/financial-approvals/${approvalId}/activity`, { action: 'Opened', details: { file: doc.name } }).catch(()=>{});
    
    setPreviewDocs([
      { name: doc.name, type: doc.mime_type, url: doc.url }
    ]);
    setIsPreviewOpen(true);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const fetchHistory = async (attachmentId) => {
    try {
      const { data } = await api.get(`/api/financial-approvals/${approvalId}/attachments/${attachmentId}/history`);
      setCurrentHistory(data || []);
      setHistoryModalOpen(true);
    } catch (err) {
      alert('Failed to fetch history');
    }
  };

  const getIcon = (mime) => {
    if (!mime) return '📎';
    if (mime.includes('pdf')) return '📄';
    if (mime.includes('image')) return '🖼️';
    if (mime.includes('excel') || mime.includes('sheet') || mime.includes('csv')) return '📊';
    return '📎';
  };

  // Permissions
  const canModify = currentUserRole === 'admin' || currentUserRole === 'superadmin' || currentUserRole === 'Finance Manager';

  return (
    <div className={styles.container}>
      {/* Dropzone */}
      <div 
        className={`${styles.dropzone} ${isDragging ? styles.active : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className={styles.uploadIcon}>☁️</div>
        <div className={styles.uploadText}>Drag & drop files here, or click to select</div>
        <div className={styles.uploadSubtext}>Supports PDF, Images, Excel (Max 50MB)</div>
        <input 
          type="file" 
          multiple 
          className={styles.fileInput} 
          onChange={onFileInputChange}
          ref={fileInputRef}
        />
      </div>

      {/* Uploading Status */}
      {uploadingFiles.length > 0 && (
        <div className={styles.uploadingList}>
          {uploadingFiles.map((uf, i) => (
            <div key={i} className={styles.uploadingItem}>
              <div className={styles.uploadingHeader}>
                <span>{uf.name}</span>
                <span>{uf.status === 'scanning' ? 'Virus Scanning...' : `${uf.progress}%`}</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={`${styles.progressFill} ${uf.status === 'scanning' ? styles.scanning : ''}`}
                  style={{ width: `${uf.progress}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attachments List */}
      <div className={styles.attachmentList}>
        {attachments.map(att => {
          const isOwner = att.uploaded_by === currentUserId;
          const hasFullAccess = canModify || isOwner;

          return (
            <div key={att.id} className={styles.attachmentItem}>
              <div className={styles.itemLeft}>
                <div className={styles.itemIcon}>{getIcon(att.mime_type)}</div>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName} title={att.name}>{att.name}</span>
                  <div className={styles.itemMeta}>
                    <span>{formatSize(att.size_bytes)}</span>
                    <span>•</span>
                    <span>{new Date(att.created_at).toLocaleDateString()}</span>
                    {att.version > 1 && (
                      <span className={styles.versionBadge}>v{att.version}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className={styles.itemActions}>
                <button className={styles.actionBtn} onClick={() => handlePreview(att)}>Preview</button>
                <button 
                  className={styles.actionBtn} 
                  onClick={() => {
                    // Log "Downloaded" asynchronously
                    api.post(`/api/financial-approvals/${approvalId}/activity`, { action: 'Downloaded', details: { file: att.name } }).catch(()=>{});
                    const a = document.createElement('a');
                    a.href = att.url;
                    a.download = att.name;
                    a.target = '_blank';
                    a.click();
                  }}
                >
                  Download
                </button>
                
                {hasFullAccess && (
                  <>
                    <div className={styles.replaceWrapper}>
                      <button className={styles.actionBtn}>Replace</button>
                      <input 
                        type="file" 
                        className={styles.replaceInput} 
                        onChange={(e) => {
                          if (e.target.files[0]) handleReplace(att.id, e.target.files[0]);
                          e.target.value = ''; // reset
                        }}
                      />
                    </div>
                    {att.version > 1 && (
                      <button className={styles.actionBtn} onClick={() => fetchHistory(att.id)}>History</button>
                    )}
                    <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => handleDelete(att.id)}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* History Modal */}
      {historyModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface-color, #fff)', width: '500px', maxWidth: '90%', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>Version History</h3>
              <button onClick={() => setHistoryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <div style={{ padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
              {currentHistory.map((h, idx) => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '8px', background: h.status === 'active' ? 'var(--bg-secondary)' : 'transparent' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{h.name} <span className={styles.versionBadge}>v{h.version}</span> {h.status === 'active' && <span style={{fontSize: '0.7rem', color: '#10b981'}}>(Active)</span>}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>By {h.uploaded_by_name || 'User'} on {new Date(h.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className={styles.actionBtn} onClick={() => handlePreview(h)}>Preview</button>
                    <button className={styles.actionBtn} onClick={() => {
                      // Log "Downloaded" asynchronously
                      api.post(`/api/financial-approvals/${approvalId}/activity`, { action: 'Downloaded', details: { file: h.name, version: h.version } }).catch(()=>{});
                      const a = document.createElement('a');
                      a.href = h.url; a.download = h.name; a.target = '_blank'; a.click();
                    }}>Download</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal hooked internally */}
      <DocumentPreviewModal 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
        documents={previewDocs}
      />
    </div>
  );
}
