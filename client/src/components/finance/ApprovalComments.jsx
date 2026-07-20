import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../store/authContext';
import styles from './ApprovalComments.module.css';

const EMOJIS = ['👍', '👎', '🎉', '👀', '😂'];

export default function ApprovalComments({ approvalId, currentUserRole, onUnreadChange }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  
  const [attachments, setAttachments] = useState([]);
  
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionsList, setMentionsList] = useState([]);

  const listRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    fetchComments();
    fetchUsers();
    markAsRead();
  }, [approvalId]);

  const fetchComments = async () => {
    try {
      const res = await api.get(`/api/financial-approvals/${approvalId}/comments`);
      setComments(res.data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users?limit=100');
      setUsers(res.data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const markAsRead = async () => {
    try {
      await api.post(`/api/financial-approvals/${approvalId}/comments/read`);
      if (onUnreadChange) onUnreadChange(0);
    } catch (e) {}
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    // Extract mentions manually based on current list (simplified)
    const mentions = mentionsList.map(m => m.id);

    try {
      await api.post(`/api/financial-approvals/${approvalId}/comments`, {
        content,
        is_internal: isInternal,
        parent_id: replyTo,
        mentions,
        attachments
      });
      setContent('');
      setReplyTo(null);
      setMentionsList([]);
      setAttachments([]);
      fetchComments();
      
      setTimeout(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      }, 100);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete comment?')) return;
    try {
      await api.delete(`/api/financial-approvals/${approvalId}/comments/${id}`);
      fetchComments();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditSubmit = async (id) => {
    try {
      await api.put(`/api/financial-approvals/${approvalId}/comments/${id}`, { content: editContent });
      setEditingId(null);
      fetchComments();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReaction = async (id, emoji) => {
    try {
      await api.post(`/api/financial-approvals/${approvalId}/comments/${id}/reactions`, { emoji });
      fetchComments();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTextareaChange = (e) => {
    const val = e.target.value;
    setContent(val);

    // Basic mention parsing
    const lastWord = val.split(' ').pop();
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const search = lastWord.slice(1).toLowerCase();
      setMentionSearch(search);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      alert("File too large. Max 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachments([...attachments, {
        name: file.name,
        type: file.type,
        data: event.target.result
      }]);
    };
    reader.readAsDataURL(file);
  };

  const selectMention = (u) => {
    const words = content.split(' ');
    words.pop();
    const newContent = words.join(' ') + ` @${u.first_name}${u.last_name} `;
    setContent(newContent);
    setShowMentions(false);
    if (!mentionsList.find(m => m.id === u.id)) {
      setMentionsList([...mentionsList, u]);
    }
    textareaRef.current?.focus();
  };

  // Build tree
  const buildTree = (parentId = null) => {
    return comments
      .filter(c => c.parent_id === parentId)
      .map(c => ({ ...c, children: buildTree(c.id) }));
  };
  const tree = buildTree(null);

  const getInitials = (f, l) => `${(f||'')[0]||'?'}${(l||'')[0]||''}`.toUpperCase();

  const renderComment = (c, level = 0) => {
    let parsedReactions = {};
    if (typeof c.reactions === 'string') {
      try { parsedReactions = JSON.parse(c.reactions); } catch(e){}
    } else if (c.reactions) {
      parsedReactions = c.reactions;
    }

    const isOwner = c.user_id === user.id || user.userId === c.user_id;

    return (
      <div key={c.id} className={styles.commentThread}>
        <div className={styles.commentNode}>
          <div className={styles.avatar}>{getInitials(c.first_name, c.last_name)}</div>
          <div className={`${styles.commentBody} ${c.is_internal ? styles.internalNote : ''}`}>
            {c.is_internal && <span className={styles.internalBadge}>Internal</span>}
            <div className={styles.header}>
              <span className={styles.author}>{c.first_name} {c.last_name}</span>
              <span className={styles.timestamp}>{new Date(c.created_at).toLocaleString()} {c.is_edited && '(edited)'}</span>
            </div>
            
            {editingId === c.id ? (
              <div style={{ marginTop: '8px' }}>
                <textarea 
                  className={styles.textarea} 
                  value={editContent} 
                  onChange={(e) => setEditContent(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button onClick={() => handleEditSubmit(c.id)} className={styles.submitBtn}>Save</button>
                  <button onClick={() => setEditingId(null)} className={styles.actionButton}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.content}>{c.content}</div>
                
                {c.attachments && (() => {
                   let atts = c.attachments;
                   if (typeof atts === 'string') try { atts = JSON.parse(atts); } catch(e){ atts = []; }
                   if (atts.length === 0) return null;
                   return (
                     <div className={styles.attachmentsList}>
                       {atts.map((att, i) => (
                         <a key={i} href={att.data} download={att.name} className={styles.attachmentBadge}>
                           📎 {att.name}
                         </a>
                       ))}
                     </div>
                   );
                })()}
                
                <div className={styles.actions}>
                  <button className={styles.actionButton} onClick={() => setReplyTo(c.id)}>Reply</button>
                  {isOwner && (
                    <>
                      <button className={styles.actionButton} onClick={() => { setEditingId(c.id); setEditContent(c.content); }}>Edit</button>
                      <button className={styles.actionButton} onClick={() => handleDelete(c.id)}>Delete</button>
                    </>
                  )}
                </div>
              </>
            )}

            <div className={styles.reactions}>
              {EMOJIS.map(emoji => {
                const reacts = parsedReactions[emoji] || [];
                const hasReacted = reacts.includes(user.id || user.userId);
                return (
                  <button 
                    key={emoji} 
                    className={`${styles.reactionBtn} ${hasReacted ? styles.active : ''}`}
                    onClick={() => handleReaction(c.id, emoji)}
                  >
                    {emoji} {reacts.length > 0 && reacts.length}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        {c.children && c.children.length > 0 && (
          <div className={styles.replies}>
            {c.children.map(child => renderComment(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.commentsList} ref={listRef}>
        {tree.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No comments yet.</div>
        ) : (
          tree.map(c => renderComment(c))
        )}
      </div>
      
      <div className={styles.inputContainer}>
        {replyTo && (
          <div style={{ fontSize: '12px', marginBottom: '8px', color: 'var(--primary-color)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Replying to comment...</span>
            <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'red' }}>Cancel</button>
          </div>
        )}
        
        <div className={styles.textareaWrapper}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder="Type a comment... Use @ to mention someone"
            value={content}
            onChange={handleTextareaChange}
          />
          {showMentions && (
            <div className={styles.mentionDropdown}>
              {users.filter(u => `${u.first_name} ${u.last_name}`.toLowerCase().includes(mentionSearch)).map(u => (
                <div key={u.id} className={styles.mentionItem} onClick={() => selectMention(u)}>
                  {u.first_name} {u.last_name} ({u.role})
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className={styles.inputControls}>
          <div className={styles.leftControls}>
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
              Internal Note
            </label>
            <label className={styles.actionButton} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              📎 Attach
              <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
            </label>
          </div>
          <button className={styles.submitBtn} disabled={!content.trim() && attachments.length === 0} onClick={handleSubmit}>Send</button>
        </div>
        
        {attachments.length > 0 && (
          <div className={styles.attachmentsList} style={{ marginTop: '12px' }}>
            {attachments.map((att, idx) => (
              <span key={idx} className={styles.attachmentBadge}>
                {att.name}
                <button 
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                  style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', marginLeft: '4px' }}
                >✕</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
