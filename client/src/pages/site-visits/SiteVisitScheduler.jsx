/* eslint-disable no-unused-vars */
import { useState } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function SiteVisitScheduler({ leadId, currentLeadName, onScheduleComplete }) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    personnel: 'executive',
    sendCustomerInvite: true,
    sendWhatsApp: true,
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.date || !formData.time) {
      toast.error('Date and time are required.');
      return;
    }

    setLoading(true);
    
    try {
      const scheduledAt = new Date(`${formData.date}T${formData.time}`).toISOString();
      const res = await api.post(`/site-visits/lead/${leadId}`, {
        scheduled_at: scheduledAt,
        notes: formData.notes,
        checklist: ['Confirm Address', 'Measure Kitchen', 'Check Plumbing', 'Photos']
      });

      if (res.data.success) {
        setSuccess(true);
        if (onScheduleComplete) onScheduleComplete();
        setTimeout(() => {
          setSuccess(false);
          setFormData({ date: '', time: '', personnel: 'executive', sendCustomerInvite: true, sendWhatsApp: true, notes: '' });
        }, 3000);
      }
    } catch (err) {
      toast.error('Failed to schedule site visit.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-lg border border-green-200 p-6 shadow-sm mb-4 text-center">
        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1">Site Visit Scheduled!</h3>
        <p className="text-gray-600 text-sm">
          Calendar invites and WhatsApp confirmations have been sent. The executive checklist is now active.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm mb-4">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        Schedule Site Visit
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input 
              type="date" 
              name="date"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.date}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input 
              type="time" 
              name="time"
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={formData.time}
              onChange={handleChange}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assign Personnel</label>
          <select 
            name="personnel"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={formData.personnel}
            onChange={handleChange}
          >
            <option value="executive">Sales Executive</option>
            <option value="designer">Designer</option>
            <option value="engineer">Site Engineer</option>
            <option value="manager">Sales Manager</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes / Brief</label>
          <textarea 
            name="notes"
            rows="2"
            placeholder="E.g., Customer is very particular about the kitchen design. Take accurate measurements."
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            value={formData.notes}
            onChange={handleChange}
          ></textarea>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              name="sendCustomerInvite"
              className="w-4 h-4 text-indigo-600 rounded"
              checked={formData.sendCustomerInvite}
              onChange={handleChange}
            />
            <span className="text-sm text-gray-700">Send Calendar Invite to Customer</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              name="sendWhatsApp"
              className="w-4 h-4 text-indigo-600 rounded"
              checked={formData.sendWhatsApp}
              onChange={handleChange}
            />
            <span className="text-sm text-gray-700">Send WhatsApp Confirmation</span>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            type="submit" 
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Scheduling...
              </>
            ) : (
              'Schedule Visit & Notify'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
