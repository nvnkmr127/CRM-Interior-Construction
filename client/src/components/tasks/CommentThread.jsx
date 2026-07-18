import { useState } from 'react'
import DOMPurify from 'dompurify'
import { Avatar } from '../ui'
import CommentEditor from './CommentEditor'
import styles from './CommentThread.module.css'

export default function CommentThread({ 
  comment, 
  replies, 
  allComments,
  onReply, 
  onEdit, 
  onDelete, 
  onReact,
  depth = 0 
}) {
  const [isReplying, setIsReplying] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const handleReplySubmit = async (content) => {
    await onReply(comment.id, content)
    setIsReplying(false)
  }

  const handleEditSubmit = async (content) => {
    await onEdit(comment.id, content)
    setIsEditing(false)
  }

  const formatDate = (dateString) => {
    const d = new Date(dateString)
    return d.toLocaleString()
  }

  // Pre-defined emojis for quick reaction
  const REACTION_EMOJIS = ['👍', '❤️', '😄', '👀']

  return (
    <div className={`${styles.threadContainer} ${depth > 0 ? styles.reply : ''}`}>
      <div className={styles.commentBody}>
        <Avatar name={comment.user_name} size="sm" />
        <div className={styles.commentContent}>
          <div className={styles.commentHeader}>
            <span className={styles.userName}>{comment.user_name}</span>
            <span className={styles.timestamp}>{formatDate(comment.created_at)}</span>
          </div>

          {isEditing ? (
            <CommentEditor 
              initialValue={comment.content} 
              onSubmit={handleEditSubmit} 
              onCancel={() => setIsEditing(false)} 
              submitLabel="Save" 
            />
          ) : (
            <div 
              className={styles.htmlContent} 
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.content) }} 
            />
          )}

          <div className={styles.commentActions}>
            <button onClick={() => setIsReplying(!isReplying)} className={styles.actionBtn}>Reply</button>
            {comment.is_own && (
              <>
                <button onClick={() => setIsEditing(!isEditing)} className={styles.actionBtn}>Edit</button>
                <button onClick={() => onDelete(comment.id)} className={styles.actionBtn}>Delete</button>
              </>
            )}

            <div className={styles.reactionsWrapper}>
              {REACTION_EMOJIS.map(emoji => {
                const count = comment.reactions?.filter(r => r.emoji === emoji).length || 0
                const hasReacted = comment.reactions?.some(r => r.emoji === emoji && r.user_name === 'Admin User')
                return (
                  <button 
                    key={emoji}
                    className={`${styles.reactionBtn} ${hasReacted ? styles.reacted : ''} ${count === 0 ? styles.hidden : ''}`}
                    onClick={() => onReact(comment.id, emoji)}
                  >
                    {emoji} {count > 0 && <span className={styles.reactionCount}>{count}</span>}
                  </button>
                )
              })}
              <div className={styles.emojiPicker}>
                <span className={styles.emojiTrigger}>😀</span>
                <div className={styles.emojiMenu}>
                  {REACTION_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => onReact(comment.id, emoji)}>{emoji}</button>
                  ))}
                </div>
              </div>
            </div>
            
            {comment.read_by && comment.read_by.length > 0 && (
              <span className={styles.readReceipt} title={`Read by: ${comment.read_by.join(', ')}`}>
                ✓✓
              </span>
            )}
          </div>

          {isReplying && (
            <div className={styles.replyBox}>
              <CommentEditor 
                onSubmit={handleReplySubmit} 
                onCancel={() => setIsReplying(false)} 
                submitLabel="Reply" 
              />
            </div>
          )}
        </div>
      </div>

      {replies.length > 0 && (
        <div className={styles.repliesList}>
          {replies.map(reply => (
            <CommentThread
              key={reply.id}
              comment={reply}
              replies={allComments.filter(c => c.parent_id === reply.id)}
              allComments={allComments}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onReact={onReact}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
