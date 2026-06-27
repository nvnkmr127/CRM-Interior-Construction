import React, { useState, useEffect } from 'react';
import layoutStyles from './ConfigLayout.module.css';
import { Button, Input } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

const TRADES = [
  { id: 'civil', label: 'Civil Work' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'false_ceiling', label: 'False Ceiling' },
  { id: 'flooring', label: 'Flooring' },
  { id: 'painting', label: 'Painting' },
  { id: 'carpentry', label: 'Carpentry' },
  { id: 'glass', label: 'Glass Work' },
  { id: 'soft_furnishing', label: 'Soft Furnishing' }
];

const DEFAULT_QC_CHECKLISTS = {
  carpentry: [
    { id: 'c1', label: 'Verify dimensions match approved design drawing', required: true },
    { id: 'c2', label: 'Check veneer/laminate grains alignment and color matching', required: true },
    { id: 'c3', label: 'Check drawer runners and soft-close hinges function smoothly', required: true },
    { id: 'c4', label: 'Ensure edge banding is smooth and free of sharp edges', required: true },
    { id: 'c5', label: 'Verify handle alignment and installation height', required: true }
  ],
  painting: [
    { id: 'p1', label: 'Check wall surface is sanded smooth and clean of dust', required: true },
    { id: 'p2', label: 'Verify application of wall primer coat', required: true },
    { id: 'p3', label: 'Ensure putty levels are checked under light to find imperfections', required: true },
    { id: 'p4', label: 'Check final paint coat color uniformity and edge alignments', required: true },
    { id: 'p5', label: 'Ensure no paint stains on flooring, switch plates, or windows', required: true }
  ],
  electrical: [
    { id: 'e1', label: 'Verify conduit pipe layout matches layout drawing', required: true },
    { id: 'e2', label: 'Check continuity and insulation resistance test of cables', required: true },
    { id: 'e3', label: 'Ensure correct rating of MCBs and correct labeling in DB', required: true },
    { id: 'e4', label: 'Verify all modular switch plates are level and securely fixed', required: true },
    { id: 'e5', label: 'Test all light points, sockets, and appliance outlets', required: true }
  ],
  plumbing: [
    { id: 'pl1', label: 'Pressure test water supply pipes for 24 hours at 10 bar', required: true },
    { id: 'pl2', label: 'Check drainage slope/alignment to ensure no water stagnation', required: true },
    { id: 'pl3', label: 'Conduct waterproofing pond test in bathroom for 48 hours', required: true },
    { id: 'pl4', label: 'Verify fitment of WCs and washbasin without wobble', required: true },
    { id: 'pl5', label: 'Check all CP fittings (faucets, showers) for leakage and flow rate', required: true }
  ],
  flooring: [
    { id: 'f1', label: 'Verify subfloor cleaning and level markings before laying tiles/marble', required: true },
    { id: 'f2', label: 'Check tile spacers are used and joint lines are perfectly aligned', required: true },
    { id: 'f3', label: 'Verify hollow-sound check by tapping laid tiles/stones', required: true },
    { id: 'f4', label: 'Check slope towards drain point in dry/wet areas', required: true },
    { id: 'f5', label: 'Ensure grout filling is complete and uniform', required: true }
  ],
  civil: [
    { id: 'cv1', label: 'Check brickwork alignment and verticality', required: true },
    { id: 'cv2', label: 'Verify concrete/mortar mix ratio', required: true }
  ],
  false_ceiling: [
    { id: 'fc1', label: 'Check level of ceiling frame grid', required: true },
    { id: 'fc2', label: 'Verify spacing of hangers/anchors', required: true }
  ],
  glass: [
    { id: 'gl1', label: 'Check glass thickness and specifications', required: true },
    { id: 'gl2', label: 'Verify glass alignment and silicone sealing', required: true }
  ],
  soft_furnishing: [
    { id: 'sf1', label: 'Verify curtain tracks are securely anchored', required: true },
    { id: 'sf2', label: 'Check wallpaper seams and glue stains', required: true }
  ]
};

export default function QcChecklistsManager() {
  const [qcChecklists, setQcChecklists] = useState({});
  const [selectedTrade, setSelectedTrade] = useState('carpentry');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newRequired, setNewRequired] = useState(true);

  const toast = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/config/tenant-settings');
      const savedConfig = res.data?.data?.qc_checklists || {};
      
      // Merge saved configs with default templates
      const merged = {};
      TRADES.forEach(t => {
        merged[t.id] = savedConfig[t.id] || DEFAULT_QC_CHECKLISTS[t.id] || [];
      });

      setQcChecklists(merged);
    } catch (err) {
      toast.error('Failed to load checklist configurations.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRequired = (index) => {
    const tradeList = [...(qcChecklists[selectedTrade] || [])];
    tradeList[index].required = !tradeList[index].required;
    
    setQcChecklists({
      ...qcChecklists,
      [selectedTrade]: tradeList
    });
  };

  const handleLabelChange = (index, val) => {
    const tradeList = [...(qcChecklists[selectedTrade] || [])];
    tradeList[index].label = val;

    setQcChecklists({
      ...qcChecklists,
      [selectedTrade]: tradeList
    });
  };

  const handleDeleteItem = (index) => {
    const tradeList = (qcChecklists[selectedTrade] || []).filter((_, i) => i !== index);
    
    setQcChecklists({
      ...qcChecklists,
      [selectedTrade]: tradeList
    });
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newLabel.trim()) {
      return toast.error('QC check label cannot be empty.');
    }

    const newItem = {
      id: `qc_${selectedTrade}_${Date.now()}`,
      label: newLabel.trim(),
      required: newRequired
    };

    const tradeList = [...(qcChecklists[selectedTrade] || []), newItem];
    setQcChecklists({
      ...qcChecklists,
      [selectedTrade]: tradeList
    });

    setNewLabel('');
    setNewRequired(true);
    toast.success('Check item added. Save configuration to persist changes.');
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await api.patch('/config/tenant-settings', {
        qc_checklists: qcChecklists
      });
      toast.success('QC checklists configuration saved successfully!');
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 flex items-center gap-2">
          <svg className="animate-spin h-5 width-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading QC templates...
        </div>
      </div>
    );
  }

  const currentList = qcChecklists[selectedTrade] || [];

  return (
    <div className={layoutStyles.configSection}>
      <div className={layoutStyles.sectionHeader}>
        <div>
          <h2 className={layoutStyles.sectionTitle}>Trade Pre-Installation QC Checklists</h2>
          <p className={layoutStyles.sectionDesc}>
            Configure standard quality control inspection questions per trade. These checks must be completed on site before a supervisor can mark a trade activity done.
          </p>
        </div>
        <Button 
          variant="primary" 
          onClick={handleSaveSettings} 
          disabled={saving}
          className="shadow-sm"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

      <div style={{ marginBottom: 24, maxWidth: 300 }}>
        <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
          Select Trade
        </label>
        <select
          value={selectedTrade}
          onChange={(e) => setSelectedTrade(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            outline: 'none',
            fontSize: 'var(--text-sm)',
            fontWeight: 500
          }}
        >
          {TRADES.map(t => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          {TRADES.find(t => t.id === selectedTrade)?.label} QC Items
        </h3>
        
        {currentList.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-500">
            No check items configured for this trade. Add check items below to guide site supervisors.
          </div>
        ) : (
          <div className="grid gap-3">
            {currentList.map((item, idx) => (
              <div 
                key={item.id || idx} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-gray-300 transition-all duration-200"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => handleLabelChange(idx, e.target.value)}
                      className="font-medium text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent py-0.5 px-1 text-sm sm:text-base w-full max-w-md transition-colors"
                      placeholder="e.g. Verify dimensions match drawings"
                    />
                    {item.required ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                        Mandatory
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                        Optional
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 sm:mt-0 justify-end">
                  {/* Mandatory Toggle */}
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!item.required}
                      onChange={() => handleToggleRequired(idx)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition-colors"
                    />
                    Mandatory
                  </label>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteItem(idx)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
                    title="Remove item"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add QC Item Form */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Add QC Check Item</h3>
        <form onSubmit={handleAddItem} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-2">
              <Input
                label="Check Item Description"
                placeholder="e.g. Verify that leveling is checked with plumb bob"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-4 h-11 justify-between sm:justify-start px-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                Mandatory Check
              </label>
              
              <Button type="submit" variant="outline" className="w-full sm:w-auto h-10 ml-auto sm:ml-4">
                Add Item
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
