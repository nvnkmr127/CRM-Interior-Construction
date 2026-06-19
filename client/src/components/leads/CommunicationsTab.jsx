import React, { useState, useEffect } from 'react';
import { getCommunications, createCommunication, draftCommunication } from '../../api/leads';
import { Button, Input, ContentLoader, EmptyState } from '../ui';
import { useToast } from '../../store/toastContext';

export default function CommunicationsTab({ leadId }) {
  const toast = useToast();
  const [comms, setComms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [isDrafting, setIsDrafting] = useState(false);

  useEffect(() => {
    if (leadId) fetchComms();
  }, [leadId]);

  const fetchComms = async () => {
    setLoading(true);
    try {
      const res = await getCommunications(leadId);
      if (res.success) setComms(res.data);
    } catch (e) {
      toast.error('Failed to load communications');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    try {
      const res = await createCommunication(leadId, {
        channel,
        direction: 'outbound',
        body: message,
        status: 'sent'
      });
      if (res.success) {
        toast.success(`Sent via ${channel}`);
        setMessage('');
        fetchComms();
      }
    } catch (e) {
      toast.error('Failed to send message');
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {comms.length === 0 ? (
          <EmptyState title="No Communications" description="Send a message to start the conversation." />
        ) : (
          comms.map(c => (
            <div key={c.id} className={`p-3 rounded-lg max-w-[80%] ${c.direction === 'outbound' ? 'bg-blue-50 ml-auto' : 'bg-gray-50 border'}`}>
              <div className="text-xs text-gray-500 mb-1 flex justify-between">
                <span className="font-semibold uppercase">{c.channel}</span>
                <span>{new Date(c.sent_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.body}</p>
              {c.direction === 'outbound' && <div className="text-[10px] text-right text-gray-400 mt-1">{c.status}</div>}
            </div>
          ))
        )}
      </div>

      <div className="bg-white border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <select 
            value={channel} 
            onChange={e => setChannel(e.target.value)}
            className="text-sm border-gray-300 rounded focus:ring-primary focus:border-primary"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <Button variant="outline" size="sm" onClick={handleDraft} disabled={isDrafting}>
            {isDrafting ? 'Drafting...' : '✨ Draft with AI'}
          </Button>
        </div>
        <div className="flex gap-2">
          <Input 
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={`Type a ${channel} message or AI instruction...`}
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <Button onClick={handleSend} disabled={!message.trim()}>Send</Button>
        </div>
      </div>
    </div>
  );
}
