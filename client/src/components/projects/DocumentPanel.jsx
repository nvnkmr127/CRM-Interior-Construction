import React, { useState } from 'react';
import { Badge, Button } from '../ui';
import styles from './DocumentPanel.module.css';

export default function DocumentPanel({ projectId }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [uploading, setUploading] = useState(false);

  const filters = [
    { id: 'All', icon: '📁', count: 12 },
    { id: 'Drawing', icon: '📐', count: 4 },
    { id: 'BOQ', icon: '📋', count: 2 },
    { id: 'Render', icon: '🖼', count: 3 },
    { id: 'Contract', icon: '📄', count: 1 },
    { id: 'Photo', icon: '📸', count: 2 },
    { id: 'Invoice', icon: '💵', count: 0 }
  ];

  const documents = [
    { id: 1, name: 'Living Room Layout Final.pdf', type: 'Drawing', version: 'v3', status: 'approved', uploadedBy: 'Priya D.', timeAgo: '2 days ago', revReq: null },
    { id: 2, name: 'Kitchen 3D Render', type: 'Render', version: 'v1', status: 'revision', uploadedBy: 'Rahul S.', timeAgo: '1 day ago', revReq: 'Revision: needs new colour scheme' },
    { id: 3, name: 'Project Contract signed.pdf', type: 'Contract', version: 'v1', status: 'approved', uploadedBy: 'Admin', timeAgo: '1 week ago', revReq: null },
  ];

  const getStatusVariant = (st) => {
    if (st === 'approved') return 'success';
    if (st === 'revision') return 'danger';
    return 'warning';
  };

  const filteredDocs = activeFilter === 'All' ? documents : documents.filter(d => d.type === activeFilter);

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => setUploading(false), 2000); // simulate upload
  };

  return (
    <div className={styles.panel}>
      <div className={styles.sidebar}>
        {filters.map(f => (
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
        {filteredDocs.map(doc => (
          <div key={doc.id} className={styles.docCard}>
            <div className={styles.cardTop}>
              <div className={styles.iconLg}>
                {filters.find(f => f.id === doc.type)?.icon || '📄'}
              </div>
              <div style={{display:'flex', gap:'4px', flexDirection:'column', alignItems:'flex-end'}}>
                <Badge variant="accent" size="sm">{doc.version}</Badge>
                <Badge variant={getStatusVariant(doc.status)} size="sm" dot>{doc.status}</Badge>
              </div>
            </div>
            <div className={styles.name} title={doc.name}>{doc.name}</div>
            <div className={styles.meta}>
              <div className={styles.avatar}>{doc.uploadedBy.charAt(0)}</div>
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
          {uploading ? 'Uploading to S3...' : '+ Upload'}
        </Button>
      </div>
    </div>
  );
}
