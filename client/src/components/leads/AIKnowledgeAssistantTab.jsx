import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--color-bg)',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    flexShrink: 0,
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600,
    fontSize: '15px',
    color: 'var(--color-text)',
    margin: '0 0 4px 0',
  },
  pingDot: {
    position: 'relative',
    width: '10px',
    height: '10px',
    flexShrink: 0,
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: 'var(--color-accent)',
    display: 'inline-block',
  },
  headerSubtext: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    margin: 0,
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
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
    fontSize: '14px',
    lineHeight: 1.5,
  },
  bubbleAssistant: {
    maxWidth: '80%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    borderRadius: '12px 12px 12px 2px',
    padding: '10px 14px',
    fontSize: '14px',
    lineHeight: 1.5,
    boxShadow: 'var(--shadow-sm)',
  },
  bubbleSystem: {
    width: '100%',
    textAlign: 'center',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    fontSize: '12px',
    padding: '4px 0',
  },
  roleLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '4px',
    opacity: 0.6,
  },
  typingBubble: {
    maxWidth: '80%',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '12px 12px 12px 2px',
    padding: '10px 14px',
    fontSize: '14px',
    color: 'var(--color-text-secondary)',
    fontStyle: 'italic',
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
    padding: '8px 12px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '14px',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    outline: 'none',
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
  const toast = useToast();
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post(`/leads/${leadId}/knowledge-assistant`, { question: userMessage });
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

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.headerTitle}>
          <span style={styles.dot} />
          AI Knowledge Assistant
        </h3>
        <p style={styles.headerSubtext}>
          Chat with the CRM. Instantly recall context, timelines, and action items for this specific lead.
        </p>
      </div>

      {/* Message list */}
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
                {msg.content}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={styles.rowOther}>
            <div style={styles.typingBubble}>Searching timeline…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <form onSubmit={handleSend} style={styles.form}>
          <input
            type="text"
            style={styles.input}
            placeholder={`Ask about ${lead?.name || 'this lead'}'s history…`}
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
  );
}
