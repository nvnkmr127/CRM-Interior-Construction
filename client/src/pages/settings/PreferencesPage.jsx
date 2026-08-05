/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { Button, Toggle, Select } from '../../components/ui';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { FiBell, FiMonitor, FiSettings, FiMoon, FiSun, FiLayout, FiClock, FiSmartphone, FiMail } from 'react-icons/fi';
import { usePreferences } from '../../store/PreferencesContext';

export default function PreferencesPage() {
  usePageTitle('Preferences');
  useBreadcrumbs([{ label: 'Settings', path: '/settings/profile' }, { label: 'Preferences' }]);

  const toast = useToast();
  const { localPrefs, setLocalPrefs } = usePreferences();
  
  // Backend tracked preferences
  const [preferences, setPreferences] = useState({
    email_sla_breaches: true,
    push_score_changes: true,
    email_daily_digest: true,
    dnd_start_time: '22:00',
    dnd_end_time: '08:00'
  });

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

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
      // Save backend preferences
      const res = await api.patch('/notifications/preferences', preferences);
      
      // Local frontend preferences are automatically saved in context when changed.

      if (res.data?.success) {
        toast.success('Preferences saved successfully!');
      }
    } catch (err) {
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: <FiSettings className="w-4 h-4" /> },
    { id: 'interface', label: 'Interface', icon: <FiMonitor className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <FiBell className="w-4 h-4" /> },
  ];

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50/50">
      <div className="shrink-0 mb-6 p-4 sm:p-6 border-b border-gray-200 bg-white shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Preferences</h1>
          <p className="mt-2 text-sm text-gray-500">Customize your CRM experience, layout, and notifications.</p>
        </div>
        <Button variant="primary" onClick={handleSave} disabled={loading} className="px-6 py-2.5 shadow-sm text-sm font-medium w-full md:w-auto">
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row gap-6 p-4 sm:px-6 pb-6 overflow-hidden">
        
        {/* Sidebar Navigation */}
        <div className="md:w-64 flex-shrink-0 bg-white border border-gray-200 rounded-xl p-4 shadow-sm h-full overflow-y-auto">
          <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 h-full overflow-y-auto">
          
          {/* General Tab */}
          {activeTab === 'general' && (
            <div>
              <div className="p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">General Settings</h2>
                <p className="text-sm text-gray-500 mb-8">Manage your localization and default behaviors.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <Select
                      label="Default Dashboard"
                      value={localPrefs.defaultDashboard}
                      onChange={(v) => setLocalPrefs({ ...localPrefs, defaultDashboard: v })}
                      options={[
                        { label: 'Sales Dashboard', value: 'sales' },
                        { label: 'Project Dashboard', value: 'projects' },
                        { label: 'Manager Dashboard', value: 'manager' }
                      ]}
                    />
                    <p className="text-xs text-gray-500 mt-2">The page you see when logging in.</p>
                  </div>
                  <div>
                    <Select
                      label="Date Format"
                      value={localPrefs.dateFormat}
                      onChange={(v) => setLocalPrefs({ ...localPrefs, dateFormat: v })}
                      options={[
                        { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
                        { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
                        { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' }
                      ]}
                    />
                    <p className="text-xs text-gray-500 mt-2">How dates are displayed globally.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Interface Tab */}
          {activeTab === 'interface' && (
            <div>
              <div className="p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Appearance</h2>
                <p className="text-sm text-gray-500 mb-8">Customize how the CRM looks on your device.</p>

                <div className="mb-10">
                  <label className="block text-sm font-medium text-gray-900 mb-4">Theme</label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: 'light', label: 'Light', icon: <FiSun className="w-5 h-5 mb-2" /> },
                      { id: 'dark', label: 'Dark', icon: <FiMoon className="w-5 h-5 mb-2" /> },
                      { id: 'system', label: 'System', icon: <FiMonitor className="w-5 h-5 mb-2" /> }
                    ].map(theme => (
                      <div 
                        key={theme.id}
                        onClick={() => setLocalPrefs({ ...localPrefs, theme: theme.id })}
                        className={`cursor-pointer rounded-lg border-2 p-4 flex flex-col items-center justify-center transition-all ${
                          localPrefs.theme === theme.id 
                            ? 'border-blue-600 bg-blue-50/50 text-blue-700' 
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        {theme.icon}
                        <span className="text-sm font-medium">{theme.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-4">Layout Density</label>
                  <div className="grid grid-cols-2 gap-4">
                     {[
                      { id: 'standard', label: 'Standard', desc: 'Comfortable spacing' },
                      { id: 'compact', label: 'Compact', desc: 'More data on screen' }
                    ].map(density => (
                      <div 
                        key={density.id}
                        onClick={() => setLocalPrefs({ ...localPrefs, layoutDensity: density.id })}
                        className={`cursor-pointer rounded-lg border p-4 transition-all ${
                          localPrefs.layoutDensity === density.id 
                            ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50/20' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <FiLayout className={localPrefs.layoutDensity === density.id ? 'text-blue-600' : 'text-gray-400'} />
                          <span className={`font-medium ${localPrefs.layoutDensity === density.id ? 'text-blue-900' : 'text-gray-900'}`}>
                            {density.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 pl-7">{density.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div>
              <div className="p-6 sm:p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Alerts & Notifications</h2>
                <p className="text-sm text-gray-500 mb-8">Control when and how you are notified.</p>
                
                <div className="space-y-6">
                  {/* Item 1 */}
                  <div className="flex items-start justify-between group p-4 -mx-4 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex gap-4">
                      <div className="mt-1 bg-red-100 p-2 rounded-lg text-red-600"><FiMail /></div>
                      <div className="flex flex-col">
                        <span className="text-base font-medium text-gray-900">Email Alerts for SLA Breaches</span>
                        <span className="text-sm text-gray-500 mt-1 leading-relaxed max-w-lg">Receive an email when a lead sits in a stage past its SLA limit, ensuring no leads fall through.</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Toggle 
                        checked={preferences.email_sla_breaches}
                        onChange={e => setPreferences(p => ({ ...p, email_sla_breaches: e.target.checked }))}
                      />
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="flex items-start justify-between group p-4 -mx-4 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex gap-4">
                      <div className="mt-1 bg-blue-100 p-2 rounded-lg text-blue-600"><FiSmartphone /></div>
                      <div className="flex flex-col">
                        <span className="text-base font-medium text-gray-900">Push Notifications for Score Changes</span>
                        <span className="text-sm text-gray-500 mt-1 leading-relaxed max-w-lg">Receive real-time push alerts when a lead's score changes tier (e.g. from Warm to Hot).</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Toggle 
                        checked={preferences.push_score_changes}
                        onChange={e => setPreferences(p => ({ ...p, push_score_changes: e.target.checked }))}
                      />
                    </div>
                  </div>

                  {/* Item 3 (Mocked) */}
                  <div className="flex items-start justify-between group p-4 -mx-4 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex gap-4">
                      <div className="mt-1 bg-green-100 p-2 rounded-lg text-green-600"><FiMail /></div>
                      <div className="flex flex-col">
                        <span className="text-base font-medium text-gray-900">Daily Digest Email</span>
                        <span className="text-sm text-gray-500 mt-1 leading-relaxed max-w-lg">Get a morning summary of your pending tasks, new leads, and project updates.</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Toggle 
                        checked={preferences.email_daily_digest}
                        onChange={e => setPreferences(p => ({ ...p, email_daily_digest: e.target.checked }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quiet Hours Section */}
              <div className="p-6 sm:p-8 bg-gray-50 rounded-b-xl border-t border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                  <FiClock className="w-5 h-5 text-gray-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Quiet Hours (Do Not Disturb)</h2>
                    <p className="text-sm text-gray-500">Mute all push notifications during this window.</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-6 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">From</label>
                    <input 
                      type="time" 
                      value={preferences.dnd_start_time}
                      onChange={e => setPreferences(p => ({ ...p, dnd_start_time: e.target.value }))}
                      className="w-full block border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base py-2.5 px-3 bg-gray-50"
                    />
                  </div>
                  
                  <div className="hidden sm:flex text-gray-300 mt-6 font-bold">
                    →
                  </div>
                  
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">To</label>
                    <input 
                      type="time" 
                      value={preferences.dnd_end_time}
                      onChange={e => setPreferences(p => ({ ...p, dnd_end_time: e.target.value }))}
                      className="w-full block border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base py-2.5 px-3 bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
