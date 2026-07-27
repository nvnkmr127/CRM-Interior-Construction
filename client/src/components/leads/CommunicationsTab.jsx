/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from 'react';
import { getCommunications, createCommunication, draftCommunication, syncCommunications } from '../../api/leads';
import { Button, Input, ContentLoader, EmptyState } from '../ui';
import { useToast } from '../../store/toastContext';

export default function CommunicationsTab({ leadId, lead }) {
  const toast = useToast();
  const [comms, setComms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [duration, setDuration] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (leadId) fetchComms();
  }, [leadId]);

  const fetchComms = async () => {
    setLoading(true);
    try {
      const res = await getCommunications(leadId);
      if (res.success) {
        // Map backend schema (type, notes, metadata) to frontend schema
        const mapped = res.data.map(c => ({
          id: c.id,
          channel: c.type,
          body: c.notes,
          direction: c.metadata?.direction || 'outbound',
          status: c.metadata?.status || 'sent',
          reaction: c.metadata?.reaction,
          duration: c.metadata?.duration,
          sent_at: c.created_at
        }));
        setComms(mapped);
      }
    } catch (e) {
      toast.error('Failed to load communications');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncChat = async () => {
    setIsSyncing(true);
    try {
      const res = await syncCommunications(leadId);
      if (res.success) {
        toast.success('WhatsApp chat synchronized');
        const mapped = res.data.map(c => ({
          id: c.id,
          channel: c.type,
          body: c.notes,
          direction: c.metadata?.direction || 'outbound',
          status: c.metadata?.status || 'sent',
          reaction: c.metadata?.reaction,
          duration: c.metadata?.duration,
          sent_at: c.created_at
        }));
        setComms(mapped);
      }
    } catch (e) {
      toast.error('Failed to sync WhatsApp chat');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      const payload = {
        type: channel,
        notes: message,
        metadata: {
          direction: 'outbound',
          status: 'sent',
          ...(channel === 'call' && duration ? { duration: parseInt(duration, 10) } : {})
        }
      };
      
      const res = await createCommunication(leadId, payload);
      if (res.success) {
        toast.success(`Logged via ${channel}`);
        setMessage('');
        if (channel === 'call') setDuration('');
        fetchComms();
      }
    } catch (e) {
      toast.error('Failed to log communication');
    }
  };

  const handleDraft = async () => {
    setIsDrafting(true);
    try {
      const res = await draftCommunication(leadId, { channel, instructions: message });
      if (res.success) {
        setMessage(res.data.draft);
        toast.success('Draft generated');
      }
    } catch (e) {
      toast.error('Failed to generate draft');
    } finally {
      setIsDrafting(false);
    }
  };

  if (loading) return <ContentLoader type="list" rows={3} />;

  const isEmailMissing = channel === 'email' && !lead?.email;
  const isSmsOrWhatsappOrCallMissing = (channel === 'sms' || channel === 'whatsapp' || channel === 'call') && !lead?.phone;
  const isSendDisabled = !message.trim() || isEmailMissing || isSmsOrWhatsappOrCallMissing || (channel === 'call' && !duration);
import React, { useState, useEffect, useMemo } from 'react';
import { getCommunications, createCommunication, draftCommunication, syncCommunications } from '../../api/leads';
import { Button, Input, ContentLoader, EmptyState } from '../ui';
import { useToast } from '../../store/toastContext';

export default function CommunicationsTab({ leadId, lead }) {
  const toast = useToast();
  const [comms, setComms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [duration, setDuration] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (leadId) fetchComms();
  }, [leadId]);

  const fetchComms = async () => {
    setLoading(true);
    try {
      const res = await getCommunications(leadId);
      if (res.success) {
        // Map backend schema (type, notes, metadata) to frontend schema
        const mapped = res.data.map(c => ({
          id: c.id,
          channel: c.type,
          body: c.notes,
          direction: c.metadata?.direction || 'outbound',
          status: c.metadata?.status || 'sent',
          reaction: c.metadata?.reaction,
          duration: c.metadata?.duration,
          sent_at: c.created_at
        }));
        setComms(mapped);
      }
    } catch (e) {
      toast.error('Failed to load communications');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncChat = async () => {
    setIsSyncing(true);
    try {
      const res = await syncCommunications(leadId);
      if (res.success) {
        toast.success('WhatsApp chat synchronized');
        const mapped = res.data.map(c => ({
          id: c.id,
          channel: c.type,
          body: c.notes,
          direction: c.metadata?.direction || 'outbound',
          status: c.metadata?.status || 'sent',
          reaction: c.metadata?.reaction,
          duration: c.metadata?.duration,
          sent_at: c.created_at
        }));
        setComms(mapped);
      }
    } catch (e) {
      toast.error('Failed to sync WhatsApp chat');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      const payload = {
        type: channel,
        notes: message,
        metadata: {
          direction: 'outbound',
          status: 'sent',
          ...(channel === 'call' && duration ? { duration: parseInt(duration, 10) } : {})
        }
      };
      
      const res = await createCommunication(leadId, payload);
      if (res.success) {
        toast.success(`Logged via ${channel}`);
        setMessage('');
        if (channel === 'call') setDuration('');
        fetchComms();
      }
    } catch (e) {
      toast.error('Failed to log communication');
    }
  };

  const handleDraft = async () => {
    setIsDrafting(true);
    try {
      const res = await draftCommunication(leadId, { channel, instructions: message });
      if (res.success) {
        setMessage(res.data.draft);
        toast.success('Draft generated');
      }
    } catch (e) {
      toast.error('Failed to generate draft');
    } finally {
      setIsDrafting(false);
    }
  };

  if (loading) return <ContentLoader type="list" rows={3} />;

  const isEmailMissing = channel === 'email' && !lead?.email;
  const isSmsOrWhatsappOrCallMissing = (channel === 'sms' || channel === 'whatsapp' || channel === 'call') && !lead?.phone;
  const isSendDisabled = !message.trim() || isEmailMissing || isSmsOrWhatsappOrCallMissing || (channel === 'call' && !duration);

  const filteredComms = filterChannel === 'all' ? comms : comms.filter(c => c.channel === filterChannel);

  return (
    <div className="flex flex-col h-full">
      {/* Thread Filtering Tabs */}
      <div className="flex justify-between items-center mb-4 border-b pb-4" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
        <div className="flex space-x-2 overflow-x-auto custom-scrollbar">
          {['all', 'whatsapp', 'email', 'sms', 'call'].map(f => (
            <button
              key={f}
              onClick={() => setFilterChannel(f)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-all"
              style={
                filterChannel === f 
                  ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 10px rgba(170, 59, 255, 0.3)' } 
                  : { background: 'rgba(255, 255, 255, 0.5)', color: 'var(--color-text-secondary)', border: '1px solid rgba(255,255,255,0.4)' }
              }
            >
              {f}
            </button>
          ))}
        </div>
        {lead?.phone && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncChat} 
            disabled={isSyncing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.6)', border: '1px solid rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(8px)', color: 'var(--color-text)' }}
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Sync WhatsApp
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {filteredComms.length === 0 ? (
          <EmptyState title="No Communications" description="Send a message or log a call to start the conversation." />
        ) : (
          filteredComms.map(c => (
            <div key={c.id} className={`p-4 rounded-xl max-w-[80%] relative shadow-sm transition-transform hover:-translate-y-0.5 ${c.direction === 'outbound' ? 'ml-auto' : ''}`} style={c.direction === 'outbound' ? { background: 'var(--accent-bg)', border: '1px solid rgba(170, 59, 255, 0.1)' } : { background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
              <div className="text-xs text-gray-500 mb-2 flex justify-between gap-4">
                <span className="font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                  {c.channel}
                  {c.channel === 'call' && c.duration && (
                    <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'var(--accent)', color: '#fff' }}>{c.duration} min</span>
                  )}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>{new Date(c.sent_at).toLocaleString()}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap mb-1" style={{ color: 'var(--color-text)' }}>{c.body}</p>
              
              <div className="flex justify-between items-center mt-2">
                <div>
                  {c.reaction && (
                    <span className="absolute -bottom-2 -left-1 shadow-md border border-gray-100 rounded-full px-2 py-0.5 text-xs select-none transition-all" style={{ background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(5px)' }}>
                      {c.reaction}
                    </span>
                  )}
                </div>
                {c.direction === 'outbound' && (
                  <div className="text-[10px] flex items-center gap-1 font-bold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>
                    {c.channel === 'whatsapp' && (
                      <span className="text-xs">
                        {c.status === 'read' || c.status === 'seen' || c.status === 'reacted' || c.status === 'replied' ? '✓✓ 🔵' : c.status === 'delivered' ? '✓✓' : c.status === 'sent' ? '✓' : ''}
                      </span>
                    )}
                    {c.status}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 rounded-xl mt-auto" style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.4)', boxShadow: '0 -10px 30px -10px rgba(0, 0, 0, 0.05)' }}>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <select 
            value={channel} 
            onChange={e => setChannel(e.target.value)}
            className="text-sm rounded-lg p-2 font-medium focus:ring-2 focus:outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.1)', color: 'var(--color-text)' }}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="call">Log Call</option>
          </select>
          
          {channel === 'call' && (
            <input 
              type="number"
              min="1"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="Duration (min)"
              className="w-32 text-sm rounded-lg p-2 focus:ring-2 focus:outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.1)', color: 'var(--color-text)' }}
            />
          )}

          {channel !== 'call' && (
            <Button variant="outline" size="sm" onClick={handleDraft} disabled={isDrafting} style={{ background: 'linear-gradient(135deg, rgba(170, 59, 255, 0.1), rgba(0, 0, 255, 0.1))', border: '1px solid rgba(170, 59, 255, 0.2)', color: 'var(--color-accent)' }}>
              {isDrafting ? 'Drafting...' : '✨ Draft with AI'}
            </Button>
          )}
        </div>
        
        {isEmailMissing && <div className="text-xs text-red-500 font-medium mb-2 bg-red-50 p-1.5 rounded inline-block">Lead must have an email address to send emails.</div>}
        {isSmsOrWhatsappOrCallMissing && <div className="text-xs text-red-500 font-medium mb-2 bg-red-50 p-1.5 rounded inline-block">Lead must have a phone number for {channel}.</div>}
        
        <div className="flex gap-3">
          <input 
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={channel === 'call' ? "Log call notes..." : `Type a ${channel} message or AI instruction...`}
            className="flex-1 text-sm rounded-xl p-3 focus:ring-2 focus:outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.1)', color: 'var(--color-text)' }}
            onKeyDown={e => e.key === 'Enter' && !isSendDisabled && handleSend()}
            disabled={isEmailMissing || isSmsOrWhatsappOrCallMissing}
          />
          <Button onClick={handleSend} disabled={isSendDisabled} style={{ background: 'var(--accent)', color: '#fff', padding: '0 24px', borderRadius: '12px', fontWeight: 'bold' }}>{channel === 'call' ? 'Log' : 'Send'}</Button>
        </div>
      </div>
    </div>
  );
}
