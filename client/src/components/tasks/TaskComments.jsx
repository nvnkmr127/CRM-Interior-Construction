import { useState, useEffect, useRef, useCallback } from 'react'
import { getTaskComments, addTaskComment, updateTaskComment, deleteTaskComment, reactTaskComment, getGlobalTaskComments, addGlobalTaskComment, updateGlobalTaskComment, deleteGlobalTaskComment, reactGlobalTaskComment } from '../../api/tasks'
import CommentThread from './CommentThread'
import CommentEditor from './CommentEditor'
import { Spinner } from '../ui'
import styles from './TaskComments.module.css'

export default function TaskComments({ projectId, taskId, isGlobal = false }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  
  const observerRef = useRef()

  const loadComments = useCallback(async (pageNum = 1, append = false) => {
    try {
      let res;
      if (isGlobal) {
        res = await getGlobalTaskComments(taskId, { page: pageNum, limit: 10 });
      } else {
        res = await getTaskComments(projectId, taskId, { page: pageNum, limit: 10 });
      }
      
      const newComments = res.data.data;
      if (append) {
        // Only append if they don't already exist to prevent dupes in polling
        setComments(prev => {
          const existingIds = new Set(prev.map(c => c.id))
          const filtered = newComments.filter(c => !existingIds.has(c.id))
          return [...prev, ...filtered]
        })
      } else {
        setComments(newComments)
      }
      
      setHasMore(newComments.length === 10)
    } catch (error) {
      console.error('Failed to load comments', error)
    } finally {
      setLoading(false)
    }
  }, [projectId, taskId, isGlobal])

  useEffect(() => {
    setLoading(true)
    setPage(1)
    loadComments(1, false)
  }, [taskId, loadComments])

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(() => {
      // Just poll the first page to get latest root comments
      loadComments(1, true)
    }, 5000)
    return () => clearInterval(interval)
  }, [loadComments])

  const lastCommentElementRef = useCallback(node => {
    if (loading) return
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => {
          const nextPage = prev + 1
          loadComments(nextPage, true)
          return nextPage
        })
      }
    })
    if (node) observerRef.current.observe(node)
  }, [loading, hasMore, loadComments])

  const handleCreate = async (content, parentId = null) => {
    const data = { content, parent_id: parentId }
    try {
      let res;
      if (isGlobal) {
        res = await addGlobalTaskComment(taskId, data)
      } else {
        res = await addTaskComment(projectId, taskId, data)
      }
      setComments(prev => [res.data, ...prev])
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'success', message: 'Comment posted' } }))
    } catch (e) {
      console.error(e)
    }
  }

  const handleEdit = async (commentId, content) => {
    try {
      let res;
      if (isGlobal) {
        res = await updateGlobalTaskComment(taskId, commentId, { content })
      } else {
        res = await updateTaskComment(projectId, taskId, commentId, { content })
      }
      setComments(prev => prev.map(c => c.id === commentId ? res.data : c))
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (commentId) => {
    if (!window.confirm('Delete comment?')) return
    try {
      if (isGlobal) {
        await deleteGlobalTaskComment(taskId, commentId)
      } else {
        await deleteTaskComment(projectId, taskId, commentId)
      }
      setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId))
    } catch (e) {
      console.error(e)
    }
  }

  const handleReact = async (commentId, reaction) => {
    try {
      let res;
      if (isGlobal) {
        res = await reactGlobalTaskComment(taskId, commentId, reaction)
      } else {
        res = await reactTaskComment(projectId, taskId, commentId, reaction)
      }
      setComments(prev => prev.map(c => c.id === commentId ? res.data : c))
    } catch (e) {
      console.error(e)
    }
  }

  const rootComments = comments.filter(c => !c.parent_id)

  return (
    <div className={styles.container}>
      <div className={styles.newCommentBox}>
        <Avatar name="Admin User" size="md" />
        <div style={{ flex: 1 }}>
          <CommentEditor onSubmit={(content) => handleCreate(content)} />
        </div>
      </div>

      <div className={styles.commentsList}>
        {rootComments.map((comment, index) => {
          const isLast = index === rootComments.length - 1
          return (
            <div key={comment.id} ref={isLast ? lastCommentElementRef : null}>
              <CommentThread 
                comment={comment}
                replies={comments.filter(c => c.parent_id === comment.id)}
                allComments={comments}
                onReply={(parentId, content) => handleCreate(content, parentId)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReact={handleReact}
              />
            </div>
          )
        })}
        {loading && <div className={styles.loading}><Spinner size="sm" /></div>}
        {!loading && rootComments.length === 0 && (
          <div className={styles.empty}>No comments yet. Start the discussion!</div>
        )}
      </div>
    </div>
  )
}
