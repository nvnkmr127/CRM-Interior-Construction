import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './ApprovalComments.module.css'; // Reuse basic styles

export default function AttachmentManager({ approvalId, currentUserRole, currentUserId }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchAttachments();
  }, [approvalId]);

  const fetchAttachments = async () => {
    try {
      const res = await api.get(`/api/financial-approvals/${approvalId}/attachments`);
      setAttachments(res.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load attachments');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File exceeds 10MB limit.');
      return;
    }

    const formData = new FormData();
    formData.append('document', file);

    setUploading(true);
    try {
      await api.post(`/api/financial-approvals/${approvalId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Document uploaded successfully.');
      fetchAttachments();
    } catch (err) {
      toast.error('Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = null; // reset input
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document permanently?')) return;
    try {
      await api.delete(`/api/financial-approvals/${approvalId}/attachments/${docId}`);
      toast.success('Document deleted.');
      fetchAttachments();
    } catch (err) {
      toast.error('Failed to delete document.');
    }
  };

  const canDelete = (doc) => {
    return currentUserRole === 'superadmin' || doc.uploaded_by === currentUserId;
  };

  if (loading) return <div>Loading documents...</div>;

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Supported formats: PDF, JPG, PNG (Max 10MB)
        </p>
        <label className={styles.primaryBtn} style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
          {uploading ? 'Uploading...' : '📤 Upload Document'}
          <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" />
        </label>
      </div>

      {attachments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--surface-sunken)', borderRadius: '8px' }}>
          No documents attached to this transaction.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
          {attachments.map(doc => (
            <div key={doc.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', background: 'var(--surface-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px' }}>
                  {doc.file_type.includes('pdf') ? '📄' : '🖼️'}
                </span>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.file_name}>
                    {doc.file_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {(doc.file_size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
              
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                Uploaded by {doc.uploader_name} on {new Date(doc.created_at).toLocaleDateString()}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => window.open(doc.file_url, '_blank')}
                  className={styles.secondaryBtn} 
                  style={{ flex: 1, padding: '4px', fontSize: '12px' }}
                >
                  View
                </button>
                {canDelete(doc) && (
                  <button 
                    onClick={() => handleDelete(doc.id)}
                    className={styles.secondaryBtn} 
                    style={{ padding: '4px 8px', fontSize: '12px', color: 'red', borderColor: '#fca5a5' }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
