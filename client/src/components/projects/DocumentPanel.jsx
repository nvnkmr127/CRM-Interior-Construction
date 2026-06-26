import React, { useState, useEffect, useMemo } from 'react';
import { Badge, Button, Modal, Spinner } from '../ui';
import styles from './DocumentPanel.module.css';
import { getDocuments } from '../../api/projects';
import { useToast } from '../../store/toastContext';
import { useS3Upload } from '../../hooks/useS3Upload';

const TYPE_META = {
  Drawing:                  { icon: '📐' },
  BOQ:                      { icon: '📋' },
  Render:                   { icon: '🖼' },
  Contract:                 { icon: '📄' },
  Photo:                    { icon: '📸' },
  Invoice:                  { icon: '💵' },
  'Supplier Quotation':     { icon: '🏷️' },
  'Purchase Order':         { icon: '📦' },
  'Delivery Challan':       { icon: '🚚' },
  'Inspection Certificate': { icon: '🛡️' },
  'Vendor Warranty Card':   { icon: '🎫' },
};

const NORMALIZE_TYPE = {
  drawing:                  'Drawing',
  boq:                      'BOQ',
  render:                   'Render',
  contract:                 'Contract',
  photo:                    'Photo',
  invoice:                  'Invoice',
  supplier_quotation:       'Supplier Quotation',
  purchase_order:           'Purchase Order',
  delivery_challan:         'Delivery Challan',
  inspection_certificate:   'Inspection Certificate',
  vendor_warranty_card:     'Vendor Warranty Card'
};

const DB_TYPE_MAP = {
  'Drawing':                  'drawing',
  'BOQ':                      'boq',
  'Render':                   'render',
  'Contract':                 'contract',
  'Photo':                    'photo',
  'Invoice':                  'invoice',
  'Supplier Quotation':       'supplier_quotation',
  'Purchase Order':           'purchase_order',
  'Delivery Challan':         'delivery_challan',
  'Inspection Certificate':   'inspection_certificate',
  'Vendor Warranty Card':     'vendor_warranty_card'
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getStatusVariant(st) {
  if (st === 'approved') return 'success';
  if (st === 'revision_requested') return 'danger';
  return 'warning';
}

export default function DocumentPanel({ projectId }) {
  const toast = useToast();
  const { upload } = useS3Upload();
  
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [uploading, setUploading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    file: null,
    docType: 'Drawing'
  });

  const fetchDocs = () => {
    setLoading(true);
    getDocuments(projectId)
      .then(res => {
        const _r = res.data?.data || res.data;
        const raw = Array.isArray(_r) ? _r : [];
        setDocs(raw.map(d => {
          const rawType = d.doc_type || d.docType || d.category || d.type || '';
          const normalized = NORMALIZE_TYPE[rawType.toLowerCase()] || rawType;
          return {
            id: d.id,
            name: d.file_name || d.name,
            type: normalized || 'Other',
            version: d.version ? `v${d.version}` : 'v1',
            status: d.status || 'pending',
            uploadedBy: d.uploaded_by_name || d.uploadedBy || '—',
            timeAgo: timeAgo(d.created_at || d.uploadedAt),
            revReq: d.revision_note || null,
            url: d.url || null,
          };
        }));
      })
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (projectId) {
      fetchDocs();
    }
  }, [projectId]);

  const typeFilters = useMemo(() => {
    const counts = {};
    docs.forEach(d => { counts[d.type] = (counts[d.type] || 0) + 1; });
    return [
      { id: 'All', icon: '📁', count: docs.length },
      ...Object.entries(TYPE_META).map(([id, meta]) => ({
        id,
        icon: meta.icon,
        count: counts[id] || 0,
      })),
    ];
  }, [docs]);

  const filteredDocs = activeFilter === 'All' ? docs : docs.filter(d => d.type === activeFilter);

  const openUploadModal = () => {
    setUploadForm({
      file: null,
      docType: 'Drawing'
    });
    setIsUploadModalOpen(true);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) {
      toast.error('Please select a file to upload.');
      return;
    }

    setUploading(true);
    try {
      const dbDocType = DB_TYPE_MAP[uploadForm.docType] || uploadForm.docType.toLowerCase();
      await upload({
        projectId,
        file: uploadForm.file,
        docType: dbDocType
      });
      toast.success('Document uploaded and registered successfully!');
      setIsUploadModalOpen(false);
      setUploadForm({ file: null, docType: 'Drawing' });
      fetchDocs();
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading && docs.length === 0) {
    return <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>Loading documents…</div>;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.sidebar}>
        {typeFilters.map(f => (
          <div
            key={f.id}
            className={`${styles.filterItem} ${activeFilter === f.id ? styles.filterActive : ''}`}
            onClick={() => setActiveFilter(f.id)}
          >
            <div className={styles.filterLeft}><span>{f.icon}</span> {f.id}</div>
            <Badge variant="neutral" size="sm">{f.count}</Badge>
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {filteredDocs.length === 0 ? (
          <div style={{ gridColumn: '1/-1', padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No documents found in this category.
          </div>
        ) : filteredDocs.map(doc => (
          <div key={doc.id} className={styles.docCard}>
            <div className={styles.cardTop}>
              <div className={styles.iconLg}>
                {TYPE_META[doc.type]?.icon || '📄'}
              </div>
              <div style={{ display: 'flex', gap: 4, flexDirection: 'column', alignItems: 'flex-end' }}>
                <Badge variant="accent" size="sm">{doc.version}</Badge>
                <Badge variant={getStatusVariant(doc.status)} size="sm" dot>
                  {doc.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
            <div
              className={styles.name}
              title={doc.name}
              style={{ cursor: doc.url ? 'pointer' : 'default' }}
              onClick={() => doc.url && window.open(doc.url, '_blank')}
            >
              {doc.name}
            </div>
            <div className={styles.meta}>
              <div className={styles.avatar}>{(doc.uploadedBy || '?').charAt(0)}</div>
              {doc.uploadedBy} &middot; {doc.timeAgo}
            </div>
            {doc.revReq && (
              <div className={styles.revisionBanner}>{doc.revReq}</div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.uploadBtn}>
        <Button variant="primary" onClick={openUploadModal}>
          + Upload Document
        </Button>
      </div>

      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => !uploading && setIsUploadModalOpen(false)}
        title="Upload Project Document"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsUploadModalOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUploadSubmit} loading={uploading}>
              Upload
            </Button>
          </>
        }
      >
        <form onSubmit={handleUploadSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Select Document File</label>
            <input
              type="file"
              onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
              className={styles.fileInput}
              required
              disabled={uploading}
            />
            {uploadForm.file && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                Selected: {uploadForm.file.name} ({Math.round(uploadForm.file.size / 1024)} KB)
              </span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label>Document Category</label>
            <select
              value={uploadForm.docType}
              onChange={(e) => setUploadForm({ ...uploadForm, docType: e.target.value })}
              className={styles.selectInput}
              disabled={uploading}
            >
              {Object.keys(TYPE_META).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
