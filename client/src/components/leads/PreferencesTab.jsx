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
      return <span className="text-gray-400 italic font-medium">Not specified</span>;
    }
    return <span className="text-gray-800 font-bold">{displayVal}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
            Design & Lifestyle Preferences
          </h3>
          <p className="text-sm text-gray-500 mt-1">Manage client interior requirements and style preferences.</p>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-sm rounded-lg transition-colors shadow-sm border border-indigo-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Preferences
          </button>
        )}
      </div>

      {isEditing ? (
        // EDIT MODE
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-400"></div>
            <h3 className="text-base font-bold text-gray-800 border-b border-gray-100 pb-3 mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Kitchen Preferences
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Kitchen Layout</label>
                <select 
                  value={draftPrefs.kitchen_layout || ''} 
                  onChange={e => handlePrefChange('kitchen_layout', e.target.value)}
                  className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-800"
                >
                  <option value="">Select Layout...</option>
                  <option value="l_shape">L-Shape</option>
                  <option value="u_shape">U-Shape</option>
                  <option value="parallel">Parallel</option>
                  <option value="straight">Straight</option>
                  <option value="island">Island</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Kitchen Finish</label>
                <select 
                  value={draftPrefs.kitchen_finish || ''} 
                  onChange={e => handlePrefChange('kitchen_finish', e.target.value)}
                  className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-800"
                >
                  <option value="">Select Finish...</option>
                  <option value="acrylic">Acrylic</option>
                  <option value="laminate">Laminate</option>
                  <option value="pu">PU</option>
                  <option value="veneer">Veneer</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-teal-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-400"></div>
            <h3 className="text-base font-bold text-gray-800 border-b border-gray-100 pb-3 mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Wardrobe & Storage
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Wardrobe Type</label>
                <select 
                  value={draftPrefs.wardrobe_type || ''} 
                  onChange={e => handlePrefChange('wardrobe_type', e.target.value)}
                  className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-800"
                >
                  <option value="">Select Type...</option>
                  <option value="sliding">Sliding</option>
                  <option value="hinged">Hinged</option>
                  <option value="walk_in">Walk-in</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Color Palette</label>
                <input 
                  type="text" 
                  value={draftPrefs.color_palette || ''} 
                  onChange={e => handlePrefChange('color_palette', e.target.value)}
                  className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-800"
                  placeholder="e.g. Earthy, Pastels, Monochromes"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
            <h3 className="text-base font-bold text-gray-800 border-b border-gray-100 pb-3 mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Additional Lifestyle Notes
            </h3>
            <div>
              <textarea 
                value={draftPrefs.notes || ''} 
                onChange={e => handlePrefChange('notes', e.target.value)}
                className="w-full text-sm rounded-lg p-3.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all min-h-[120px] text-gray-800 leading-relaxed"
                placeholder="E.g., Needs pet-friendly fabrics, specific puja unit requirements, Vaastu compliance needed, etc."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2.5 rounded-lg text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`px-6 py-2.5 text-sm font-bold text-white rounded-lg transition-all shadow-md ${
                isSaving ? 'opacity-50 cursor-not-allowed bg-indigo-500' : saveSuccess ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isSaving ? 'Saving...' : saveSuccess ? 'Saved ✓' : 'Save Preferences'}
            </button>
          </div>
        </div>
      ) : (
        // READ-ONLY DISPLAY MODE
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 hover:border-indigo-200 hover:shadow-md transition-all group">
            <h3 className="text-sm font-bold text-indigo-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              Kitchen Preferences
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kitchen Layout</span>
                <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.kitchen_layout, LAYOUT_LABELS)}</div>
              </div>
              <div className="space-y-1.5">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kitchen Finish</span>
                <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.kitchen_finish, FINISH_LABELS)}</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-teal-100 hover:border-teal-200 hover:shadow-md transition-all group">
            <h3 className="text-sm font-bold text-teal-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-500 group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              Wardrobe & Storage
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Wardrobe Type</span>
                <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.wardrobe_type, WARDROBE_LABELS)}</div>
              </div>
              <div className="space-y-1.5">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Color Palette</span>
                <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.color_palette)}</div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-amber-100 hover:border-amber-200 hover:shadow-md transition-all group">
            <h3 className="text-sm font-bold text-amber-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              Additional Lifestyle Notes
            </h3>
            <div className="pt-1">
              {draftPrefs.notes ? (
                <p className="text-sm text-gray-700 bg-amber-50/50 border border-amber-100/50 p-4 rounded-xl whitespace-pre-wrap leading-relaxed shadow-inner font-medium">
                  {draftPrefs.notes}
                </p>
              ) : (
                <div className="text-sm text-gray-400 italic py-2">No additional notes specified for this lead.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
