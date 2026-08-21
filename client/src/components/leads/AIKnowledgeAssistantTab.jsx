/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import { Button, Badge, Input, Textarea, Select } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { useConfirm } from '../../store/confirmContext';

const styles = {
  wrapper: {
    display: 'flex',
    height: '640px',
    overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.45)',
    backdropFilter: 'blur(20px)',
    fontFamily: 'var(--font-sans)',
    borderRadius: '24px',
    border: '1px solid rgba(255, 255, 255, 0.5)',
    boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.4)',
  },
  vaultPanel: {
    width: '420px',
    borderRight: '1px solid rgba(0, 0, 0, 0.08)',
    background: 'rgba(255, 255, 255, 0.6)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    flexShrink: 0,
  },
  vaultHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    background: 'rgba(255, 255, 255, 0.2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vaultTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontWeight: 800,
    fontSize: '16px',
    color: '#1f2937',
    margin: 0,
  },
  vaultIcon: {
    fontSize: '18px',
  },
  vaultSubtext: {
    fontSize: '12px',
    color: '#6b7280',
    margin: '4px 0 0 0',
    lineHeight: '1.4',
  },
  searchWrapper: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    background: 'rgba(255, 255, 255, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  filterRow: {
    display: 'flex',
    gap: '6px',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  filterPill: {
    fontSize: '11px',
    fontWeight: 700,
    padding: '5px 10px',
    borderRadius: '10px',
    border: '1px solid rgba(0,0,0,0.06)',
    background: '#fff',
    color: '#4b5563',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap',
  },
  filterPillActive: {
    background: 'var(--color-accent)',
    color: '#fff',
    borderColor: 'var(--color-accent)',
    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)',
  },
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '12px',
    fontSize: '13px',
    background: '#fff',
    color: '#1f2937',
    outline: 'none',
    boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  },
  cardList: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    background: 'rgba(0, 0, 0, 0.01)',
  },
  card: {
    background: '#fff',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    borderRadius: '16px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.02)',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  cardActive: {
    borderColor: 'var(--color-accent)',
    boxShadow: '0 8px 24px rgba(139, 92, 246, 0.08), 0 1px 2px rgba(139, 92, 246, 0.05)',
    background: 'rgba(139, 92, 246, 0.01)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  badge: {
    fontSize: '10px',
    fontWeight: 700,
    padding: '3px 9px',
    borderRadius: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  badgeMeeting: {
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #dbeafe',
  },
  badgeObjection: {
    background: '#fef2f2',
    color: '#b91c1c',
    border: '1px solid #fee2e2',
  },
  badgePreference: {
    background: '#f5f3ff',
    color: '#6d28d9',
    border: '1px solid #ede9fe',
  },
  cardDate: {
    fontSize: '11px',
    color: '#9ca3af',
    fontWeight: 550,
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 750,
    color: '#111827',
    margin: '0 0 8px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardSummary: {
    fontSize: '12px',
    color: '#4b5563',
    lineHeight: '1.5',
    margin: '0 0 12px 0',
  },
  bulletList: {
    margin: '0 0 12px 0',
    paddingLeft: '16px',
    fontSize: '12px',
    color: '#374151',
    lineHeight: '1.6',
  },
  bulletItem: {
    marginBottom: '6px',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px dashed rgba(0, 0, 0, 0.05)',
    paddingTop: '10px',
    marginTop: '10px',
  },
  cardMetadata: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  cardBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-accent)',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    transition: 'color 0.2s',
  },
  chatPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'rgba(255, 255, 255, 0.8)',
  },
  chatHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    background: 'rgba(255, 255, 255, 0.4)',
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 800,
    fontSize: '16px',
    color: '#1f2937',
    margin: 0,
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10b981',
    display: 'inline-block',
    boxShadow: '0 0 8px #10b981',
  },
  chatSubtext: {
    fontSize: '12px',
    color: '#6b7280',
    margin: '2px 0 0 0',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    background: 'rgba(0,0,0,0.005)',
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
    background: 'linear-gradient(135deg, var(--color-accent) 0%, #6366f1 100%)',
    color: '#fff',
    borderRadius: '16px 16px 2px 16px',
    padding: '12px 16px',
    fontSize: '13.5px',
    lineHeight: 1.55,
    boxShadow: '0 4px 16px rgba(139, 92, 246, 0.15)',
  },
  bubbleAssistant: {
    maxWidth: '80%',
    background: '#fff',
    border: '1px solid rgba(0, 0, 0, 0.05)',
    color: '#1f2937',
    borderRadius: '16px 16px 16px 2px',
    padding: '14px 18px',
    fontSize: '13.5px',
    lineHeight: 1.55,
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.02)',
  },
  bubbleSystem: {
    width: '100%',
    textAlign: 'center',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: '11px',
    padding: '6px 0',
    letterSpacing: '0.02em',
  },
  roleLabel: {
    fontSize: '9px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '6px',
    opacity: 0.8,
  },
  suggestionArea: {
    padding: '12px 20px',
    background: 'rgba(255,255,255,0.4)',
    borderTop: '1px solid rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  suggestionPill: {
    fontSize: '11.5px',
    fontWeight: 600,
    padding: '7px 14px',
    borderRadius: '9999px',
    border: '1px solid rgba(0,0,0,0.06)',
    background: '#fff',
    color: '#4b5563',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  inputArea: {
    padding: '16px 20px',
    background: 'rgba(255, 255, 255, 0.6)',
    borderTop: '1px solid rgba(0, 0, 0, 0.06)',
    flexShrink: 0,
  },
  form: {
    display: 'flex',
    gap: '10px',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '12px',
    fontSize: '13.5px',
    background: '#fff',
    color: '#1f2937',
    outline: 'none',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
    transition: 'border-color 0.2s ease',
  },
  typingBubble: {
    maxWidth: '80%',
    background: '#fff',
    border: '1px solid rgba(0,0,0,0.05)',
    borderRadius: '16px 16px 16px 2px',
    padding: '12px 18px',
    fontSize: '13px',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
  },
  createFormWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    background: '#fff',
    border: '1px solid rgba(0,0,0,0.06)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
  },
  formLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#6b7280',
    marginBottom: '6px',
    letterSpacing: '0.04em',
  },
};

export default function AIKnowledgeAssistantTab({ leadId, lead }) {
  const { confirm } = useConfirm();
  const [messages, setMessages] = useState([
    {
      role: 'system',
      content: `AI Knowledge Assistant connected. Ask me anything about ${lead?.name || 'this lead'}'s history, interactions, or preferences.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const bottomRef = useRef(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRecord, setNewRecord] = useState({
    type: 'Meeting Summary',
    title: '',
    summary: '',
    host: lead?.assignee_name || 'AI Assistant',
    details: '',
  });

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

  const mapActivityToRecord = (act) => {
    const notesText = act.notes || '';
    const lines = notesText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const title = act.title || 'Meeting Summary';
    const summary = lines[0] || 'Concluded meeting notes and outcomes.';
    const details = lines.slice(1).map(l => l.replace(/^[-•*✓]\s*/, ''));

    const host = act.metadata?.meeting_host || act.user_name || 'Coordinator';

    let formattedDate = 'Recent';
    try {
      const d = new Date(act.scheduled_at || act.created_at);
      formattedDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + 
                      ' at ' + 
                      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      // fallback
    }

    return {
      id: act.id,
      type: 'Meeting Summary',
      title: title,
      date: formattedDate,
      host: host,
      summary: summary,
      details: details.length > 0 ? details : ['Key points and decisions recorded in meeting notes.'],
      status: 'Indexed',
      icon: '📅',
      rawActivity: act
    };
  };

  const fetchRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await api.get(`/leads/${leadId}/activities`, {
        params: { type: 'meeting', limit: 100 }
      });
      const activities = res.data?.data || res.data || [];
      const concludedMeetings = activities.filter(a => 
        a.outcome === 'concluded' || a.outcome === 'completed'
      );
      const fetchedRecords = concludedMeetings.map(mapActivityToRecord);
      
      setRecords(prev => {
        const mocks = prev.filter(r => r.id.startsWith('rec-'));
        const combined = [...fetchedRecords, ...mocks];
        const unique = [];
        const seen = new Set();
        for (const r of combined) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            unique.push(r);
          }
        }
        return unique;
      });
    } catch (err) {
      console.error('Failed to fetch knowledge vault records:', err);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (leadId) {
      fetchRecords();
    }
  }, [leadId]);

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

  const handleDeleteRecord = async (id) => {
    if (id.startsWith('rec-')) {
      if (await confirm('Are you sure you want to clear this mock knowledge record?')) {
        setRecords(prev => prev.map(r => {
          if (r.id === id) {
            return { ...r, summary: 'Data has been cleared.', details: [] };
          }
          return r;
        }));
        toast.success('Record cleared');
      }
    } else {
      if (!await confirm('Are you sure you want to permanently delete this meeting record from the Knowledge Vault?')) return;
      try {
        await api.delete(`/leads/${leadId}/activities/${id}`);
        toast.success('Record deleted from Knowledge Vault');
        fetchRecords();
      } catch (err) {
        console.error(err);
        toast.error('Failed to delete record from Knowledge Vault');
      }
    }
  };

  const handleSaveChanges = async () => {
    setIsEditing(false);
    setLoading(true);
    try {
      for (const rec of records) {
        if (!rec.id.startsWith('rec-')) {
          const lines = [rec.summary, ...rec.details];
          const notesText = lines.join('\n');
          await api.patch(`/leads/${leadId}/activities/${rec.id}`, {
            title: rec.title,
            notes: notesText,
            outcome: 'concluded',
            metadata: {
              ...rec.rawActivity?.metadata,
              meeting_host: rec.host
            }
          });
        }
      }
      toast.success('Knowledge Vault updated successfully');
      fetchRecords();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save some changes to Knowledge Vault.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    if (!newRecord.title || !newRecord.summary) {
      toast.error('Title and Summary are required');
      return;
    }
    setLoading(true);
    try {
      const type = newRecord.type === 'Meeting Summary' ? 'meeting' : 'note';
      const points = newRecord.details.split('\n').map(p => p.trim()).filter(p => p.length > 0);
      const notes = [newRecord.summary, ...points].join('\n');
      
      const payload = {
        type,
        title: newRecord.title,
        notes,
        outcome: type === 'meeting' ? 'concluded' : null,
        metadata: {
          meeting_host: newRecord.host
        }
      };

      await api.post(`/leads/${leadId}/activities`, payload);
      toast.success('Record successfully added to Knowledge Vault');
      setShowCreateForm(false);
      setNewRecord({
        type: 'Meeting Summary',
        title: '',
        summary: '',
        host: lead?.assignee_name || 'AI Assistant',
        details: '',
      });
      fetchRecords();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create Knowledge Vault record');
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'system',
        content: `AI Knowledge Assistant connected. Ask me anything about ${lead?.name || 'this lead'}'s history, interactions, or preferences.`,
      },
    ]);
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

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.summary.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedCategory === 'All') return matchesSearch;
    return r.type === selectedCategory && matchesSearch;
  });

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
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            ✏️ Edit Section
          </Button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="sm" variant="primary" onClick={handleSaveChanges}>
              💾 Save Changes
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); fetchRecords(); }} className="text-red-500 border-red-200 hover:bg-red-50">
              Cancel Edit
            </Button>
          </div>
        )}
      </div>
      <div style={styles.wrapper}>
      {/* LEFT PANEL: Knowledge Vault Column */}
      <div style={styles.vaultPanel}>
        <div style={styles.vaultHeader}>
          <div>
            <h3 style={styles.vaultTitle}>
              <span style={styles.vaultIcon}>🗄️</span>
              AI Knowledge Vault
            </h3>
            <p style={styles.vaultSubtext}>
              Concluded meetings, objections, and preferences are indexed.
            </p>
          </div>
          <Button
            onClick={() => setShowCreateForm(prev => !prev)}
            variant={showCreateForm ? 'outline' : 'primary'}
            size="sm"
          >
            {showCreateForm ? 'View Vault' : '+ Add Record'}
          </Button>
        </div>

        {/* Search bar */}
        <div style={styles.searchWrapper}>
          <Input
            placeholder="Search indexed knowledge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div style={styles.filterRow}>
            {[
              { id: 'All', label: '🗂️ All' },
              { id: 'Meeting Summary', label: '📅 Meetings' },
              { id: 'Objection Log', label: '⚖️ Objections' },
              { id: 'Preference Sheet', label: '🎨 Preferences' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  ...styles.filterPill,
                  ...(selectedCategory === cat.id ? styles.filterPillActive : {}),
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vault list */}
        <div style={styles.cardList}>
          {showCreateForm ? (
            <form onSubmit={handleCreateRecord} style={styles.createFormWrapper}>
              <h4 style={{ fontSize: '13.5px', fontWeight: 800, color: '#111827', marginBottom: '2px' }}>
                ✏️ Add New Knowledge Record
              </h4>
              
              <Select
                label="Record Type"
                value={newRecord.type}
                onChange={(val) => setNewRecord(prev => ({ ...prev, type: val }))}
                options={[
                  { value: 'Meeting Summary', label: 'Meeting Summary' },
                  { value: 'Objection Log', label: 'Objection Log' },
                  { value: 'Preference Sheet', label: 'Preference Sheet' }
                ]}
              />

              <Input
                label="Title"
                type="text"
                required
                placeholder="e.g. Price Negotiation Notes"
                value={newRecord.title}
                onChange={(e) => setNewRecord(prev => ({ ...prev, title: e.target.value }))}
              />

              <Input
                label="Author / Host"
                type="text"
                required
                value={newRecord.host}
                onChange={(e) => setNewRecord(prev => ({ ...prev, host: e.target.value }))}
              />

              <Input
                label="Summary Sentence"
                type="text"
                required
                placeholder="Brief 1-sentence recap..."
                value={newRecord.summary}
                onChange={(e) => setNewRecord(prev => ({ ...prev, summary: e.target.value }))}
              />

              <Textarea
                label="Key Details (One Bullet Per Line)"
                rows={3}
                placeholder="- Budget was challenging due to civil works&#10;- Suggested pre-fabricated cabinetry to save time"
                value={newRecord.details}
                onChange={(e) => setNewRecord(prev => ({ ...prev, details: e.target.value }))}
              />

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '6px' }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                >
                  Save Record
                </Button>
              </div>
            </form>
          ) : loadingRecords ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              🔄 Indexing Knowledge Vault...
            </div>
          ) : filteredRecords.length === 0 ? (
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
                  <Badge variant={
                    record.type === 'Meeting Summary' 
                      ? 'info' 
                      : record.type === 'Objection Log' 
                        ? 'danger' 
                        : 'accent'
                  }>
                    {record.type}
                  </Badge>
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
                      {(record.details || []).map((detail, idx) => (
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
                      {(record.details || []).map((detail, idx) => (
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
          <div>
            <h3 style={styles.chatTitle}>
              <span style={styles.dot} />
              AI Knowledge Assistant
            </h3>
            <p style={styles.chatSubtext}>
              Ask detailed questions regarding timeline, design decisions, budget, or objections.
            </p>
          </div>
          {messages.length > 1 && (
            <Button
              onClick={handleClearChat}
              variant="outline"
              size="sm"
              className="text-red-500 border-red-200 hover:bg-red-55"
              style={{ padding: '4px 10px', height: '28px', fontSize: '11.5px' }}
            >
              🗑️ Clear Chat
            </Button>
          )}
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
              <div style={styles.typingBubble}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span>Analyzing knowledge vault…</span>
              </div>
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
