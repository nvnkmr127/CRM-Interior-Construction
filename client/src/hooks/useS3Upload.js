import { useState } from 'react'
import axios from 'axios'  // bare axios, NOT our intercepted instance
import { getUploadUrl, registerDocument } from '../api/projects.js'

// Generic S3 upload hook
// Usage:
//   const { upload, uploading, progress, error } = useS3Upload()
//   const result = await upload({ projectId, file, docType })

export function useS3Upload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [error, setError]         = useState(null)

  const upload = async ({ projectId, file, docType = 'photo', phaseId = null }) => {
    setUploading(true); setProgress(0); setError(null)
    try {
      // 1. Get presigned upload URL from our server
      const { uploadUrl, storageKey } = await getUploadUrl(projectId, {
        name: file.name,
        mimeType: file.type,
        docType,
        phaseId,
      })

      // 2. Upload directly to S3 (bypass our axios interceptor — no auth header to S3)
      await axios.put(uploadUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded * 100) / e.total))
        },
      })

      // 3. Register the document in our DB
      const doc = await registerDocument(projectId, {
        storageKey,
        name: file.name,
        docType,
        phaseId,
        fileSize: file.size,
        mimeType: file.type,
      })

      return { storageKey, doc }
    } catch(e) {
      const msg = 'Upload failed. Please try again.'
      setError(msg)
      throw e
    } finally {
      setUploading(false)
    }
  }

  // Simpler version: just get presigned URL + upload (no registration)
  // Used for handover photos and snag photos
  const uploadRaw = async ({ file, projectId, purpose = 'photo' }) => {
    setUploading(true); setProgress(0); setError(null)
    try {
      const { uploadUrl, storageKey } = await getUploadUrl(projectId, {
        name: `${purpose}-${Date.now()}-${file.name}`,
        mimeType: file.type,
        docType: purpose,
      })
      await axios.put(uploadUrl, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (e) => setProgress(Math.round(e.loaded*100/e.total)),
      })
      return storageKey
    } catch(e) {
      setError('Upload failed'); throw e
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploadRaw, uploading, progress, error }
}
