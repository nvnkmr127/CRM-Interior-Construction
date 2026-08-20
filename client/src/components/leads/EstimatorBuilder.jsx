import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button, Badge } from '../ui';
import { useToast } from '../../store/toastContext';
import { createEstimate, updateEstimate } from '../../api/leads';
import api from '../../api/axios';

const LAYOUT_LABELS = { l_shape: 'L-Shape', u_shape: 'U-Shape', parallel: 'Parallel', straight: 'Straight', island: 'Island' };
const FINISH_LABELS = { acrylic: 'Acrylic', laminate: 'Laminate', pu: 'PU', veneer: 'Veneer' };
const WARDROBE_LABELS = { sliding: 'Sliding', hinged: 'Hinged', walk_in: 'Walk-in' };
const COUNTERTOP_LABELS = { quartz: 'Quartz', granite: 'Granite', marble: 'Marble', solid_surface: 'Solid Surface' };
const APPLIANCE_LABELS = { microwave: 'Built-in Microwave', oven: 'Built-in Oven', dishwasher: 'Dishwasher', hob_chimney: 'Hob & Chimney', none: 'None' };
const ACCESSORY_LABELS = { shoe_rack: 'Pull-out Shoe Rack', trouser_hanger: 'Trouser Hanger', drawer_org: 'Drawer Organizer', safe: 'Internal Safe' };
const CEILING_LABELS = { minimalist: 'Minimalist Border', coffered: 'Coffered Design', gypsum: 'Gypsum Board', rafters: 'Wooden Rafters' };
const LIGHTING_LABELS = { warm: 'Warm White', neutral: 'Neutral White', cool: 'Cool White', smart_rgb: 'Smart RGB', cob_strips: 'COB Strip Lights' };
const FLOORING_LABELS = { vitrified: 'Vitrified Tiles', wooden: 'Wooden Laminate', spc: 'SPC / Vinyl Plank', marble: 'Italian Marble' };
const PAINTING_LABELS = { luxury_emulsion: 'Luxury Emulsion', matte: 'Matte Finish', satin: 'Satin Finish', texture: 'Texture Accent' };

export default function EstimatorBuilder({ leadId, lead, initialEstimate, onCancel, onSaved }) {
  const toast = useToast();
  const [measurements, setMeasurements] = useState([]);
  const [inspirations, setInspirations] = useState([]);
  const [loadingInspirations, setLoadingInspirations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Parse active product scopes
  const scopeList = typeof lead?.scope === 'string' && lead.scope
    ? lead.scope.split(',').map(s => s.trim().toLowerCase())
    : (Array.isArray(lead?.scope) ? lead.scope.map(s => String(s).trim().toLowerCase()) : []);

  const hasNoScope = scopeList.length === 0 || (scopeList.length === 1 && scopeList[0] === '');
  const isKitchenActive = hasNoScope || scopeList.some(s => 
    s.includes('kitchen') || s.includes('cook') || s.includes('pantry') || s.includes('dining') || s.includes('fullhouse')
  );
  const isWardrobeActive = hasNoScope || scopeList.some(s => 
    s.includes('wardrobe') || s.includes('bedroom') || s.includes('office') || s.includes('study') || 
    s.includes('living') || s.includes('furniture') || s.includes('storage') || s.includes('cabinet') || 
    s.includes('tv') || s.includes('foyer') || s.includes('crockery') || s.includes('pooja') || 
    s.includes('bed') || s.includes('loft') || s.includes('fullhouse')
  );
  const isCeilingActive = hasNoScope || scopeList.some(s => 
    s.includes('ceiling') || s.includes('light') || s.includes('electrical') || s.includes('living') || 
    s.includes('bedroom') || s.includes('office') || s.includes('study') || s.includes('lobby') || 
    s.includes('dining') || s.includes('fullhouse')
  );
  const isFlooringPaintingActive = hasNoScope || scopeList.some(s => 
    s.includes('flooring') || s.includes('painting') || s.includes('paint') || s.includes('floor') || 
    s.includes('tile') || s.includes('marble') || s.includes('wall') || s.includes('wooden') || 
    s.includes('laminate') || s.includes('living') || s.includes('bedroom') || s.includes('office') || 
    s.includes('study') || s.includes('bathroom') || s.includes('fullhouse')
  );

  const [rooms, setRooms] = useState(() => {
    if (initialEstimate?.payload?.rooms?.length) {
      return initialEstimate.payload.rooms;
    }

    // Pre-populate rooms with default categories based on active scope
    const defaultRooms = [];
    const now = Date.now();

    if (isKitchenActive) {
      defaultRooms.push({
        id: now,
        name: 'Modular Kitchen',
        items: [
          { id: now + 1, description: 'Kitchen Modular Cabinets (Base & Wall units)', qty: 1, rate: 0 },
          { id: now + 2, description: 'Countertop Stone & Backsplash Fixing', qty: 1, rate: 0 }
        ]
      });
    }

    if (isWardrobeActive) {
      defaultRooms.push({
        id: now + 10,
        name: 'Bedroom Wardrobe',
        items: [
          { id: now + 11, description: 'Wardrobe Carcass & Hinged/Sliding Shutters', qty: 1, rate: 0 }
        ]
      });
    }

    if (isCeilingActive) {
      defaultRooms.push({
        id: now + 20,
        name: 'False Ceiling & Lighting',
        items: [
          { id: now + 21, description: 'Gypsum Board Ceiling with perimeter COB lighting', qty: 1, rate: 0 }
        ]
      });
    }

    if (defaultRooms.length === 0) {
      defaultRooms.push({ id: now, name: 'Main Area', items: [] });
    }

    return defaultRooms;
  });

  useEffect(() => {
    if (leadId) {
      // Fetch dimensions
      api.get(`/leads/${leadId}/measurements`)
        .then(res => {
          if (res.data && res.data.success && Array.isArray(res.data.data)) {
            setMeasurements(res.data.data);
          }
        })
        .catch(err => console.error('Failed to load lead measurements:', err));

      // Fetch inspirations
      api.get(`/leads/${leadId}/inspirations`)
        .then(res => {
          if (res.data && res.data.success && Array.isArray(res.data.data)) {
            setInspirations(res.data.data);
          }
        })
        .catch(err => console.error('Failed to load inspirations:', err))
        .finally(() => setLoadingInspirations(false));
    }
  }, [leadId]);

  const addRoom = () => {
    setRooms([...rooms, { id: Date.now(), name: 'New Room', items: [] }]);
  };

  const removeRoom = (roomId) => {
    setRooms(rooms.filter(r => r.id !== roomId));
  };

  const updateRoomName = (roomId, name) => {
    setRooms(rooms.map(r => r.id === roomId ? { ...r, name } : r));
  };

  const addItem = (roomId) => {
    setRooms(rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          items: [...r.items, { id: Date.now(), description: '', qty: 1, rate: 0 }]
        };
      }
      return r;
    }));
  };

  const removeItem = (roomId, itemId) => {
    setRooms(rooms.map(r => {
      if (r.id === roomId) {
        return { ...r, items: r.items.filter(i => i.id !== itemId) };
      }
      return r;
    }));
  };

  const updateItem = (roomId, itemId, field, value) => {
    setRooms(rooms.map(r => {
      if (r.id === roomId) {
        return {
          ...r,
          items: r.items.map(i => i.id === itemId ? { ...i, [field]: value } : i)
        };
      }
      return r;
    }));
  };

  const calculateTotal = () => {
    let total = 0;
    rooms.forEach(r => {
      r.items.forEach(i => {
        total += (Number(i.qty) || 0) * (Number(i.rate) || 0);
      });
    });
    return total;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { rooms, total_amount: calculateTotal() };
      if (initialEstimate) {
        await updateEstimate(leadId, initialEstimate.id, payload);
        toast.success('Estimate updated successfully');
      } else {
        await createEstimate(leadId, payload);
        toast.success('Estimate created successfully');
      }
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error(initialEstimate ? 'Failed to update estimate' : 'Failed to create estimate');
    } finally {
      setSaving(false);
    }
  };

  // Filter inspirations based on active product scope
  const filteredInspirations = inspirations.filter(insp => {
    if (hasNoScope || scopeList.includes('fullhouse')) return true;
    const roomType = (insp.room_type || '').toLowerCase();
    if (isKitchenActive && (roomType.includes('kitchen') || roomType.includes('cooking'))) return true;
    if (isWardrobeActive && (roomType.includes('wardrobe') || roomType.includes('bedroom') || roomType.includes('closet') || roomType.includes('storage'))) return true;
    if (isCeilingActive && (roomType.includes('ceiling') || roomType.includes('lighting') || roomType.includes('lights'))) return true;
    if (isFlooringPaintingActive && (roomType.includes('flooring') || roomType.includes('painting') || roomType.includes('wall'))) return true;
    return false;
  });

  const prefs = lead?.lifestyle_preferences || {};

  const portalRoot = document.getElementById('lead-drawer-root');
  if (!portalRoot) return null;

  return createPortal(
    <div className="absolute inset-0 z-[100] flex flex-col bg-slate-50 overflow-hidden animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Estimator Builder</h2>
            <p className="text-sm text-gray-500 font-medium">Build a customized Bill of Quantities (BOQ)</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Value</span>
            <div className="text-2xl font-black text-indigo-700">
              ₹{calculateTotal().toLocaleString('en-IN')}
            </div>
          </div>
          <div className="h-10 w-px bg-gray-200 hidden sm:block"></div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Estimate'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Column: Form Editor */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar border-b lg:border-b-0 lg:border-r border-gray-200">
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {rooms.map((room, rIndex) => (
              <div key={room.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-visible transition-all hover:shadow-md">
                
                {/* Room Header */}
                <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-t-2xl">
                  <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                      {rIndex + 1}
                    </div>
                    <input
                      type="text"
                      value={room.name}
                      onChange={(e) => updateRoomName(room.id, e.target.value)}
                      className="bg-transparent font-extrabold text-lg text-gray-800 focus:outline-none focus:border-b-2 border-indigo-500 w-full sm:w-64 px-1 py-0.5 transition-colors placeholder-gray-300"
                      placeholder="Enter Room Name"
                    />
                    {measurements && measurements.length > 0 && (
                      <div className="relative shrink-0 hidden sm:block">
                        <select
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) updateRoomName(room.id, val);
                          }}
                          value={measurements.some(m => m.room_name === room.name) ? room.name : ''}
                          className="appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-10 py-1.5 text-xs font-bold text-indigo-600 focus:outline-none focus:ring-2 ring-indigo-500 shadow-sm cursor-pointer hover:bg-gray-50 min-w-[160px]"
                        >
                          <option value="">Match Dimension...</option>
                          {measurements.map(m => (
                            <option key={m.id} value={m.room_name}>{m.room_name}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-indigo-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => removeRoom(room.id)} 
                    className="text-gray-400 hover:text-red-500 text-sm font-bold flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Remove
                  </button>
                </div>

                {/* Room Items */}
                <div className="p-6">
                  {room.items.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mb-4">
                      <p className="text-sm font-semibold text-gray-500 mb-3">No line items added to this room yet.</p>
                      <button 
                        onClick={() => addItem(room.id)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-indigo-600 font-bold text-sm shadow-sm hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                      >
                        + Add First Item
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm mb-6">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-400 text-xs uppercase tracking-wider">
                            <th className="pb-3 font-bold pl-2 w-1/2">Item Description</th>
                            <th className="pb-3 font-bold px-2 w-24">Qty</th>
                            <th className="pb-3 font-bold px-2 w-36">Rate (₹)</th>
                            <th className="pb-3 font-bold px-2 w-36 text-right">Amount (₹)</th>
                            <th className="pb-3 w-12 text-center">Act</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {room.items.map(item => {
                            const amount = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                            return (
                              <tr key={item.id} className="group hover:bg-gray-50/30 transition-colors">
                                <td className="py-3 px-2 align-top">
                                  <textarea
                                    rows={1}
                                    className="w-full bg-gray-50/50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 font-medium focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-white outline-none transition-all resize-y min-h-[40px]"
                                    value={item.description}
                                    onChange={e => updateItem(room.id, item.id, 'description', e.target.value)}
                                    placeholder="e.g. Wardrobe in premium laminate finish"
                                  />
                                </td>
                                <td className="py-3 px-2 align-top">
                                  <div className="flex items-center gap-1.5 relative">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="w-full bg-gray-50/50 border border-gray-200 rounded-lg px-2 py-2 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-white outline-none transition-all"
                                      value={item.qty}
                                      onChange={e => updateItem(room.id, item.id, 'qty', e.target.value)}
                                    />
                                    {/* Dimension Helper */}
                                    {(() => {
                                      const matchingRoom = measurements.find(m => m.room_name?.toLowerCase() === room.name?.toLowerCase());
                                      if (!matchingRoom) return null;
                                      return (
                                        <div className="relative group/dim">
                                          <button 
                                            type="button"
                                            className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
                                            title="Pull from measurements"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                          </button>
                                          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover/dim:block bg-gray-900 text-white rounded-lg shadow-xl z-20 py-2 min-w-[140px] text-xs">
                                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45"></div>
                                            <div className="px-3 pb-1.5 font-bold uppercase tracking-widest text-[10px] text-gray-400 border-b border-gray-700">Insert Measure</div>
                                            <button type="button" onClick={() => updateItem(room.id, item.id, 'qty', matchingRoom.length)} className="w-full text-left px-4 py-2 hover:bg-gray-800 flex justify-between"><span>Length</span><span className="font-bold text-indigo-300">{matchingRoom.length}</span></button>
                                            <button type="button" onClick={() => updateItem(room.id, item.id, 'qty', matchingRoom.width)} className="w-full text-left px-4 py-2 hover:bg-gray-800 flex justify-between"><span>Width</span><span className="font-bold text-indigo-300">{matchingRoom.width}</span></button>
                                            <button type="button" onClick={() => updateItem(room.id, item.id, 'qty', matchingRoom.height)} className="w-full text-left px-4 py-2 hover:bg-gray-800 flex justify-between"><span>Height</span><span className="font-bold text-indigo-300">{matchingRoom.height}</span></button>
                                            <button type="button" onClick={() => updateItem(room.id, item.id, 'qty', matchingRoom.area)} className="w-full text-left px-4 py-2 hover:bg-gray-800 flex justify-between border-t border-gray-700 mt-1 pt-2"><span>Area</span><span className="font-bold text-green-400">{matchingRoom.area}</span></button>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                                <td className="py-3 px-2 align-top">
                                  <div className="relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-bold">₹</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="w-full bg-gray-50/50 border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 focus:bg-white outline-none transition-all"
                                      value={item.rate}
                                      onChange={e => updateItem(room.id, item.id, 'rate', e.target.value)}
                                    />
                                  </div>
                                </td>
                                <td className="py-3 px-2 align-top text-right pt-4 font-black text-gray-900">
                                  {amount > 0 ? amount.toLocaleString('en-IN') : '--'}
                                </td>
                                <td className="py-3 px-2 align-top text-center pt-3.5">
                                  <button 
                                    onClick={() => removeItem(room.id, item.id)} 
                                    className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors inline-block"
                                    title="Delete Item"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {room.items.length > 0 && (
                    <button 
                      onClick={() => addItem(room.id)}
                      className="flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors mt-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      Add Line Item
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button 
              onClick={addRoom}
              className="w-full py-5 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-bold hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-2"
            >
              <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </div>
              Add Another Room
            </button>
          </div>
        </div>

        {/* Right Column: Client Requirements Reference Panel */}
        <div className="w-full lg:w-[400px] bg-white overflow-y-auto p-6 shrink-0 custom-scrollbar border-t lg:border-t-0 lg:border-r border-gray-200 shadow-lg space-y-6">
          <div>
            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Client Requirements Scope
            </h3>
            
            {/* Active Scope List */}
            <div className="mt-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Active Scope Filter</span>
              <div className="flex flex-wrap gap-2">
                {hasNoScope ? (
                  <Badge variant="secondary">All Product Scopes Active</Badge>
                ) : (
                  scopeList.map(scope => (
                    <Badge key={scope} variant="primary" className="capitalize">{scope}</Badge>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Design Preferences Filtered */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Preferences</h4>
            
            {isKitchenActive && (
              <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 space-y-3">
                <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-sm border-b border-indigo-100 pb-1.5">
                  🍳 Kitchen Specs
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-gray-400 font-semibold">Layout</span>
                    <span className="font-bold text-gray-800">{LAYOUT_LABELS[prefs.kitchen_layout] || prefs.kitchen_layout || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-semibold">Finish</span>
                    <span className="font-bold text-gray-800">{FINISH_LABELS[prefs.kitchen_finish] || prefs.kitchen_finish || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-semibold">Countertop</span>
                    <span className="font-bold text-gray-800">{COUNTERTOP_LABELS[prefs.kitchen_countertop] || prefs.kitchen_countertop || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-semibold">Appliances</span>
                    <span className="font-bold text-gray-800">{APPLIANCE_LABELS[prefs.kitchen_appliances] || prefs.kitchen_appliances || 'Not specified'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-gray-400 font-semibold">Sink Type</span>
                    <span className="font-bold text-gray-800">{prefs.kitchen_sink || 'Not specified'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-gray-400 font-semibold">Hob / Chimney</span>
                    <span className="font-bold text-gray-800">{prefs.kitchen_hob || 'Not specified'}</span>
                  </div>

                  {/* Kitchen Custom Fields */}
                  {prefs.kitchen_custom_fields && prefs.kitchen_custom_fields.length > 0 && (
                    <div className="col-span-2 border-t border-indigo-100/50 pt-2 mt-1 space-y-2">
                      {prefs.kitchen_custom_fields.map((field, idx) => (
                        <div key={field.id || idx}>
                          <span className="block text-gray-400 font-semibold">{field.label}</span>
                          <span className="font-bold text-gray-800">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isWardrobeActive && (
              <div className="bg-teal-50/40 p-4 rounded-xl border border-teal-100 space-y-3">
                <div className="flex items-center gap-2 text-teal-900 font-extrabold text-sm border-b border-teal-100 pb-1.5">
                  👕 Wardrobe Specs
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-gray-400 font-semibold">Type</span>
                    <span className="font-bold text-gray-800">{WARDROBE_LABELS[prefs.wardrobe_type] || prefs.wardrobe_type || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-semibold">Palette</span>
                    <span className="font-bold text-gray-800">{prefs.color_palette || 'Not specified'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-gray-400 font-semibold">Door Finish</span>
                    <span className="font-bold text-gray-800">{prefs.wardrobe_door_material || 'Not specified'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-gray-400 font-semibold">Accessory</span>
                    <span className="font-bold text-gray-800">{ACCESSORY_LABELS[prefs.wardrobe_accessory] || prefs.wardrobe_accessory || 'Not specified'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-gray-400 font-semibold">Loft Configuration</span>
                    <span className="font-bold text-gray-800">{prefs.wardrobe_lofts || 'Not specified'}</span>
                  </div>

                  {/* Wardrobe Custom Fields */}
                  {prefs.wardrobe_custom_fields && prefs.wardrobe_custom_fields.length > 0 && (
                    <div className="col-span-2 border-t border-teal-100/50 pt-2 mt-1 space-y-2">
                      {prefs.wardrobe_custom_fields.map((field, idx) => (
                        <div key={field.id || idx}>
                          <span className="block text-gray-400 font-semibold">{field.label}</span>
                          <span className="font-bold text-gray-800">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isCeilingActive && (
              <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-100 space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm border-b border-amber-100 pb-1.5">
                  💡 False Ceiling Specs
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-gray-400 font-semibold">Style</span>
                    <span className="font-bold text-gray-800">{CEILING_LABELS[prefs.ceiling_style] || prefs.ceiling_style || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-semibold">Primary Light</span>
                    <span className="font-bold text-gray-800">{LIGHTING_LABELS[prefs.lighting_type] || prefs.lighting_type || 'Not specified'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-gray-400 font-semibold">Ambient Accents</span>
                    <span className="font-bold text-gray-800">{prefs.ambient_lighting || 'Not specified'}</span>
                  </div>

                  {/* Ceiling Custom Fields */}
                  {prefs.ceiling_custom_fields && prefs.ceiling_custom_fields.length > 0 && (
                    <div className="col-span-2 border-t border-amber-100/50 pt-2 mt-1 space-y-2">
                      {prefs.ceiling_custom_fields.map((field, idx) => (
                        <div key={field.id || idx}>
                          <span className="block text-gray-400 font-semibold">{field.label}</span>
                          <span className="font-bold text-gray-800">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isFlooringPaintingActive && (
              <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 space-y-3">
                <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm border-b border-emerald-100 pb-1.5">
                  🎨 Flooring & Paint Specs
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-gray-400 font-semibold">Flooring</span>
                    <span className="font-bold text-gray-800">{FLOORING_LABELS[prefs.flooring_type] || prefs.flooring_type || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-semibold">Paint Finish</span>
                    <span className="font-bold text-gray-800">{PAINTING_LABELS[prefs.paint_finish] || prefs.paint_finish || 'Not specified'}</span>
                  </div>

                  {/* Flooring & Painting Custom Fields */}
                  {prefs.flooring_painting_custom_fields && prefs.flooring_painting_custom_fields.length > 0 && (
                    <div className="col-span-2 border-t border-emerald-100/50 pt-2 mt-1 space-y-2">
                      {prefs.flooring_painting_custom_fields.map((field, idx) => (
                        <div key={field.id || idx}>
                          <span className="block text-gray-400 font-semibold">{field.label}</span>
                          <span className="font-bold text-gray-800">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {prefs.custom_sections && prefs.custom_sections.map((section, idx) => (
              <div key={section.id || idx} className="bg-purple-50/40 p-4 rounded-xl border border-purple-100 space-y-3">
                <div className="flex items-center gap-2 text-purple-900 font-extrabold text-sm border-b border-purple-100 pb-1.5 capitalize">
                  ✨ {section.title} Specs
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {section.fields && section.fields.map((field, fIdx) => (
                    <div key={field.id || fIdx} className="col-span-2">
                      <span className="block text-gray-400 font-semibold">{field.label}</span>
                      <span className="font-bold text-gray-800">{field.value || 'Not specified'}</span>
                    </div>
                  ))}
                  {(!section.fields || section.fields.length === 0) && (
                    <div className="col-span-2 text-gray-400 italic">No specifications added.</div>
                  )}
                </div>
              </div>
            ))}


            {prefs.notes && (
              <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100 space-y-1">
                <span className="block text-blue-900 font-extrabold text-xs">Lifestyle Notes</span>
                <p className="text-xs font-semibold text-gray-700 whitespace-pre-wrap">{prefs.notes}</p>
                
                {/* General / Lifestyle Custom Fields */}
                {prefs.lifestyle_custom_fields && prefs.lifestyle_custom_fields.length > 0 && (
                  <div className="border-t border-blue-100/50 pt-2 mt-2 space-y-2">
                    {prefs.lifestyle_custom_fields.map((field, idx) => (
                      <div key={field.id || idx}>
                        <span className="block text-gray-400 font-semibold text-[10px]">{field.label}</span>
                        <span className="font-bold text-gray-800 text-[11px]">{field.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Client Inspirations Filtered */}
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Inspirations ({filteredInspirations.length})</h4>
            
            {loadingInspirations ? (
              <div className="text-xs text-gray-400 italic">Loading inspirations...</div>
            ) : filteredInspirations.length === 0 ? (
              <div className="text-xs text-gray-400 italic">No inspirations match this active scope.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredInspirations.map(insp => (
                  <div 
                    key={insp.id} 
                    className="border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-400 hover:shadow transition-all group relative bg-gray-50"
                    onClick={() => setPreviewImage(insp)}
                  >
                    <img 
                      src={insp.image_url} 
                      alt={insp.room_type || 'Inspiration'} 
                      className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="p-2 text-[10px] text-gray-600 bg-white border-t border-gray-100 truncate">
                      <span className="font-bold block text-gray-900 truncate">{insp.room_type || 'General'}</span>
                      {insp.notes && <span className="text-[9px] text-gray-400 block truncate">{insp.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Modal / Lightbox */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-[110] bg-slate-900/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-gray-900/60 hover:bg-gray-900 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg transition-colors font-bold z-10"
            >
              &times;
            </button>
            <img 
              src={previewImage.image_url} 
              alt={previewImage.room_type || 'Preview'} 
              className="w-full max-h-[70vh] object-contain bg-slate-950"
            />
            <div className="p-5 border-t border-gray-150">
              <Badge variant="primary" className="capitalize mb-2">{previewImage.room_type}</Badge>
              <h4 className="font-bold text-gray-900 text-base">{previewImage.room_type || 'Design Inspiration'}</h4>
              {previewImage.notes && <p className="text-sm text-gray-600 mt-2 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100">{previewImage.notes}</p>}
            </div>
          </div>
        </div>
      )}
    </div>,
    portalRoot
  );
}
