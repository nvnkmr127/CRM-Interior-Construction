import { useState, useEffect } from 'react'
import styles from './PortalSnags.module.css'
import { useToast } from '../../store/toastContext'

const CATEGORIES = ['Carpentry', 'Electrical', 'Plumbing', 'Paint', 'Flooring', 'Other']

export default function PortalSnags() {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  // Form State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [desc, setDesc] = useState('')
  const [photos, setPhotos] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      setIssues([
        { id: '1', title: 'Paint peeling near window', category: 'Paint', desc: 'The paint is starting to peel off near the master bedroom window sill.', status: 'resolved', resolutionNote: 'Scraped the area, applied primer and repainted with two coats. Wait 24h to dry fully.', reportedAt: new Date(Date.now()-86400000*3).toISOString(), photos: ['/placeholder.jpg'] },
        { id: '2', title: 'Wardrobe door alignment', category: 'Carpentry', desc: 'Left door of master wardrobe scraping the bottom drawer.', status: 'in_progress', reportedAt: new Date(Date.now()-3600000*5).toISOString(), photos: [] },
        { id: '3', title: 'Missing handle on kitchen cabinet', category: 'Carpentry', status: 'verified', resolutionNote: 'Attached missing D-handle.', reportedAt: new Date(Date.now()-86400000*5).toISOString(), photos: [] }
      ])
      setLoading(false)
    }, 600)
  }, [])

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files)
    // Mock creating object URLs for preview
    const newPhotos = files.map(f => ({ file: f, url: URL.createObjectURL(f) }))
    setPhotos([...photos, ...newPhotos])
  }

  const removePhoto = (index) => {
    const newPhotos = [...photos]
    URL.revokeObjectURL(newPhotos[index].url)
    newPhotos.splice(index, 1)
    setPhotos(newPhotos)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title || !category) return toast.error('Please provide a title and category.')
    setSubmitting(true)
    
    // Mock API call
    await new Promise(r => setTimeout(r, 1200))
    
    const newIssue = {
      id: Date.now().toString(),
      title, category, desc, status: 'open',
      reportedAt: new Date().toISOString(),
      photos: photos.map(p => p.url)
    }
    
    setIssues([newIssue, ...issues])
    setTitle('')
    setCategory('')
    setDesc('')
    setPhotos([])
    setSubmitting(false)
    toast.success('✓ Issue reported successfully!')
  }

  const handleVerify = (id) => {
    setIssues(issues.map(iss => iss.id === id ? { ...iss, status: 'verified' } : iss))
    toast.success('✓ Issue verified and closed!')
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Report an Issue</h1>
        <div className={styles.pageSub}>Found something that needs attention? Let us know.</div>
      </div>

      <div className={styles.card}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Issue Title *</label>
            <input 
              type="text" 
              className={styles.input} 
              placeholder="e.g. Kitchen cabinet door not aligned"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Category *</label>
            <select className={styles.select} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Select a category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Description</label>
            <textarea 
              className={styles.textarea} 
              placeholder="Provide any additional details..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          <div className={styles.photoUploader}>
            <label className={styles.label}>Photos (Optional)</label>
            <div className={styles.photoStrip}>
              {photos.map((p, i) => (
                <div key={i} className={styles.photoThumb}>
                  <img src={p.url} alt="Preview" className={styles.thumbImg} />
                  <button type="button" className={styles.removeBtn} onClick={() => removePhoto(i)}>✕</button>
                </div>
              ))}
              <label className={styles.uploadArea}>
                +
                <input type="file" multiple accept="image/*" onChange={handlePhotoSelect} />
              </label>
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={submitting || !title || !category}>
            {submitting ? 'Submitting...' : 'Submit Issue'}
          </button>
        </form>
      </div>

      {loading ? (
        <div style={{padding: 24, textAlign: 'center', color: 'var(--color-text-muted)'}}>Loading your issues...</div>
      ) : (
        <div style={{marginTop: 16}}>
          <h2 className={styles.sectionTitle}>
            My Reported Issues
            <span className={styles.countBadge}>{issues.length}</span>
          </h2>

          <div className={styles.issueList}>
            {issues.length === 0 ? (
              <div className={styles.emptyState}>✓ No issues reported yet.</div>
            ) : (
              issues.map(iss => (
                <div key={iss.id} className={`${styles.issueCard} ${iss.status === 'verified' ? styles.verified : ''}`}>
                  <div className={styles.issueHeader}>
                    <div>
                      <div className={styles.issueTitle}>{iss.title}</div>
                      <div className={styles.issueMeta}>
                        <span className={styles.catChip}>{iss.category}</span>
                        <span>Reported {Math.ceil((Date.now() - new Date(iss.reportedAt).getTime()) / 86400000)} days ago</span>
                      </div>
                    </div>
                    <div className={`${styles.statusBadge} ${styles[iss.status]}`}>
                      {iss.status === 'verified' ? 'Closed ✓' : iss.status.replace('_', ' ')}
                    </div>
                  </div>

                  {iss.photos && iss.photos.length > 0 && (
                    <div className={styles.photoStrip} style={{marginTop: 8}}>
                      {iss.photos.map((p, i) => (
                        <div key={i} className={styles.photoThumb} style={{background: '#eee', color: '#aaa', fontSize: 10}}>IMG</div>
                      ))}
                    </div>
                  )}

                  {iss.status === 'resolved' && (
                    <div className={styles.resolutionBox}>
                      <div className={styles.resolutionTitle}>Resolution</div>
                      <div className={styles.resolutionNote}>{iss.resolutionNote}</div>
                      <button className={styles.verifyBtn} onClick={() => handleVerify(iss.id)}>✓ Mark as Verified</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
