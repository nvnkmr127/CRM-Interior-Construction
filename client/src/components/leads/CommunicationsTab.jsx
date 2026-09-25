/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { getCommunications, createCommunication, draftCommunication, syncCommunications } from '../../api/leads';
import { Button, ContentLoader, EmptyState } from '../ui';
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
  const feedEndRef = useRef(null);

  const parseMetadata = (metadata) => {
    if (!metadata) return {};
    if (typeof metadata === 'object') return metadata;
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  };

  const mapActivity = (c) => {
    const meta = parseMetadata(c.metadata);
    return {
      id: c.id,
      channel: c.type,
      body: c.notes,
      direction: meta.direction || 'outbound',
      status: meta.status || 'sent',
      reaction: meta.reaction || null,
      duration: meta.duration || null,
      sent_at: c.created_at
    };
  };

  useEffect(() => {
    if (leadId) fetchComms();
  }, [leadId]);

  useEffect(() => {
    if (!loading && comms.length > 0) {
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comms, filterChannel, loading]);

  const fetchComms = async () => {
    setLoading(true);
    try {
      const res = await getCommunications(leadId);
      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map(mapActivity);
        mapped.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
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
        const dataList = Array.isArray(res.data) ? res.data : (res.data?.messages || []);
        const mapped = dataList.map(mapActivity);
        mapped.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
        setComms(mapped);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || 'Failed to sync WhatsApp chat');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      const payload = {
        type: channel,
        notes: message.trim(),
        metadata: {
          direction: 'outbound',
          status: 'sent',
          ...(channel === 'call' && duration ? { duration: parseInt(duration, 10) } : {})
        }
      };
      
      const res = await createCommunication(leadId, payload);
      if (res.success) {
        if (channel === 'call') {
          toast.success('Call logged successfully');
        } else {
          toast.success(`Message sent via ${channel === 'whatsapp' ? 'WhatsApp' : channel.toUpperCase()}`);
        }
        setMessage('');
        if (channel === 'call') setDuration('');
        fetchComms();
      }
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || 'Failed to log communication');
    }
  };

  const handleDraft = async () => {
    setIsDrafting(true);
    try {
      const res = await draftCommunication(leadId, { channel, instructions: message });
      if (res.success && res.data?.draft) {
        setMessage(res.data.draft);
        toast.success('Draft generated');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error?.message || 'Failed to generate draft');
    } finally {
      setIsDrafting(false);
    }
  };

  if (loading) return <ContentLoader type="list" rows={3} />;

  const leadPhone = lead?.phone || lead?.custom_fields?.phone;
  const leadEmail = lead?.email || lead?.custom_fields?.email;

  const isEmailMissing = channel === 'email' && !leadEmail;
  const isSmsOrWhatsappOrCallMissing = (channel === 'sms' || channel === 'whatsapp' || channel === 'call') && !leadPhone;
  const isSendDisabled = !message.trim() || isEmailMissing || isSmsOrWhatsappOrCallMissing || (channel === 'call' && !duration);

  const filteredComms = filterChannel === 'all' ? comms : comms.filter(c => c.channel === filterChannel);

  return (
    <div className="flex flex-col h-[620px] max-h-[75vh] w-full">
      {/* Thread Filtering Tabs */}
      <div className="flex justify-between items-center mb-4 border-b pb-4" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex space-x-2 overflow-x-auto custom-scrollbar">
          {['all', 'whatsapp', 'email', 'sms', 'call'].map(f => (
            <button
              key={f}
              onClick={() => setFilterChannel(f)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer"
              style={
                filterChannel === f 
                  ? { background: 'var(--color-accent)', color: 'var(--color-text-inverse, #ffffff)', boxShadow: 'var(--shadow-sm)' } 
                  : { background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }
              }
            >
              {f}
            </button>
          ))}
        </div>
        {leadPhone && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncChat} 
            disabled={isSyncing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
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

      {/* Communications Thread */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
        {filteredComms.length === 0 ? (
          <EmptyState 
            title="No Communications" 
            description={filterChannel === 'all' 
              ? "Send a message or log a call to start the conversation." 
              : `No ${filterChannel} communications logged yet.`} 
          />
        ) : (
          filteredComms.map(c => {
            const isOutbound = c.direction === 'outbound';
            return (
              <div 
                key={c.id} 
                className={`p-4 rounded-xl max-w-[82%] relative shadow-sm transition-transform hover:-translate-y-0.5 ${isOutbound ? 'ml-auto' : ''}`} 
                style={
                  isOutbound 
                    ? { background: 'var(--color-accent-light, #FDF0E8)', border: '1px solid var(--color-border)' } 
                    : { background: 'var(--color-surface)', border: '1px solid var(--color-border)' }
                }
              >
                <div className="text-xs mb-2 flex justify-between gap-4">
                  <span className="font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {c.channel}
                    {c.channel === 'call' && c.duration && (
                      <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse, #ffffff)' }}>
                        {c.duration} min
                      </span>
                    )}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)' }}>{new Date(c.sent_at).toLocaleString()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap mb-1 leading-relaxed" style={{ color: 'var(--color-text)' }}>{c.body}</p>
                
                <div className="flex justify-between items-center mt-2 min-h-[16px]">
                  <div>
                    {c.reaction && (
                      <span className="absolute -bottom-2 -left-1 shadow-md rounded-full px-2 py-0.5 text-xs select-none" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                        {c.reaction}
                      </span>
                    )}
                  </div>
                  {isOutbound && (
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
            );
          })
        )}
        <div ref={feedEndRef} />
      </div>

      {/* Input Composer Section */}
      <div className="p-4 rounded-xl mt-auto" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <select 
            value={channel} 
            onChange={e => setChannel(e.target.value)}
            className="text-sm rounded-lg p-2 font-medium focus:ring-2 focus:outline-none transition-all cursor-pointer"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
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
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            />
          )}

          {channel !== 'call' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDraft} 
              disabled={isDrafting} 
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }}
            >
              {isDrafting ? 'Drafting...' : '✨ Draft with AI'}
            </Button>
          )}
        </div>
        
        {isEmailMissing && (
          <div className="text-xs font-medium mb-2 p-1.5 rounded inline-block" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            Lead must have an email address to send emails.
          </div>
        )}
        {isSmsOrWhatsappOrCallMissing && (
          <div className="text-xs font-medium mb-2 p-1.5 rounded inline-block" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            Lead must have a phone number for {channel}.
          </div>
        )}
        
        <div className="flex gap-3">
          <input 
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={channel === 'call' ? "Log call notes..." : `Type a ${channel} message or AI instruction...`}
            className="flex-1 text-sm rounded-xl p-3 focus:ring-2 focus:outline-none transition-all"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            onKeyDown={e => e.key === 'Enter' && !isSendDisabled && handleSend()}
            disabled={isEmailMissing || isSmsOrWhatsappOrCallMissing}
          />
          <Button 
            onClick={handleSend} 
            disabled={isSendDisabled} 
            style={{ background: 'var(--color-accent)', color: 'var(--color-text-inverse, #fff)', padding: '0 24px', borderRadius: '12px', fontWeight: 'bold' }}
          >
            {channel === 'call' ? 'Log' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

