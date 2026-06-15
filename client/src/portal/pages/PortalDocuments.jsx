import { useState, useEffect } from 'react'
import styles from './PortalDocuments.module.css'

const FILTERS = ['All', 'Drawings', 'BOQ', 'Renders', 'Contracts', 'Photos']

export default function PortalDocuments() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')

  useEffect(() => {
    setTimeout(() => {
      setDocuments([
        { id: '1', name: 'Final_Contract_Signed.pdf', category: 'Contracts', type: 'pdf', version: 'v1', addedAt: '2025-01-05' },
        { id: '2', name: 'Master_Bedroom_Renders.zip', category: 'Renders', type: 'image', version: 'v2', addedAt: '2025-01-12' },
        { id: '3', name: 'Kitchen_Plumbing_Layout.pdf', category: 'Drawings', type: 'pdf', version: 'v1', addedAt: '2025-01-14' },
        { id: '4', name: 'Project_BOQ_v3.xlsx', category: 'BOQ', type: 'sheet', version: 'v3', addedAt: '2025-01-15' },
        { id: '5', name: 'Site_Visit_Photos_Week_2.jpg', category: 'Photos', type: 'image', version: 'v1', addedAt: '2025-01-20' },
        { id: '6', name: 'False_Ceiling_Plan.pdf', category: 'Drawings', type: 'pdf', version: 'v2', addedAt: '2025-01-22' }
      ])
      setLoading(false)
    }, 600)
  }, [])

  const filteredDocs = activeFilter === 'All' 
    ? documents 
    : documents.filter(d => d.category === activeFilter)

  const handleDownload = (url) => {
    // window.open(url, '_blank')
    alert('Downloading document...')
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
              <button className={styles.dlBtn} onClick={() => handleDownload('/mock')}>
                ⬇ Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
