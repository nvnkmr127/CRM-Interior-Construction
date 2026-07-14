import { useState } from 'react'
import { Button, RichTextEditor } from '../ui'
import styles from './CommentEditor.module.css'

export default function CommentEditor({ initialValue = '', onSubmit, onCancel, submitLabel = 'Comment' }) {
  const [content, setContent] = useState(initialValue)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!content.trim() || content === '<p></p>') return
    setIsSubmitting(true)
    try {
      await onSubmit(content)
      setContent('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.editorContainer}>
      <RichTextEditor value={content} onChange={setContent} />
      <div className={styles.actions}>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={isSubmitting || !content.trim() || content === '<p></p>'}>
          {isSubmitting ? 'Submitting...' : submitLabel}
        </Button>
      </div>
    </div>
  )
}
