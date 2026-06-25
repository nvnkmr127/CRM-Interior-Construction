import React, { useState, useEffect } from 'react';

const LAYOUT_LABELS = {
  l_shape: 'L-Shape',
  u_shape: 'U-Shape',
  parallel: 'Parallel',
  straight: 'Straight',
  island: 'Island'
};

const FINISH_LABELS = {
  acrylic: 'Acrylic',
  laminate: 'Laminate',
  pu: 'PU',
  veneer: 'Veneer'
};

const WARDROBE_LABELS = {
  sliding: 'Sliding',
  hinged: 'Hinged',
  walk_in: 'Walk-in'
};

export default function PreferencesTab({ lead, handleFieldChange, handleFieldBlur }) {
  const prefs = lead.lifestyle_preferences || {};
  const [isEditing, setIsEditing] = useState(false);
  const [draftPrefs, setDraftPrefs] = useState(prefs);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync draft data when lead preferences change from parent updates
  useEffect(() => {
    if (!isEditing) {
      setDraftPrefs(lead.lifestyle_preferences || {});
    }
  }, [lead.lifestyle_preferences, isEditing]);

  const handlePrefChange = (field, value) => {
    setDraftPrefs(prev => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    setDraftPrefs(lead.lifestyle_preferences || {});
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      handleFieldChange('lifestyle_preferences', draftPrefs);
      await handleFieldBlur('lifestyle_preferences', draftPrefs);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderValueOrPlaceholder = (val, labelMapping) => {
    const displayVal = labelMapping ? labelMapping[val] : val;
    if (!displayVal) {
      return <span className="text-gray-400 italic font-normal">Not specified</span>;
    }
    return <span className="text-gray-800 font-medium">{displayVal}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header bar with Edit button */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-gray-800">Design & Lifestyle Preferences</h3>
          <p className="text-xs text-gray-500">Manage client interior requirements and style preferences</p>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 text-xs font-semibold rounded transition-colors shadow-sm border border-blue-100"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Preferences
          </button>
        )}
      </div>

      {isEditing ? (
        // EDIT MODE
        <>
          <div className="bg-white rounded-lg border p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">Kitchen Preferences</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Kitchen Layout</label>
                <select 
                  value={draftPrefs.kitchen_layout || ''} 
                  onChange={e => handlePrefChange('kitchen_layout', e.target.value)}
                  className="w-full text-sm border-gray-300 rounded focus:ring-primary focus:border-primary p-2 border"
                >
                  <option value="">Select...</option>
                  <option value="l_shape">L-Shape</option>
                  <option value="u_shape">U-Shape</option>
                  <option value="parallel">Parallel</option>
                  <option value="straight">Straight</option>
                  <option value="island">Island</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Kitchen Finish</label>
                <select 
                  value={draftPrefs.kitchen_finish || ''} 
                  onChange={e => handlePrefChange('kitchen_finish', e.target.value)}
                  className="w-full text-sm border-gray-300 rounded focus:ring-primary focus:border-primary p-2 border"
                >
                  <option value="">Select...</option>
                  <option value="acrylic">Acrylic</option>
                  <option value="laminate">Laminate</option>
                  <option value="pu">PU</option>
                  <option value="veneer">Veneer</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">Wardrobe & Storage</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Wardrobe Type</label>
                <select 
                  value={draftPrefs.wardrobe_type || ''} 
                  onChange={e => handlePrefChange('wardrobe_type', e.target.value)}
                  className="w-full text-sm border-gray-300 rounded focus:ring-primary focus:border-primary p-2 border"
                >
                  <option value="">Select...</option>
                  <option value="sliding">Sliding</option>
                  <option value="hinged">Hinged</option>
                  <option value="walk_in">Walk-in</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Color Palette</label>
                <input 
                  type="text" 
                  value={draftPrefs.color_palette || ''} 
                  onChange={e => handlePrefChange('color_palette', e.target.value)}
                  className="w-full text-sm border-gray-300 rounded focus:ring-primary focus:border-primary p-2 border"
                  placeholder="e.g. Earthy, Pastels, Monochromes"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">Additional Lifestyle Notes</h3>
            <div>
              <textarea 
                value={draftPrefs.notes || ''} 
                onChange={e => handlePrefChange('notes', e.target.value)}
                className="w-full text-sm border-gray-300 rounded focus:ring-primary focus:border-primary p-2 border min-h-[100px]"
                placeholder="E.g., Needs pet-friendly fabrics, specific puja unit requirements, etc."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`px-5 py-2.5 rounded text-sm font-semibold shadow-sm transition-all duration-200 ${
                saveSuccess 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
              }`}
            >
              {isSaving ? 'Saving...' : saveSuccess ? 'Saved ✓' : 'Save Preferences'}
            </button>
          </div>
        </>
      ) : (
        // READ-ONLY DISPLAY MODE
        <>
          <div className="bg-white rounded-lg border p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Kitchen Preferences
            </h3>
            <div className="grid grid-cols-2 gap-6 py-2">
              <div className="space-y-1">
                <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Kitchen Layout</span>
                <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.kitchen_layout, LAYOUT_LABELS)}</div>
              </div>
              <div className="space-y-1">
                <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Kitchen Finish</span>
                <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.kitchen_finish, FINISH_LABELS)}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Wardrobe & Storage
            </h3>
            <div className="grid grid-cols-2 gap-6 py-2">
              <div className="space-y-1">
                <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Wardrobe Type</span>
                <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.wardrobe_type, WARDROBE_LABELS)}</div>
              </div>
              <div className="space-y-1">
                <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Color Palette</span>
                <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.color_palette)}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Additional Lifestyle Notes
            </h3>
            <div className="py-2">
              {draftPrefs.notes ? (
                <p className="text-sm text-gray-700 bg-gray-50 p-3.5 rounded border border-gray-100 whitespace-pre-wrap leading-relaxed">
                  {draftPrefs.notes}
                </p>
              ) : (
                <div className="text-sm text-gray-400 italic py-1">No additional notes specified</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

