import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { Button } from '../../components/ui';

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState({
    email_sla_breaches: true,
    push_score_changes: true,
    dnd_start_time: '22:00',
    dnd_end_time: '08:00'
  });
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await api.get('/notifications/preferences');
      if (res.data?.success) {
        setPreferences(prev => ({ ...prev, ...res.data.data }));
      }
    } catch (err) {
      toast.error('Failed to load preferences');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await api.patch('/notifications/preferences', preferences);
      if (res.data?.success) {
        toast.success('Preferences saved successfully!');
      }
    } catch (err) {
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Notification Preferences</h1>
        <p className="mt-2 text-sm text-gray-500">Manage how and when you receive alerts from the CRM.</p>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Alert Settings Section */}
        <div className="p-6 sm:p-8 border-b border-gray-100">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Alert Settings</h2>
            <p className="text-sm text-gray-500 mt-1">Choose which events trigger a notification.</p>
          </div>
          
          <div className="space-y-6">
            <label className="flex items-start justify-between cursor-pointer group p-4 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <div className="flex flex-col pr-8">
                <span className="text-base font-medium text-gray-900 group-hover:text-blue-700 transition-colors">Email Alerts for SLA Breaches</span>
                <span className="text-sm text-gray-500 mt-1 leading-relaxed">Receive an email when a lead sits in a stage past its SLA limit, ensuring no leads fall through the cracks.</span>
              </div>
              <div className="flex items-center h-6 mt-1">
                <input 
                  type="checkbox" 
                  checked={preferences.email_sla_breaches}
                  onChange={e => setPreferences(p => ({ ...p, email_sla_breaches: e.target.checked }))}
                  className="w-5 h-5 text-blue-600 bg-gray-100 rounded border-gray-300 focus:ring-blue-500 focus:ring-2 cursor-pointer transition-all"
                />
              </div>
            </label>

            <div className="h-px bg-gray-100 w-full"></div>

            <label className="flex items-start justify-between cursor-pointer group p-4 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
              <div className="flex flex-col pr-8">
                <span className="text-base font-medium text-gray-900 group-hover:text-blue-700 transition-colors">Push Notifications for Score Changes</span>
                <span className="text-sm text-gray-500 mt-1 leading-relaxed">Receive real-time push alerts when a lead's score changes tier (e.g. from Warm to Hot).</span>
              </div>
              <div className="flex items-center h-6 mt-1">
                <input 
                  type="checkbox" 
                  checked={preferences.push_score_changes}
                  onChange={e => setPreferences(p => ({ ...p, push_score_changes: e.target.checked }))}
                  className="w-5 h-5 text-blue-600 bg-gray-100 rounded border-gray-300 focus:ring-blue-500 focus:ring-2 cursor-pointer transition-all"
                />
              </div>
            </label>
          </div>
        </div>

        {/* Quiet Hours Section */}
        <div className="p-6 sm:p-8 bg-gray-50/50">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Quiet Hours (Do Not Disturb)</h2>
            <p className="text-sm text-gray-500 mt-1">During these hours, all push notifications and alerts will be muted.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
              <input 
                type="time" 
                value={preferences.dnd_start_time}
                onChange={e => setPreferences(p => ({ ...p, dnd_start_time: e.target.value }))}
                className="w-full block border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base py-2.5 px-3"
              />
            </div>
            
            <div className="hidden sm:block text-gray-400 mt-6">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
              </svg>
            </div>
            
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
              <input 
                type="time" 
                value={preferences.dnd_end_time}
                onChange={e => setPreferences(p => ({ ...p, dnd_end_time: e.target.value }))}
                className="w-full block border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base py-2.5 px-3"
              />
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="px-6 py-5 bg-gray-50 border-t border-gray-200 flex justify-end">
          <Button variant="primary" onClick={handleSave} disabled={loading} className="px-6 py-2.5 shadow-sm text-sm font-medium">
            {loading ? 'Saving Changes...' : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </div>
  );
}
