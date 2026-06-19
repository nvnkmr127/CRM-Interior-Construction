import React from 'react';
import { Input, Button } from '../ui';

export default function PreferencesTab({ lead, handleFieldChange, handleFieldBlur }) {
  // Extract lifestyle_preferences or initialize
  const prefs = lead.lifestyle_preferences || {};

  const handlePrefChange = (field, value) => {
    handleFieldChange('lifestyle_preferences', { ...prefs, [field]: value });
  };

  const handlePrefBlur = (field, value) => {
    handleFieldBlur('lifestyle_preferences', { ...prefs, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 border-b pb-2">Kitchen Preferences</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Kitchen Layout</label>
            <select 
              value={prefs.kitchen_layout || ''} 
              onChange={e => handlePrefChange('kitchen_layout', e.target.value)}
              onBlur={e => handlePrefBlur('kitchen_layout', e.target.value)}
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
              value={prefs.kitchen_finish || ''} 
              onChange={e => handlePrefChange('kitchen_finish', e.target.value)}
              onBlur={e => handlePrefBlur('kitchen_finish', e.target.value)}
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
              value={prefs.wardrobe_type || ''} 
              onChange={e => handlePrefChange('wardrobe_type', e.target.value)}
              onBlur={e => handlePrefBlur('wardrobe_type', e.target.value)}
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
              value={prefs.color_palette || ''} 
              onChange={e => handlePrefChange('color_palette', e.target.value)}
              onBlur={e => handlePrefBlur('color_palette', e.target.value)}
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
            value={prefs.notes || ''} 
            onChange={e => handlePrefChange('notes', e.target.value)}
            onBlur={e => handlePrefBlur('notes', e.target.value)}
            className="w-full text-sm border-gray-300 rounded focus:ring-primary focus:border-primary p-2 border min-h-[100px]"
            placeholder="E.g., Needs pet-friendly fabrics, specific puja unit requirements, etc."
          />
        </div>
      </div>
    </div>
  );
}
