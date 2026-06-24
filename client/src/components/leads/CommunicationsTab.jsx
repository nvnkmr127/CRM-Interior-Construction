import React, { useState, useEffect, useMemo } from 'react';
import { getCommunications, createCommunication, draftCommunication } from '../../api/leads';
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
      <div className="flex space-x-2 mb-4 border-b pb-2 overflow-x-auto">
        {['all', 'whatsapp', 'email', 'sms', 'call'].map(f => (
          <button
            key={f}
            onClick={() => setFilterChannel(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors ${
              filterChannel === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {filteredComms.length === 0 ? (
          <EmptyState title="No Communications" description="Send a message or log a call to start the conversation." />
        ) : (
          filteredComms.map(c => (
            <div key={c.id} className={`p-3 rounded-lg max-w-[80%] ${c.direction === 'outbound' ? 'bg-blue-50 ml-auto' : 'bg-gray-50 border'}`}>
              <div className="text-xs text-gray-500 mb-1 flex justify-between">
                <span className="font-semibold uppercase flex items-center gap-2">
                  {c.channel}
                  {c.channel === 'call' && c.duration && (
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">{c.duration} min</span>
                  )}
                </span>
                <span>{new Date(c.sent_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.body}</p>
              {c.direction === 'outbound' && <div className="text-[10px] text-right text-gray-400 mt-1">{c.status}</div>}
            </div>
          ))
        )}
      </div>

      <div className="bg-white border rounded-lg p-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <select 
            value={channel} 
            onChange={e => setChannel(e.target.value)}
            className="text-sm border-gray-300 rounded focus:ring-primary focus:border-primary"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="call">Log Call</option>
          </select>
          
          {channel === 'call' && (
            <Input 
              type="number"
              min="1"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="Duration (min)"
              className="w-32"
            />
          )}

          {channel !== 'call' && (
            <Button variant="outline" size="sm" onClick={handleDraft} disabled={isDrafting}>
              {isDrafting ? 'Drafting...' : '✨ Draft with AI'}
            </Button>
          )}
        </div>
        
        {isEmailMissing && <div className="text-xs text-red-500 mb-2">Lead must have an email address to send emails.</div>}
        {isSmsOrWhatsappOrCallMissing && <div className="text-xs text-red-500 mb-2">Lead must have a phone number for {channel}.</div>}
        
        <div className="flex gap-2">
          <Input 
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={channel === 'call' ? "Log call notes..." : `Type a ${channel} message or AI instruction...`}
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && !isSendDisabled && handleSend()}
            disabled={isEmailMissing || isSmsOrWhatsappOrCallMissing}
          />
          <Button onClick={handleSend} disabled={isSendDisabled}>{channel === 'call' ? 'Log' : 'Send'}</Button>
        </div>
      </div>
    </div>
  );
}
