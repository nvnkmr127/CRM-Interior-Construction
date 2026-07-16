/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import { useState, useRef, useEffect } from 'react'
import { Button } from '../ui'
import styles from './AttachmentCard.module.css'

export default function AttachmentCard({ attachment, onDelete, onUpdateVersion }) {
  const [thumbnailUrl, setThumbnailUrl] = useState(null)
  
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (attachment.type.startsWith('image/')) {
      setThumbnailUrl(attachment.url)
    } else if (attachment.type.startsWith('video/')) {
      // Simulate video thumbnail by creating a hidden video element
      const video = document.createElement('video')
      video.src = attachment.url
      video.muted = true
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      video.onloadeddata = () => {
        video.currentTime = 1 // seek to 1 second
      }
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        setThumbnailUrl(canvas.toDataURL('image/jpeg'))
      }
    }
  }, [attachment])

  const getGenericIcon = (type, name) => {
    const ext = name.split('.').pop().toLowerCase()
    if (type === 'application/pdf' || ext === 'pdf') return '📄 PDF'
    if (ext === 'doc' || ext === 'docx') return '📝 DOC'
    if (ext === 'xls' || ext === 'xlsx') return '📊 XLS'
    if (ext === 'dwg' || ext === 'dxf') return '📐 CAD'
    if (ext === 'zip' || ext === 'rar') return '🗜️ ZIP'
    return '📁 FILE'
  }

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = attachment.url
    a.download = attachment.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onUpdateVersion(attachment.id, e.target.files[0])
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.previewArea}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={attachment.name} className={styles.thumbnail} />
        ) : (
          <div className={styles.genericIcon}>
            {getGenericIcon(attachment.type, attachment.name)}
          </div>
        )}
      </div>
      
      <div className={styles.details}>
        <div className={styles.name} title={attachment.name}>{attachment.name}</div>
        <div className={styles.meta}>
          {formatSize(attachment.size)} • v{attachment.version}
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={handleDownload} title="Download">⬇️</button>
        <button className={styles.actionBtn} onClick={() => fileInputRef.current?.click()} title="Upload new version">🔄</button>
        <button className={styles.actionBtn} onClick={() => onDelete(attachment.id)} title="Delete">❌</button>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange}
      />
    </div>
  )
}
