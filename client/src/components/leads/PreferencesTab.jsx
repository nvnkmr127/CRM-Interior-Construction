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

const COUNTERTOP_LABELS = {
  quartz: 'Quartz',
  granite: 'Granite',
  marble: 'Marble',
  solid_surface: 'Solid Surface'
};

const APPLIANCE_LABELS = {
  microwave: 'Built-in Microwave',
  oven: 'Built-in Oven',
  dishwasher: 'Dishwasher',
  hob_chimney: 'Hob & Chimney',
  none: 'None / Standard'
};

const ACCESSORY_LABELS = {
  shoe_rack: 'Pull-out Shoe Rack',
  trouser_hanger: 'Trouser Hanger',
  drawer_org: 'Drawer Organizer',
  safe: 'Internal Safe / Lockbox'
};

const CEILING_LABELS = {
  minimalist: 'Minimalist Border',
  coffered: 'Coffered Design',
  gypsum: 'Gypsum Board',
  rafters: 'Wooden Rafters / Accents'
};

const LIGHTING_LABELS = {
  warm: 'Warm White (Ambient)',
  neutral: 'Neutral White (Daylight)',
  cool: 'Cool White (Task)',
  smart_rgb: 'Smart RGB / Dimming',
  cob_strips: 'COB Strip Lights'
};

const FLOORING_LABELS = {
  vitrified: 'Vitrified Tiles',
  wooden: 'Wooden Laminate',
  spc: 'SPC / Vinyl Plank',
  marble: 'Italian Marble'
};

const PAINTING_LABELS = {
  luxury_emulsion: 'Luxury Emulsion',
  matte: 'Matte Finish',
  satin: 'Satin / Silk Finish',
  texture: 'Texture / Accent Walls'
};

export default function PreferencesTab({ lead, handleFieldChange, handleFieldBlur }) {
  const prefs = lead.lifestyle_preferences || {};
  const [isEditing, setIsEditing] = useState(false);
  const [draftPrefs, setDraftPrefs] = useState(prefs);
  
  const [kitchenCustomFields, setKitchenCustomFields] = useState(() => prefs.kitchen_custom_fields || []);
  const [wardrobeCustomFields, setWardrobeCustomFields] = useState(() => prefs.wardrobe_custom_fields || []);
  const [ceilingCustomFields, setCeilingCustomFields] = useState(() => prefs.ceiling_custom_fields || []);
  const [flooringPaintingCustomFields, setFlooringPaintingCustomFields] = useState(() => prefs.flooring_painting_custom_fields || []);
  const [lifestyleCustomFields, setLifestyleCustomFields] = useState(() => prefs.lifestyle_custom_fields || []);
  const [customSections, setCustomSections] = useState(() => prefs.custom_sections || []);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync draft data when lead preferences change from parent updates
  useEffect(() => {
    if (!isEditing) {
      const currentPrefs = lead.lifestyle_preferences || {};
      setDraftPrefs(currentPrefs);
      setKitchenCustomFields(currentPrefs.kitchen_custom_fields || []);
      setWardrobeCustomFields(currentPrefs.wardrobe_custom_fields || []);
      setCeilingCustomFields(currentPrefs.ceiling_custom_fields || []);
      setFlooringPaintingCustomFields(currentPrefs.flooring_painting_custom_fields || []);
      setLifestyleCustomFields(currentPrefs.lifestyle_custom_fields || []);
      setCustomSections(currentPrefs.custom_sections || []);
    }
  }, [lead.lifestyle_preferences, isEditing]);

  const addKitchenField = () => setKitchenCustomFields([...kitchenCustomFields, { id: Date.now(), label: '', value: '' }]);
  const handleKitchenFieldChange = (id, field, value) => setKitchenCustomFields(kitchenCustomFields.map(f => f.id === id ? { ...f, [field]: value } : f));
  const deleteKitchenField = (id) => setKitchenCustomFields(kitchenCustomFields.filter(f => f.id !== id));

  const addWardrobeField = () => setWardrobeCustomFields([...wardrobeCustomFields, { id: Date.now(), label: '', value: '' }]);
  const handleWardrobeFieldChange = (id, field, value) => setWardrobeCustomFields(wardrobeCustomFields.map(f => f.id === id ? { ...f, [field]: value } : f));
  const deleteWardrobeField = (id) => setWardrobeCustomFields(wardrobeCustomFields.filter(f => f.id !== id));

  const addCeilingField = () => setCeilingCustomFields([...ceilingCustomFields, { id: Date.now(), label: '', value: '' }]);
  const handleCeilingFieldChange = (id, field, value) => setCeilingCustomFields(ceilingCustomFields.map(f => f.id === id ? { ...f, [field]: value } : f));
  const deleteCeilingField = (id) => setCeilingCustomFields(ceilingCustomFields.filter(f => f.id !== id));

  const addFlooringPaintingField = () => setFlooringPaintingCustomFields([...flooringPaintingCustomFields, { id: Date.now(), label: '', value: '' }]);
  const handleFlooringPaintingFieldChange = (id, field, value) => setFlooringPaintingCustomFields(flooringPaintingCustomFields.map(f => f.id === id ? { ...f, [field]: value } : f));
  const deleteFlooringPaintingField = (id) => setFlooringPaintingCustomFields(flooringPaintingCustomFields.filter(f => f.id !== id));

  const addLifestyleField = () => setLifestyleCustomFields([...lifestyleCustomFields, { id: Date.now(), label: '', value: '' }]);
  const handleLifestyleFieldChange = (id, field, value) => setLifestyleCustomFields(lifestyleCustomFields.map(f => f.id === id ? { ...f, [field]: value } : f));
  const deleteLifestyleField = (id) => setLifestyleCustomFields(lifestyleCustomFields.filter(f => f.id !== id));

  // Custom preference sections actions
  const addCustomSection = () => setCustomSections([...customSections, { id: Date.now(), title: '', editingTitle: true, fields: [] }]);
  const handleSectionTitleChange = (id, title) => setCustomSections(customSections.map(sec => sec.id === id ? { ...sec, title } : sec));
  const toggleSectionTitleEdit = (id, isEditingTitle) => setCustomSections(customSections.map(sec => sec.id === id ? { ...sec, editingTitle: isEditingTitle } : sec));
  const deleteCustomSection = (id) => setCustomSections(customSections.filter(sec => sec.id !== id));

  const addSectionField = (sectionId) => {
    setCustomSections(customSections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          fields: [...sec.fields, { id: Date.now(), label: '', value: '', editingLabel: true }]
        };
      }
      return sec;
    }));
  };

  const handleSectionFieldChange = (sectionId, fieldId, key, value) => {
    setCustomSections(customSections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          fields: sec.fields.map(f => f.id === fieldId ? { ...f, [key]: value } : f)
        };
      }
      return sec;
    }));
  };

  const deleteSectionField = (sectionId, fieldId) => {
    setCustomSections(customSections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          fields: sec.fields.filter(f => f.id !== fieldId)
        };
      }
      return sec;
    }));
  };

  const scopeList = typeof lead.scope === 'string' && lead.scope
    ? lead.scope.split(',').map(s => s.trim().toLowerCase())
    : (Array.isArray(lead.scope) ? lead.scope.map(s => String(s).trim().toLowerCase()) : []);

  const hasNoScope = scopeList.length === 0 || (scopeList.length === 1 && scopeList[0] === '');
  const showKitchen = hasNoScope || scopeList.some(s => 
    s.includes('kitchen') || s.includes('cook') || s.includes('pantry') || s.includes('dining') || s.includes('fullhouse')
  );
  const showWardrobe = hasNoScope || scopeList.some(s => 
    s.includes('wardrobe') || s.includes('bedroom') || s.includes('office') || s.includes('study') || 
    s.includes('living') || s.includes('furniture') || s.includes('storage') || s.includes('cabinet') || 
    s.includes('tv') || s.includes('foyer') || s.includes('crockery') || s.includes('pooja') || 
    s.includes('bed') || s.includes('loft') || s.includes('fullhouse')
  );
  const showCeiling = hasNoScope || scopeList.some(s => 
    s.includes('ceiling') || s.includes('light') || s.includes('electrical') || s.includes('living') || 
    s.includes('bedroom') || s.includes('office') || s.includes('study') || s.includes('lobby') || 
    s.includes('dining') || s.includes('fullhouse')
  );
  const showFlooringPainting = hasNoScope || scopeList.some(s => 
    s.includes('flooring') || s.includes('painting') || s.includes('paint') || s.includes('floor') || 
    s.includes('tile') || s.includes('marble') || s.includes('wall') || s.includes('wooden') || 
    s.includes('laminate') || s.includes('living') || s.includes('bedroom') || s.includes('office') || 
    s.includes('study') || s.includes('bathroom') || s.includes('fullhouse')
  );

  const handlePrefChange = (field, value) => {
    setDraftPrefs(prev => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    const currentPrefs = lead.lifestyle_preferences || {};
    setDraftPrefs(currentPrefs);
    setKitchenCustomFields(currentPrefs.kitchen_custom_fields || []);
    setWardrobeCustomFields(currentPrefs.wardrobe_custom_fields || []);
    setCeilingCustomFields(currentPrefs.ceiling_custom_fields || []);
    setFlooringPaintingCustomFields(currentPrefs.flooring_painting_custom_fields || []);
    setLifestyleCustomFields(currentPrefs.lifestyle_custom_fields || []);
    setCustomSections(currentPrefs.custom_sections || []);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updatedPrefs = {
        ...draftPrefs,
        kitchen_custom_fields: kitchenCustomFields.filter(f => f.label.trim() !== ''),
        wardrobe_custom_fields: wardrobeCustomFields.filter(f => f.label.trim() !== ''),
        ceiling_custom_fields: ceilingCustomFields.filter(f => f.label.trim() !== ''),
        flooring_painting_custom_fields: flooringPaintingCustomFields.filter(f => f.label.trim() !== ''),
        lifestyle_custom_fields: lifestyleCustomFields.filter(f => f.label.trim() !== ''),
        custom_sections: customSections.map(sec => ({
          ...sec,
          fields: sec.fields.filter(f => f.label.trim() !== '')
        })).filter(sec => sec.title.trim() !== '')
      };
      // delete old top level custom_fields property
      delete updatedPrefs.custom_fields;

      handleFieldChange('lifestyle_preferences', updatedPrefs);
      await handleFieldBlur('lifestyle_preferences', updatedPrefs);
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
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
            Design & Lifestyle Preferences
          </h3>
          <p className="text-sm text-gray-500 mt-1">Manage client interior requirements and style preferences.</p>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && (
            <button
              type="button"
              onClick={addCustomSection}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm rounded-lg transition-colors shadow-sm border border-emerald-100"
            >
              + Add Custom Section
            </button>
          )}
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
      </div>

      {/* Scope Guidance Info Banner */}
      {hasNoScope && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 text-sm text-blue-800">
          <span className="text-base">💡</span>
          <div>
            <span className="font-bold">Tip:</span> No product scope is selected in the <span className="font-semibold">Overview</span> tab. All preference forms are shown by default. Set the scope to Kitchen, Wardrobe, or False Ceiling to filter these sections.
          </div>
        </div>
      )}

      {isEditing ? (
        // EDIT MODE
        <div className="space-y-6">
          {/* Kitchen Preferences & Extra Preferences */}
          {showKitchen && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-5">
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Kitchen Preferences
                </h3>
                <button
                  type="button"
                  onClick={addKitchenField}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded transition-colors border border-indigo-100 shadow-sm"
                >
                  + Add Extra Field
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Kitchen Layout</label>
                  <select 
                    value={draftPrefs.kitchen_layout || ''} 
                    onChange={e => handlePrefChange('kitchen_layout', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-800"
                  >
                    <option value="">Select Layout...</option>
                    {Object.entries(LAYOUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
                    {Object.entries(FINISH_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Countertop Material</label>
                  <select 
                    value={draftPrefs.kitchen_countertop || ''} 
                    onChange={e => handlePrefChange('kitchen_countertop', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-800"
                  >
                    <option value="">Select Countertop...</option>
                    {Object.entries(COUNTERTOP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Built-in Appliances</label>
                  <select 
                    value={draftPrefs.kitchen_appliances || ''} 
                    onChange={e => handlePrefChange('kitchen_appliances', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-800"
                  >
                    <option value="">Select Appliance...</option>
                    {Object.entries(APPLIANCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Sink & Accessories Type</label>
                  <input 
                    type="text" 
                    value={draftPrefs.kitchen_sink || ''} 
                    onChange={e => handlePrefChange('kitchen_sink', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-800"
                    placeholder="e.g. Under-mount double bowl sink with pull-out faucet"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Hob & Chimney Details</label>
                  <input 
                    type="text" 
                    value={draftPrefs.kitchen_hob || ''} 
                    onChange={e => handlePrefChange('kitchen_hob', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-800"
                    placeholder="e.g. 3-Burner auto ignition hob, filterless chimney"
                  />
                </div>

                {/* Kitchen custom fields */}
                {kitchenCustomFields.map((field) => {
                  const isEditingLabel = field.editingLabel || !field.label;
                  return (
                    <div key={field.id} className="sm:col-span-2 space-y-1.5 relative group">
                      {isEditingLabel ? (
                        <div>
                          <label className="block text-[11px] font-bold text-indigo-900 uppercase tracking-wider mb-1.5">Enter Field Name / Label</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => handleKitchenFieldChange(field.id, 'label', e.target.value)}
                              onBlur={() => {
                                if (field.label.trim()) {
                                  handleKitchenFieldChange(field.id, 'editingLabel', false);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && field.label.trim()) {
                                  e.preventDefault();
                                  handleKitchenFieldChange(field.id, 'editingLabel', false);
                                }
                              }}
                              autoFocus
                              className="w-full text-sm rounded-lg p-2.5 font-medium border border-indigo-200 bg-indigo-50/20 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-800"
                              placeholder="e.g. Backsplash Material"
                            />
                            <button
                              type="button"
                              onClick={() => deleteKitchenField(field.id)}
                              className="px-3 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 font-semibold text-xs shrink-0"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                              {field.label}
                            </label>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleKitchenFieldChange(field.id, 'editingLabel', true)}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold"
                              >
                                Edit Label
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteKitchenField(field.id)}
                                className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => handleKitchenFieldChange(field.id, 'value', e.target.value)}
                            className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-gray-800"
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wardrobe Preferences & Extra Preferences */}
          {showWardrobe && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-teal-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-500"></div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-5">
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Wardrobe & Storage Preferences
                </h3>
                <button
                  type="button"
                  onClick={addWardrobeField}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs rounded transition-colors border border-teal-100 shadow-sm"
                >
                  + Add Extra Field
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Wardrobe Type</label>
                  <select 
                    value={draftPrefs.wardrobe_type || ''} 
                    onChange={e => handlePrefChange('wardrobe_type', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-800"
                  >
                    <option value="">Select Type...</option>
                    {Object.entries(WARDROBE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Door Finish / Material</label>
                  <input 
                    type="text" 
                    value={draftPrefs.wardrobe_door_material || ''} 
                    onChange={e => handlePrefChange('wardrobe_door_material', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-800"
                    placeholder="e.g. Fluted glass, Tinted mirror"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Internal Accessories</label>
                  <select 
                    value={draftPrefs.wardrobe_accessory || ''} 
                    onChange={e => handlePrefChange('wardrobe_accessory', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-800"
                  >
                    <option value="">Select Accessory...</option>
                    {Object.entries(ACCESSORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Loft & Storage Height Requirements</label>
                  <input 
                    type="text" 
                    value={draftPrefs.wardrobe_lofts || ''} 
                    onChange={e => handlePrefChange('wardrobe_lofts', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-800"
                    placeholder="e.g. 2ft lofts required till ceiling height"
                  />
                </div>

                {/* Wardrobe custom fields */}
                {wardrobeCustomFields.map((field) => {
                  const isEditingLabel = field.editingLabel || !field.label;
                  return (
                    <div key={field.id} className="sm:col-span-2 space-y-1.5 relative group">
                      {isEditingLabel ? (
                        <div>
                          <label className="block text-[11px] font-bold text-teal-900 uppercase tracking-wider mb-1.5">Enter Field Name / Label</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => handleWardrobeFieldChange(field.id, 'label', e.target.value)}
                              onBlur={() => {
                                if (field.label.trim()) {
                                  handleWardrobeFieldChange(field.id, 'editingLabel', false);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && field.label.trim()) {
                                  e.preventDefault();
                                  handleWardrobeFieldChange(field.id, 'editingLabel', false);
                                }
                              }}
                              autoFocus
                              className="w-full text-sm rounded-lg p-2.5 font-medium border border-teal-200 bg-teal-50/20 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-800"
                              placeholder="e.g. Balcony Storage"
                            />
                            <button
                              type="button"
                              onClick={() => deleteWardrobeField(field.id)}
                              className="px-3 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 font-semibold text-xs shrink-0"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                              {field.label}
                            </label>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleWardrobeFieldChange(field.id, 'editingLabel', true)}
                                className="text-[10px] text-teal-600 hover:text-teal-800 font-bold"
                              >
                                Edit Label
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteWardrobeField(field.id)}
                                className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => handleWardrobeFieldChange(field.id, 'value', e.target.value)}
                            className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-800"
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* False Ceiling & Lighting Preferences */}
          {showCeiling && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-5">
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  False Ceiling & Lighting Preferences
                </h3>
                <button
                  type="button"
                  onClick={addCeilingField}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded transition-colors border border-amber-100 shadow-sm"
                >
                  + Add Extra Field
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Ceiling Style</label>
                  <select 
                    value={draftPrefs.ceiling_style || ''} 
                    onChange={e => handlePrefChange('ceiling_style', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all text-gray-800"
                  >
                    <option value="">Select Ceiling Style...</option>
                    {Object.entries(CEILING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Primary Lighting Type</label>
                  <select 
                    value={draftPrefs.lighting_type || ''} 
                    onChange={e => handlePrefChange('lighting_type', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all text-gray-800"
                  >
                    <option value="">Select Lighting...</option>
                    {Object.entries(LIGHTING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Ambient & Accents</label>
                  <input 
                    type="text" 
                    value={draftPrefs.ambient_lighting || ''} 
                    onChange={e => handlePrefChange('ambient_lighting', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all text-gray-800"
                    placeholder="e.g. Indirect profile LED, track lighting"
                  />
                </div>
              </div>

              {/* Ceiling custom fields */}
              {ceilingCustomFields.map((field) => {
                const isEditingLabel = field.editingLabel || !field.label;
                return (
                  <div key={field.id} className="sm:col-span-2 space-y-1.5 relative group mt-4">
                    {isEditingLabel ? (
                      <div>
                        <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1.5">Enter Field Name / Label</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => handleCeilingFieldChange(field.id, 'label', e.target.value)}
                            onBlur={() => {
                              if (field.label.trim()) {
                                handleCeilingFieldChange(field.id, 'editingLabel', false);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && field.label.trim()) {
                                e.preventDefault();
                                handleCeilingFieldChange(field.id, 'editingLabel', false);
                              }
                            }}
                            autoFocus
                            className="w-full text-sm rounded-lg p-2.5 font-medium border border-amber-200 bg-amber-50/20 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all text-gray-800"
                            placeholder="e.g. Wood Accents"
                          />
                          <button
                            type="button"
                            onClick={() => deleteCeilingField(field.id)}
                            className="px-3 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 font-semibold text-xs shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            {field.label}
                          </label>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleCeilingFieldChange(field.id, 'editingLabel', true)}
                              className="text-[10px] text-amber-600 hover:text-amber-800 font-bold"
                            >
                              Edit Label
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCeilingField(field.id)}
                              className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => handleCeilingFieldChange(field.id, 'value', e.target.value)}
                          className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all text-gray-800"
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Flooring & Painting Preferences */}
          {showFlooringPainting && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-5">
                <h3 className="text-base font-bold text-gray-800 border-b border-gray-100 pb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  Flooring & Painting Preferences
                </h3>
                <button
                  type="button"
                  onClick={addFlooringPaintingField}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded transition-colors border border-emerald-100 shadow-sm"
                >
                  + Add Extra Field
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Flooring Type</label>
                  <select 
                    value={draftPrefs.flooring_type || ''} 
                    onChange={e => handlePrefChange('flooring_type', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all text-gray-800"
                  >
                    <option value="">Select Flooring...</option>
                    {Object.entries(FLOORING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Paint / Wall Finish</label>
                  <select 
                    value={draftPrefs.paint_finish || ''} 
                    onChange={e => handlePrefChange('paint_finish', e.target.value)}
                    className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all text-gray-800"
                  >
                    <option value="">Select Paint...</option>
                    {Object.entries(PAINTING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                {/* Flooring & Painting custom fields */}
                {flooringPaintingCustomFields.map((field) => {
                  const isEditingLabel = field.editingLabel || !field.label;
                  return (
                    <div key={field.id} className="sm:col-span-2 space-y-1.5 relative group mt-4">
                      {isEditingLabel ? (
                        <div>
                          <label className="block text-[11px] font-bold text-emerald-950 uppercase tracking-wider mb-1.5">Enter Field Name / Label</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) => handleFlooringPaintingFieldChange(field.id, 'label', e.target.value)}
                              onBlur={() => {
                                if (field.label.trim()) {
                                  handleFlooringPaintingFieldChange(field.id, 'editingLabel', false);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && field.label.trim()) {
                                  e.preventDefault();
                                  handleFlooringPaintingFieldChange(field.id, 'editingLabel', false);
                                }
                              }}
                              autoFocus
                              className="w-full text-sm rounded-lg p-2.5 font-medium border border-emerald-200 bg-emerald-50/20 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all text-gray-800"
                              placeholder="e.g. Wall Texture"
                            />
                            <button
                              type="button"
                              onClick={() => deleteFlooringPaintingField(field.id)}
                              className="px-3 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 font-semibold text-xs shrink-0"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                              {field.label}
                            </label>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleFlooringPaintingFieldChange(field.id, 'editingLabel', true)}
                                className="text-[10px] text-emerald-600 hover:text-emerald-850 font-bold"
                              >
                                Edit Label
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteFlooringPaintingField(field.id)}
                                className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => handleFlooringPaintingFieldChange(field.id, 'value', e.target.value)}
                            className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all text-gray-800"
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Sections */}
          {customSections.map((section) => (
            <div key={section.id} className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-5">
                {section.editingTitle ? (
                  <div className="flex-1 flex gap-2 items-center">
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => handleSectionTitleChange(section.id, e.target.value)}
                      onBlur={() => {
                        if (section.title.trim()) {
                          toggleSectionTitleEdit(section.id, false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && section.title.trim()) {
                          e.preventDefault();
                          toggleSectionTitleEdit(section.id, false);
                        }
                      }}
                      placeholder="Enter Section Name (e.g. Prayer Room, Living Room)"
                      className="w-full max-w-sm text-sm rounded-lg p-2 font-semibold border border-purple-200 bg-purple-50/20 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all text-gray-800"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (section.title.trim()) {
                          toggleSectionTitleEdit(section.id, false);
                        } else {
                          deleteCustomSection(section.id);
                        }
                      }}
                      className="px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex justify-between items-center">
                    <h3 className="text-base font-bold text-gray-800 flex items-center gap-2 capitalize">
                      <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                      {section.title} Preferences
                    </h3>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSectionTitleEdit(section.id, true)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCustomSection(section.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                      >
                        Delete Card
                      </button>
                      <button
                        type="button"
                        onClick={() => addSectionField(section.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded transition-colors border border-purple-100 shadow-sm"
                      >
                        + Add Extra Field
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {!section.editingTitle && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {section.fields.map((field) => {
                    const isEditingLabel = field.editingLabel || !field.label;
                    return (
                      <div key={field.id} className="sm:col-span-2 space-y-1.5 relative group">
                        {isEditingLabel ? (
                          <div>
                            <label className="block text-[11px] font-bold text-purple-900 uppercase tracking-wider mb-1.5">Enter Field Name / Label</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => handleSectionFieldChange(section.id, field.id, 'label', e.target.value)}
                                onBlur={() => {
                                  if (field.label.trim()) {
                                    handleSectionFieldChange(section.id, field.id, 'editingLabel', false);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && field.label.trim()) {
                                    e.preventDefault();
                                    handleSectionFieldChange(section.id, field.id, 'editingLabel', false);
                                  }
                                }}
                                autoFocus
                                className="w-full text-sm rounded-lg p-2.5 font-medium border border-purple-200 bg-purple-50/20 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all text-gray-800"
                                placeholder="e.g. Backdrop Material"
                              />
                              <button
                                type="button"
                                onClick={() => deleteSectionField(section.id, field.id)}
                                className="px-3 text-red-500 hover:bg-red-50 rounded-lg border border-red-100 font-semibold text-xs shrink-0"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                {field.label}
                              </label>
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleSectionFieldChange(section.id, field.id, 'editingLabel', true)}
                                  className="text-[10px] text-purple-600 hover:text-purple-800 font-bold"
                                >
                                  Edit Label
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSectionField(section.id, field.id)}
                                  className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) => handleSectionFieldChange(section.id, field.id, 'value', e.target.value)}
                              className="w-full text-sm rounded-lg p-2.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all text-gray-800"
                              placeholder={`Enter ${field.label.toLowerCase()}...`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {section.fields.length === 0 && (
                    <div className="sm:col-span-2 text-sm text-gray-400 italic py-2">
                      No custom fields added yet. Click "+ Add Extra Field" to add details.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* General Lifestyle & Notes */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-[var(--color-border)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-5">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Additional Lifestyle Notes
              </h3>
            </div>
            <div>
              <textarea 
                value={draftPrefs.notes || ''} 
                onChange={e => handlePrefChange('notes', e.target.value)}
                className="w-full text-sm rounded-lg p-3.5 font-medium border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all min-h-[120px] text-gray-800 leading-relaxed"
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
          {/* Kitchen Read-only */}
          {showKitchen && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 hover:border-indigo-200 hover:shadow-md transition-all group">
              <h3 className="text-sm font-bold text-indigo-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                Kitchen Preferences
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kitchen Layout</span>
                  <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.kitchen_layout, LAYOUT_LABELS)}</div>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Kitchen Finish</span>
                  <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.kitchen_finish, FINISH_LABELS)}</div>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Countertop Material</span>
                  <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.kitchen_countertop, COUNTERTOP_LABELS)}</div>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Appliances</span>
                  <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.kitchen_appliances, APPLIANCE_LABELS)}</div>
                </div>
                <div className="col-span-2 space-y-1 border-t border-gray-50 pt-2">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sink Style</span>
                  <div className="text-sm text-gray-700 font-semibold">{draftPrefs.kitchen_sink || <span className="text-gray-400 italic">Not specified</span>}</div>
                </div>
                <div className="col-span-2 space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hob & Chimney Specs</span>
                  <div className="text-sm text-gray-700 font-semibold">{draftPrefs.kitchen_hob || <span className="text-gray-400 italic">Not specified</span>}</div>
                </div>
                
                {/* Kitchen custom fields */}
                {draftPrefs.kitchen_custom_fields && draftPrefs.kitchen_custom_fields.map((field, idx) => (
                  <div key={field.id || idx} className="space-y-1">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</span>
                    <div className="text-sm text-gray-700 font-semibold">{field.value || <span className="text-gray-400 italic">Not specified</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Wardrobe Read-only */}
          {showWardrobe && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-teal-100 hover:border-teal-200 hover:shadow-md transition-all group">
              <h3 className="text-sm font-bold text-teal-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-500 group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                Wardrobe & Storage
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Wardrobe Type</span>
                  <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.wardrobe_type, WARDROBE_LABELS)}</div>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Color Palette</span>
                  <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.color_palette)}</div>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Door Front Material</span>
                  <div className="text-sm font-semibold text-gray-700">{draftPrefs.wardrobe_door_material || <span className="text-gray-400 italic">Not specified</span>}</div>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Key Accessory</span>
                  <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.wardrobe_accessory, ACCESSORY_LABELS)}</div>
                </div>
                <div className="col-span-2 space-y-1 border-t border-gray-50 pt-2">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Loft Configuration</span>
                  <div className="text-sm text-gray-700 font-semibold">{draftPrefs.wardrobe_lofts || <span className="text-gray-400 italic">Not specified</span>}</div>
                </div>

                {/* Wardrobe custom fields */}
                {draftPrefs.wardrobe_custom_fields && draftPrefs.wardrobe_custom_fields.map((field, idx) => (
                  <div key={field.id || idx} className="space-y-1">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</span>
                    <div className="text-sm text-gray-700 font-semibold">{field.value || <span className="text-gray-400 italic">Not specified</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* False Ceiling Read-only */}
          {showCeiling && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 hover:border-amber-200 hover:shadow-md transition-all group">
              <h3 className="text-sm font-bold text-amber-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                False Ceiling & Lighting
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ceiling Style</span>
                  <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.ceiling_style, CEILING_LABELS)}</div>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Primary Light</span>
                  <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.lighting_type, LIGHTING_LABELS)}</div>
                </div>
                <div className="col-span-2 space-y-1 border-t border-gray-50 pt-2">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Accent Lighting Preference</span>
                  <div className="text-sm text-gray-700 font-semibold">{draftPrefs.ambient_lighting || <span className="text-gray-400 italic">Not specified</span>}</div>
                </div>

                {/* Ceiling custom fields */}
                {draftPrefs.ceiling_custom_fields && draftPrefs.ceiling_custom_fields.map((field, idx) => (
                  <div key={field.id || idx} className="space-y-1">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</span>
                    <div className="text-sm text-gray-700 font-semibold">{field.value || <span className="text-gray-400 italic">Not specified</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flooring & Painting Read-only */}
          {showFlooringPainting && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 hover:border-emerald-200 hover:shadow-md transition-all group">
              <h3 className="text-sm font-bold text-emerald-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                Flooring & Wall Painting
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Flooring Choice</span>
                  <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.flooring_type, FLOORING_LABELS)}</div>
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Wall Paint Finish</span>
                  <div className="text-sm">{renderValueOrPlaceholder(draftPrefs.paint_finish, PAINTING_LABELS)}</div>
                </div>

                {/* Flooring & Painting custom fields */}
                {draftPrefs.flooring_painting_custom_fields && draftPrefs.flooring_painting_custom_fields.map((field, idx) => (
                  <div key={field.id || idx} className="space-y-1">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</span>
                    <div className="text-sm text-gray-700 font-semibold">{field.value || <span className="text-gray-400 italic">Not specified</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Sections Read-only */}
          {draftPrefs.custom_sections && draftPrefs.custom_sections.map((section, idx) => (
            <div key={section.id || idx} className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100 hover:border-purple-200 hover:shadow-md transition-all group">
              <h3 className="text-sm font-bold text-purple-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500 group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                {section.title} Preferences
              </h3>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                {section.fields && section.fields.map((field, fIdx) => (
                  <div key={field.id || fIdx} className="space-y-1">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">{field.label}</span>
                    <div className="text-sm text-gray-700 font-semibold">{field.value || <span className="text-gray-400 italic">Not specified</span>}</div>
                  </div>
                ))}
                {(!section.fields || section.fields.length === 0) && (
                  <div className="col-span-2 text-sm text-gray-400 italic">No specifications added yet.</div>
                )}
              </div>
            </div>
          ))}

          {/* Lifestyle Notes */}
          <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-[var(--color-border)] hover:shadow-md transition-all group">
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              Additional Lifestyle Notes
            </h3>
            <div className="pt-1 space-y-4">
              {draftPrefs.notes ? (
                <p className="text-sm text-gray-700 bg-blue-50/20 border border-blue-100/50 p-4 rounded-xl whitespace-pre-wrap leading-relaxed shadow-inner font-medium">
                  {draftPrefs.notes}
                </p>
              ) : (
                <div className="text-sm text-gray-400 italic py-2">No additional lifestyle notes specified for this lead.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
