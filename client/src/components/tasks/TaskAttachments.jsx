import { useState, useEffect, useCallback, useRef } from 'react'
import { getTaskAttachments, uploadTaskAttachment, deleteTaskAttachment, replaceTaskAttachment, getGlobalTaskAttachments, uploadGlobalTaskAttachment, deleteGlobalTaskAttachment, replaceGlobalTaskAttachment } from '../../api/tasks'
import AttachmentCard from './AttachmentCard'
import { useToast } from '../../store/toastContext'
import { Spinner } from '../ui'
import styles from './TaskAttachments.module.css'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export default function TaskAttachments({ projectId, taskId, isGlobal = false }) {
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploads, setUploads] = useState({}) // { id: progress }
  const [isDragOver, setIsDragOver] = useState(false)
  
  const toast = useToast()
  const fileInputRef = useRef(null)

  const loadAttachments = useCallback(async () => {
    try {
      let res;
      if (isGlobal) {
        res = await getGlobalTaskAttachments(taskId)
      } else {
        res = await getTaskAttachments(projectId, taskId)
      }
      setAttachments(res.data)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load attachments')
    } finally {
      setLoading(false)
    }
  }, [projectId, taskId, isGlobal, toast])

  useEffect(() => {
    loadAttachments()
  }, [loadAttachments])

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = error => reject(error)
  })

  const simulateProgress = (uploadId) => {
    setUploads(prev => ({ ...prev, [uploadId]: 0 }))
    const interval = setInterval(() => {
      setUploads(prev => {
        const current = prev[uploadId] || 0
        if (current >= 90) {
          clearInterval(interval)
          return prev
        }
        return { ...prev, [uploadId]: current + 10 }
      })
    }, 150)
    return interval
  }

  const handleFiles = async (files) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 50MB limit`)
        continue
      }
      
      const uploadId = `upload-${Date.now()}-${i}`
      const interval = simulateProgress(uploadId)
      
      try {
        const base64 = await fileToBase64(file)
        const payload = {
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          url: base64
        }
        
        let res;
        if (isGlobal) {
          res = await uploadGlobalTaskAttachment(taskId, payload)
        } else {
          res = await uploadTaskAttachment(projectId, taskId, payload)
        }
        
        setUploads(prev => ({ ...prev, [uploadId]: 100 }))
        setTimeout(() => {
          setUploads(prev => {
            const next = { ...prev }
            delete next[uploadId]
            return next
          })
          setAttachments(prev => [...prev, res.data])
        }, 300)
      } catch (e) {
        clearInterval(interval)
        setUploads(prev => {
          const next = { ...prev }
          delete next[uploadId]
          return next
        })
        toast.error(`Failed to upload ${file.name}`)
      }
    }
  }

  const onDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const onDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  const handleDelete = async (attachmentId) => {
    if (!window.confirm('Delete this attachment?')) return
    try {
      if (isGlobal) {
        await deleteGlobalTaskAttachment(taskId, attachmentId)
      } else {
        await deleteTaskAttachment(projectId, taskId, attachmentId)
      }
      setAttachments(prev => prev.filter(a => a.id !== attachmentId))
      toast.success('Attachment deleted')
    } catch (e) {
      toast.error('Failed to delete attachment')
    }
  }

  const handleUpdateVersion = async (attachmentId, newFile) => {
    if (newFile.size > MAX_FILE_SIZE) {
      toast.error(`${newFile.name} exceeds 50MB limit`)
      return
    }

    const uploadId = `upload-${attachmentId}`
    const interval = simulateProgress(uploadId)

    try {
      const base64 = await fileToBase64(newFile)
      const payload = {
        name: newFile.name,
        type: newFile.type || 'application/octet-stream',
        size: newFile.size,
        url: base64
      }

      let res;
      if (isGlobal) {
        res = await replaceGlobalTaskAttachment(taskId, attachmentId, payload)
      } else {
        res = await replaceTaskAttachment(projectId, taskId, attachmentId, payload)
      }

      setUploads(prev => ({ ...prev, [uploadId]: 100 }))
      setTimeout(() => {
        setUploads(prev => {
          const next = { ...prev }
          delete next[uploadId]
          return next
        })
        setAttachments(prev => prev.map(a => a.id === attachmentId ? res.data : a))
        toast.success('Version updated')
      }, 300)

    } catch (e) {
      clearInterval(interval)
      setUploads(prev => {
        const next = { ...prev }
        delete next[uploadId]
        return next
      })
      toast.error('Failed to update version')
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Attachments</div>
        <div className={styles.count}>{attachments.length} files</div>
      </div>

      <div 
        className={`${styles.dropzone} ${isDragOver ? styles.dragOver : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className={styles.dropIcon}>☁️</div>
        <div>Drag & drop files here or click to upload</div>
        <div className={styles.dropMeta}>Supports Images, PDF, Word, Excel, CAD, Video, ZIP (Max 50MB)</div>
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {Object.keys(uploads).length > 0 && (
        <div className={styles.uploadsList}>
          {Object.entries(uploads).map(([id, progress]) => (
            <div key={id} className={styles.uploadItem}>
              <div className={styles.uploadLabel}>Uploading... {progress}%</div>
              <div className={styles.progressBarBg}>
                <div className={styles.progressBarFill} style={{ width: `${progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}><Spinner size="sm" /></div>
      ) : (
        <div className={styles.grid}>
          {attachments.map(att => (
            <AttachmentCard 
              key={att.id} 
              attachment={att} 
              onDelete={handleDelete}
              onUpdateVersion={handleUpdateVersion}
            />
          ))}
        </div>
      )}
    </div>
  )
}
