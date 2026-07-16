/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

const styles = {
  wrapper: {
    display: 'flex',
    height: '620px',
    overflow: 'hidden',
    background: 'var(--color-bg)',
    fontFamily: 'var(--font-sans)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
  },
  vaultPanel: {
    width: '420px',
    borderRight: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    flexShrink: 0,
  },
  vaultHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
  },
  vaultTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 700,
    fontSize: '15px',
    color: 'var(--color-text)',
    margin: '0 0 4px 0',
  },
  vaultIcon: {
    fontSize: '16px',
  },
  vaultSubtext: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: '1.4',
  },
  searchWrapper: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface-2)',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '12.5px',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  cardList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: 'var(--color-bg)',
  },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: 'var(--shadow-xs)',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  cardActive: {
    border: '1px solid var(--color-accent)',
    boxShadow: 'var(--shadow-sm)',
    background: 'var(--color-accent-light)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  badge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  badgeMeeting: {
    background: 'rgba(232, 147, 90, 0.1)',
    color: 'var(--color-accent-dark)',
  },
  badgeObjection: {
    background: 'rgba(220, 38, 38, 0.08)',
    color: 'var(--color-danger)',
  },
  badgePreference: {
    background: 'rgba(37, 99, 235, 0.08)',
    color: 'var(--color-info)',
  },
  cardDate: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
  },
  cardTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--color-text)',
    margin: '0 0 6px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  cardSummary: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    lineHeight: '1.45',
    margin: '0 0 10px 0',
  },
  bulletList: {
    margin: '0 0 10px 0',
    paddingLeft: '16px',
    fontSize: '11.5px',
    color: 'var(--color-text)',
    lineHeight: '1.5',
  },
  bulletItem: {
    marginBottom: '4px',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px dashed var(--color-border)',
    paddingTop: '8px',
    marginTop: '8px',
  },
  cardMetadata: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
  },
  cardBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-accent-dark)',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  chatPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--color-surface)',
  },
  chatHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    flexShrink: 0,
  },
  chatTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 700,
    fontSize: '15px',
    color: 'var(--color-text)',
    margin: '0 0 4px 0',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--color-success)',
    display: 'inline-block',
  },
  chatSubtext: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    background: 'var(--color-bg)',
  },
  rowUser: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  rowOther: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  bubbleUser: {
    maxWidth: '80%',
    background: 'var(--color-accent)',
    color: '#fff',
    borderRadius: '12px 12px 2px 12px',
    padding: '10px 14px',
    fontSize: '13.5px',
    lineHeight: 1.5,
    boxShadow: 'var(--shadow-sm)',
  },
  bubbleAssistant: {
    maxWidth: '80%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    borderRadius: '12px 12px 12px 2px',
    padding: '12px 16px',
    fontSize: '13.5px',
    lineHeight: 1.5,
    boxShadow: 'var(--shadow-sm)',
  },
  bubbleSystem: {
    width: '100%',
    textAlign: 'center',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    fontSize: '11px',
    padding: '4px 0',
  },
  roleLabel: {
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '6px',
    opacity: 0.8,
  },
  suggestionArea: {
    padding: '10px 16px',
    background: 'var(--color-surface)',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  suggestionPill: {
    fontSize: '11.5px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    outline: 'none',
  },
  inputArea: {
    padding: '12px 16px',
    background: 'var(--color-surface)',
    borderTop: '1px solid var(--color-border)',
    flexShrink: 0,
  },
  form: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '13.5px',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },
  typingBubble: {
    maxWidth: '80%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '12px 12px 12px 2px',
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
  },
};

export default function AIKnowledgeAssistantTab({ leadId, lead }) {
  const [messages, setMessages] = useState([
    {
      role: 'system',
      content: `AI Knowledge Assistant connected. Ask me anything about ${lead?.name || 'this lead'}'s history, interactions, or preferences.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const toast = useToast();
  const bottomRef = useRef(null);

  // Initial Mock Records in AI Knowledge Vault
  const [records, setRecords] = useState([
    {
      id: 'rec-1',
      type: 'Meeting Summary',
      title: 'Initial Consultation & Layout Review',
      date: 'June 24, 2026 at 3:30 PM',
      host: 'Sarah Jenkins (Senior Architect)',
      summary: 'Concluded project kickoff meeting with client. Main topics included open-concept floor plan integration and structural load-bearing checks.',
      details: [
        'Budget cap: Confirmed at $85,000 for all phases.',
        'Design style: Modern minimalist with warm wood accents and neutral tones.',
        'Key Decisions: Selected European Oak veneer cabinet finishes and white Quartz countertops.',
        'Layout: Confirmed central kitchen island to replace traditional dining area.'
      ],
      objections: 'Client concerned about civil work timeline. Suggested pre-fabricated partition walls to save 2 weeks.',
      status: 'Indexed',
      icon: '📅'
    },
    {
      id: 'rec-2',
      type: 'Objection Log',
      title: 'Timeline & Civil Work Objections',
      date: 'June 23, 2026 at 11:00 AM',
      host: 'Sales Copilot',
      summary: 'Objection raised regarding the 12-week estimated construction timeline. Client requested an expedited schedule due to upcoming travel.',
      details: [
        'Proposed parallel construction sequencing (electrical & plumbing).',
        'Used pre-fabricated cabinetry modules instead of on-site custom building.',
        'Resulting in 2 weeks of timeline reduction, target completed in 10 weeks.'
      ],
      status: 'Resolved',
      icon: '⚖️'
    },
    {
      id: 'rec-3',
      type: 'Preference Sheet',
      title: 'Design Aesthetics & Questionnaire',
      date: 'June 22, 2026 at 9:00 AM',
      host: 'AI Assistant',
      summary: 'Automated extraction of preferences from the uploaded client design brief and board.',
      details: [
        'Colors: Olive green accent walls, warm cream base colors.',
        'Materials: Terrazzo tiling, textured concrete walls, matte black metal hardware.',
        'Must-haves: Built-in bookshelf in study, pet-friendly scratch-resistant fabrics.'
      ],
      status: 'Indexed',
      icon: '🎨'
    }
  ]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleRecordChange = (recordId, field, value, idx = null) => {
    setRecords(prev => prev.map(r => {
      if (r.id !== recordId) return r;
      if (field === 'details') {
        const newDetails = [...r.details];
        newDetails[idx] = value;
        return { ...r, details: newDetails };
      }
      return { ...r, [field]: value };
    }));
  };

  const handleDeleteRecord = (id) => {
    setRecords(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, summary: 'Data has been cleared.', details: [] };
      }
      return r;
    }));
  };

  const sendQuery = async (queryText) => {
    if (loading) return;
    setMessages(prev => [...prev, { role: 'user', content: queryText }]);
    setLoading(true);

    try {
      const res = await api.post(`/leads/${leadId}/knowledge-assistant`, { question: queryText });
      if (res.data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.data.data.answer }]);
      }
    } catch (err) {
      toast.error('Failed to get answer from AI Assistant.');
      setMessages(prev => [...prev, { role: 'system', content: 'Connection interrupted. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    await sendQuery(userMessage);
  };

  const handleAskAboutRecord = (record) => {
    setSelectedRecordId(record.id);
    const question = `What are the details and key decisions from the recent meeting "${record.title}"?`;
    sendQuery(question);
  };

  const filteredRecords = records.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'Meeting Summary':
        return styles.badgeMeeting;
      case 'Objection Log':
        return styles.badgeObjection;
      default:
        return styles.badgePreference;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {!isEditing ? (
          <Button size='sm' variant='outline' onClick={() => setIsEditing(true)} style={{ background: '#fff', border: '1px solid #d1d5db', color: '#374151', padding: '4px 10px', fontSize: '12px', height: '28px' }}>
            ✏️ Edit Section
          </Button>
        ) : (
          <Button size='sm' variant='ghost' onClick={() => setIsEditing(false)} style={{ color: '#ef4444', padding: '4px 10px', fontSize: '12px', height: '28px' }}>
            Cancel Edit
          </Button>
        )}
      </div>
      <div style={styles.wrapper}>
      {/* LEFT PANEL: Knowledge Vault Column */}
      <div style={styles.vaultPanel}>
        <div style={styles.vaultHeader}>
          <h3 style={styles.vaultTitle}>
            <span style={styles.vaultIcon}>🗄️</span>
            AI Knowledge Vault
          </h3>
          <p style={styles.vaultSubtext}>
            Concluded meetings, objections, and client details are indexed here.
          </p>
        </div>

        {/* Search bar */}
        <div style={styles.searchWrapper}>
          <input
            type="text"
            placeholder="Search indexed knowledge..."
            style={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Vault list */}
        <div style={styles.cardList}>
          {filteredRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              No indexed records match your search.
            </div>
          ) : (
            filteredRecords.map(record => (
              <div 
                key={record.id} 
                style={{
                  ...styles.card,
                  ...(selectedRecordId === record.id ? styles.cardActive : {})
                }}
                onClick={() => setSelectedRecordId(record.id)}
              >
                <div style={styles.cardHeader}>
                  <span style={{ ...styles.badge, ...getBadgeStyle(record.type) }}>
                    {record.type}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={styles.cardDate}>{record.date}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRecord(record.id);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontSize: '13px', opacity: 0.6, display: 'flex', alignItems: 'center' }}
                      data-tooltip="Delete Record"
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>
                </div>
                
                {isEditing ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span>{record.icon}</span>
                      <input 
                        value={record.title} 
                        onChange={(e) => handleRecordChange(record.id, 'title', e.target.value)} 
                        style={{ ...styles.searchInput, padding: '4px 8px', margin: 0, fontWeight: 600, flex: 1 }} 
                      />
                    </div>
                    <textarea 
                      value={record.summary}
                      onChange={(e) => handleRecordChange(record.id, 'summary', e.target.value)}
                      style={{ ...styles.searchInput, padding: '4px 8px', minHeight: '60px', marginBottom: '10px', resize: 'vertical' }}
                    />
                    <ul style={styles.bulletList}>
                      {record.details.map((detail, idx) => (
                        <li key={idx} style={{...styles.bulletItem, display: 'flex', gap: '4px', alignItems: 'flex-start'}}>
                          <span style={{ marginTop: '2px' }}>•</span>
                          <input 
                            value={detail}
                            onChange={(e) => handleRecordChange(record.id, 'details', e.target.value, idx)}
                            style={{ ...styles.searchInput, padding: '2px 6px', fontSize: '11px', flex: 1 }}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <h4 style={styles.cardTitle}>
                      <span>{record.icon}</span>
                      {record.title}
                    </h4>
                    
                    <p style={styles.cardSummary}>{record.summary}</p>
                    
                    <ul style={styles.bulletList}>
                      {record.details.map((detail, idx) => (
                        <li key={idx} style={styles.bulletItem}>• {detail}</li>
                      ))}
                    </ul>
                  </>
                )}

                <div style={styles.cardFooter}>
                  <span style={styles.cardMetadata}>By: {record.host}</span>
                  <button 
                    style={styles.cardBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAskAboutRecord(record);
                    }}
                  >
                    <span>💬</span> Ask AI About This
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL: AI Q&A Assistant Chat */}
      <div style={styles.chatPanel}>
        <div style={styles.chatHeader}>
          <h3 style={styles.chatTitle}>
            <span style={styles.dot} />
            AI Knowledge Assistant
          </h3>
          <p style={styles.chatSubtext}>
            Ask detailed questions regarding timeline, design decisions, budget, or objections.
          </p>
        </div>

        {/* Chat message list */}
        <div style={styles.messageList}>
          {messages.map((msg, idx) => {
            if (msg.role === 'system') {
              return (
                <div key={idx} style={styles.rowOther}>
                  <div style={styles.bubbleSystem}>{msg.content}</div>
                </div>
              );
            }
            if (msg.role === 'user') {
              return (
                <div key={idx} style={styles.rowUser}>
                  <div style={styles.bubbleUser}>
                    <div style={{ ...styles.roleLabel, color: 'rgba(255,255,255,0.7)' }}>You</div>
                    {msg.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={idx} style={styles.rowOther}>
                <div style={styles.bubbleAssistant}>
                  <div style={{ ...styles.roleLabel, color: 'var(--color-accent)' }}>AI Assistant</div>
                  <div style={{ whiteSpace: 'pre-line' }}>{msg.content}</div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={styles.rowOther}>
              <div style={styles.typingBubble}>Analyzing knowledge vault…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div style={styles.suggestionArea}>
          <button 
            style={styles.suggestionPill} 
            onClick={() => sendQuery("Summarize the recent meeting schedule and key decisions.")}
            disabled={loading}
          >
            📋 Summarize Recent Meeting
          </button>
          <button 
            style={styles.suggestionPill} 
            onClick={() => sendQuery("What are the client preferences, budget, and design style?")}
            disabled={loading}
          >
            🎨 Client Budget &amp; Style
          </button>
          <button 
            style={styles.suggestionPill} 
            onClick={() => sendQuery("How did we resolve the timeline objection?")}
            disabled={loading}
          >
            ⏱️ Timeline Objection Resolution
          </button>
        </div>

        {/* Message Input form */}
        <div style={styles.inputArea}>
          <form onSubmit={handleSend} style={styles.form}>
            <input
              type="text"
              style={styles.input}
              placeholder={`Ask about ${lead?.name || 'this lead'}'s meeting summary or preferences…`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <Button type="submit" variant="primary" disabled={loading || !input.trim()}>
              Send
            </Button>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
