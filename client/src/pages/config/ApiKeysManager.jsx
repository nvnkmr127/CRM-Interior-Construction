import React, { useState, useEffect } from 'react';
import api from '../../api/axios';

const SCOPE_OPTIONS = [
  'read', 'write', 'admin', 
  'leads:read', 'leads:write', 
  'projects:read', 'projects:write', 
  'webhooks:manage'
];

export default function ApiKeysManager() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRevealModalOpen, setIsRevealModalOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [canCloseReveal, setCanCloseReveal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    scopes: ['read'],
    rateLimitRpm: 60,
    ipAllowlist: '',
    expiresAt: ''
  });

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await api.get('/config/api-keys');
      if (res.data?.success) {
        setKeys(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch API keys', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleScopeToggle = (scope) => {
    setFormData(prev => {
      const isSelected = prev.scopes.includes(scope);
      return {
        ...prev,
        scopes: isSelected 
          ? prev.scopes.filter(s => s !== scope)
          : [...prev.scopes, scope]
      };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const ipList = formData.ipAllowlist
        .split(',')
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0);

      const payload = {
        name: formData.name,
        scopes: formData.scopes,
        rateLimitRpm: Number(formData.rateLimitRpm),
        ipAllowlist: ipList,
        expiresAt: formData.expiresAt || null
      };

      const res = await api.post('/config/api-keys', payload);
      if (res.data?.success) {
        setNewlyCreatedKey(res.data.data.rawKey);
        setIsCreateModalOpen(false);
        setIsRevealModalOpen(true);
        setCanCloseReveal(false);
        
        // Reset form
        setFormData({
          name: '',
          scopes: ['read'],
          rateLimitRpm: 60,
          ipAllowlist: '',
          expiresAt: ''
        });

        // Force a 3-second delay to ensure user pays attention
        setTimeout(() => setCanCloseReveal(true), 3000);
        
        fetchKeys();
      }
    } catch (err) {
      console.error('Failed to create key', err);
      alert('Failed to create API key.');
    }
  };

  const handleRevoke = async (id, name) => {
    if (!window.confirm(`Are you sure you want to revoke the API key "${name}"? This action cannot be undone and integrations using this key will immediately fail.`)) {
      return;
    }
    try {
      await api.delete(`/config/api-keys/${id}`);
      setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: false } : k));
    } catch (err) {
      console.error('Revoke failed', err);
      alert('Failed to revoke key.');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newlyCreatedKey);
    alert('API Key copied to clipboard!');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-500 text-sm mt-1">Manage secure access keys for external integrations.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium shadow-sm transition-colors"
        >
          + New API Key
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prefix</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scopes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">No API keys found. Generate one to get started.</td>
                </tr>
              ) : keys.map(k => {
                let parsedScopes = [];
                try { parsedScopes = typeof k.scopes === 'string' ? JSON.parse(k.scopes) : (k.scopes || []); } catch(e) {}
                
                return (
                  <tr key={k.id} className={!k.is_active ? 'opacity-50 bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{k.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{k.key_prefix}****</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {parsedScopes.map(s => (
                          <span key={s} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${k.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {k.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {k.is_active && (
                        <button 
                          onClick={() => handleRevoke(k.id, k.name)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Create New API Key</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-500">×</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key Name *</label>
                <input 
                  type="text" required
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Zapier Integration"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scopes</label>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-md border border-gray-100">
                  {SCOPE_OPTIONS.map(scope => (
                    <label key={scope} className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={formData.scopes.includes(scope)}
                        onChange={() => handleScopeToggle(scope)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{scope}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate Limit (RPM)</label>
                  <input 
                    type="number" min="1"
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.rateLimitRpm}
                    onChange={e => setFormData({...formData, rateLimitRpm: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires (Optional)</label>
                  <input 
                    type="date"
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    value={formData.expiresAt}
                    onChange={e => setFormData({...formData, expiresAt: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP Allowlist (Optional)</label>
                <input 
                  type="text"
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Comma separated (e.g. 192.168.1.1)"
                  value={formData.ipAllowlist}
                  onChange={e => setFormData({...formData, ipAllowlist: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to allow all IP addresses.</p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 transition-colors shadow-sm">Generate Key</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reveal Modal */}
      {isRevealModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
            <div className="p-8">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-2">API Key Generated</h3>
              <p className="text-sm text-red-600 font-medium text-center bg-red-50 p-2 rounded mb-6">
                Your API key — copy it now. For security reasons, it won't be shown again.
              </p>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
                <code className="text-sm font-mono text-gray-800 break-all bg-white px-2 py-1 border border-gray-100 rounded">{newlyCreatedKey}</code>
                <button 
                  onClick={handleCopy}
                  className="flex-shrink-0 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                >
                  Copy
                </button>
              </div>

              <div className="flex justify-center">
                <button 
                  onClick={() => {
                    setIsRevealModalOpen(false);
                    setNewlyCreatedKey(null);
                  }}
                  disabled={!canCloseReveal}
                  className={`px-6 py-2.5 rounded-md font-medium text-white transition-all ${canCloseReveal ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md' : 'bg-gray-400 cursor-not-allowed opacity-80'}`}
                >
                  {canCloseReveal ? 'I have copied the key' : 'Wait... (saving)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
