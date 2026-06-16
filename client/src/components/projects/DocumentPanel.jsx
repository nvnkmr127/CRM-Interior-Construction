import React, { useState, useEffect, useMemo } from 'react';
import { Badge, Button } from '../ui';
import styles from './DocumentPanel.module.css';
import { getDocuments } from '../../api/projects';
import { useToast } from '../../store/toastContext';

const TYPE_META = {
  Drawing:  { icon: '📐' },
  BOQ:      { icon: '📋' },
  Render:   { icon: '🖼' },
  Contract: { icon: '📄' },
  Photo:    { icon: '📸' },
  Invoice:  { icon: '💵' },
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
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getDocuments(projectId)
      .then(res => {
        const _r = res.data?.data || res.data; const raw = Array.isArray(_r) ? _r : [];
        setDocs(raw.map(d => ({
          id: d.id,
          name: d.file_name || d.name,
          type: d.category || d.type || 'Other',
          version: d.version ? `v${d.version}` : 'v1',
          status: d.status || 'pending',
          uploadedBy: d.uploaded_by_name || d.uploadedBy || '—',
          timeAgo: timeAgo(d.created_at || d.uploadedAt),
          revReq: d.revision_note || null,
          url: d.url || null,
        })));
      })
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
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

  const handleUpload = () => {
    toast.info?.('Upload flow requires S3 presigned URL — contact admin.');
  };

  if (loading) {
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
            No documents found.
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
        <Button variant="primary" onClick={handleUpload} loading={uploading}>
          + Upload
        </Button>
      </div>
    </div>
  );
}
