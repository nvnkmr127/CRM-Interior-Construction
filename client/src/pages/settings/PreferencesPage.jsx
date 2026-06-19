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
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Notification Preferences</h1>
      
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Alert Settings</h2>
          
          <div className="space-y-6">
            <label className="flex items-start justify-between cursor-pointer">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">Email Alerts for SLA Breaches</span>
                <span className="text-sm text-gray-500">Receive an email when a lead sits in a stage past its SLA limit.</span>
              </div>
              <input 
                type="checkbox" 
                checked={preferences.email_sla_breaches}
                onChange={e => setPreferences(p => ({ ...p, email_sla_breaches: e.target.checked }))}
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-start justify-between cursor-pointer">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">Push Notifications for Score Changes</span>
                <span className="text-sm text-gray-500">Receive real-time push alerts when a lead's score changes tier (e.g. Warm to Hot).</span>
              </div>
              <input 
                type="checkbox" 
                checked={preferences.push_score_changes}
                onChange={e => setPreferences(p => ({ ...p, push_score_changes: e.target.checked }))}
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        <div className="p-6 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Quiet Hours (Do Not Disturb)</h2>
          <p className="text-sm text-gray-500 mb-4">During these hours, push notifications will be muted.</p>
          
          <div className="flex items-center gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
              <input 
                type="time" 
                value={preferences.dnd_start_time}
                onChange={e => setPreferences(p => ({ ...p, dnd_start_time: e.target.value }))}
                className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
              <input 
                type="time" 
                value={preferences.dnd_end_time}
                onChange={e => setPreferences(p => ({ ...p, dnd_end_time: e.target.value }))}
                className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <Button variant="primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </div>
  );
}
