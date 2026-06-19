import { useState, useEffect } from 'react'
import api from '../../api/axios'
import styles from './PortalDocuments.module.css'

const FILTERS = ['All', 'Drawings', 'BOQ', 'Renders', 'Contracts', 'Photos']

export default function PortalDocuments() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')

  useEffect(() => {
    api.get('/portal/project/documents')
      .then(res => {
        const raw = res.data?.data || []
        setDocuments(raw.map(d => ({
          id: d.id,
          name: d.name,
          category: d.docType || 'Other',
          type: d.mimeType?.includes('pdf') ? 'pdf' : d.mimeType?.includes('image') ? 'image' : d.mimeType?.includes('sheet') ? 'sheet' : 'doc',
          version: 'v1',
          addedAt: d.createdAt,
          downloadUrl: d.downloadUrl
        })))
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const filteredDocs = activeFilter === 'All' 
    ? documents 
    : documents.filter(d => d.category === activeFilter)

  const handleDownload = (url) => {
    if (url) window.open(url, '_blank')
    else alert('Download link unavailable')
  }

  const getIconClass = (type) => {
    if (type === 'pdf') return styles.pdf
    if (type === 'image') return styles.image
    if (type === 'sheet') return styles.sheet
    if (type === 'doc') return styles.doc
    return ''
  }

  const getIconChar = (type) => {
    if (type === 'pdf') return '📄'
    if (type === 'image') return '🖼'
    if (type === 'sheet') return '📊'
    if (type === 'doc') return '📝'
    return '📁'
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Project Documents</h1>
        <div className={styles.pageSub}>All files shared with you by your project team</div>
      </div>

      <div className={styles.filterStrip}>
        {FILTERS.map(f => (
          <button 
            key={f} 
            className={`${styles.filterBtn} ${activeFilter === f ? styles.active : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{padding: 24, textAlign: 'center', color: 'var(--color-text-muted)'}}>Loading documents...</div>
      ) : filteredDocs.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📁</div>
          <div className={styles.emptyTitle}>No documents found</div>
          <div style={{color:'var(--color-text-secondary)', fontSize:'var(--text-sm)'}}>Check back later or adjust your filters.</div>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredDocs.map(doc => (
            <div key={doc.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={`${styles.fileIcon} ${getIconClass(doc.type)}`}>
                  {getIconChar(doc.type)}
                </div>
                <div className={styles.docInfo}>
                  <div className={styles.versionBadge}>{doc.version}</div>
                  <div className={styles.docName} title={doc.name}>{doc.name}</div>
                  <div className={styles.metaText}>Added {new Date(doc.addedAt).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'})}</div>
                </div>
              </div>
              <button className={styles.dlBtn} onClick={() => handleDownload(doc.downloadUrl)}>
                ⬇ Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
