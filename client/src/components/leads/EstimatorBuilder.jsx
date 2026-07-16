/* eslint-disable no-unused-vars, react-hooks/purity */
import React, { useState, useEffect } from 'react';
import { Button } from '../ui';
import { useToast } from '../../store/toastContext';
import { createEstimate } from '../../api/leads';
import api from '../../api/axios';

export default function EstimatorBuilder({ leadId, onSaved, onCancel }) {
  const toast = useToast();
  const [rooms, setRooms] = useState([
    { id: Date.now(), name: 'Master Bedroom', items: [] }
  ]);
  const [measurements, setMeasurements] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (leadId) {
      api.get(`/leads/${leadId}/measurements`)
        .then(res => {
          if (res.data && res.data.success && Array.isArray(res.data.data)) {
            setMeasurements(res.data.data);
          }
        })
        .catch(err => console.error('Failed to load lead measurements in EstimatorBuilder:', err));
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
      const payload = { rooms };
      await createEstimate(leadId, payload);
      toast.success('Estimate created successfully');
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error('Failed to create estimate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 h-screen w-screen overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Native Estimator Builder</h2>
          <p className="text-sm text-gray-500">Build your BOQ below</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-lg font-bold text-gray-800">
            Total: ₹{calculateTotal().toLocaleString('en-IN')}
          </div>
          <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Estimate'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {rooms.map((room, rIndex) => (
            <div key={room.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={room.name}
                    onChange={(e) => updateRoomName(room.id, e.target.value)}
                    className="bg-transparent font-bold text-gray-800 focus:outline-none focus:border-b border-blue-500"
                    placeholder="Room Name"
                  />
                  {measurements && measurements.length > 0 && (
                    <select
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          updateRoomName(room.id, val);
                        }
                      }}
                      value={measurements.some(m => m.room_name === room.name) ? room.name : ''}
                      className="bg-white border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-700 focus:outline-none"
                    >
                      <option value="">-- Match Room Measurement --</option>
                      {measurements.map(m => (
                        <option key={m.id} value={m.room_name}>{m.room_name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <button onClick={() => removeRoom(room.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove Room</button>
              </div>

              <div className="p-4">
                {room.items.length === 0 ? (
                  <p className="text-sm text-gray-500 italic mb-4">No items added to this room yet.</p>
                ) : (
                  <table className="w-full text-left text-sm mb-4 border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-2 font-semibold text-gray-600">Description</th>
                        <th className="pb-2 font-semibold text-gray-600 w-24">Qty</th>
                        <th className="pb-2 font-semibold text-gray-600 w-32">Rate (₹)</th>
                        <th className="pb-2 font-semibold text-gray-600 w-32">Amount (₹)</th>
                        <th className="pb-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {room.items.map(item => {
                        const amount = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                        return (
                          <tr key={item.id} className="border-b border-gray-100 last:border-0">
                            <td className="py-2 pr-2">
                              <input
                                type="text"
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                                value={item.description}
                                onChange={e => updateItem(room.id, item.id, 'description', e.target.value)}
                                placeholder="e.g. Wardrobe in laminate finish"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                                  value={item.qty}
                                  onChange={e => updateItem(room.id, item.id, 'qty', e.target.value)}
                                />
                                {(() => {
                                  const matchingRoom = measurements.find(m => m.room_name.toLowerCase() === room.name.toLowerCase());
                                  if (!matchingRoom) return null;
                                  return (
                                    <div className="relative group">
                                      <button 
                                        type="button"
                                        className="px-1.5 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200 cursor-pointer font-medium"
                                        title="Use room dimension"
                                      >
                                        📐
                                      </button>
                                      <div className="absolute left-0 mt-1 hidden group-hover:block bg-white border border-gray-200 rounded shadow-md z-10 py-1 min-w-[120px]">
                                        <div className="px-2 py-1 text-[10px] text-gray-400 font-bold border-b border-gray-100">INSERT DIMENSION</div>
                                        <button 
                                          type="button"
                                          onClick={() => updateItem(room.id, item.id, 'qty', matchingRoom.length)}
                                          className="w-full text-left px-3 py-1 hover:bg-gray-100 text-xs text-gray-700 flex justify-between"
                                        >
                                          <span>Length</span>
                                          <span className="font-semibold text-gray-500">{matchingRoom.length}</span>
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => updateItem(room.id, item.id, 'qty', matchingRoom.width)}
                                          className="w-full text-left px-3 py-1 hover:bg-gray-100 text-xs text-gray-700 flex justify-between"
                                        >
                                          <span>Width</span>
                                          <span className="font-semibold text-gray-500">{matchingRoom.width}</span>
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => updateItem(room.id, item.id, 'qty', matchingRoom.height)}
                                          className="w-full text-left px-3 py-1 hover:bg-gray-100 text-xs text-gray-700 flex justify-between"
                                        >
                                          <span>Height</span>
                                          <span className="font-semibold text-gray-500">{matchingRoom.height}</span>
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => updateItem(room.id, item.id, 'qty', matchingRoom.area)}
                                          className="w-full text-left px-3 py-1 hover:bg-gray-100 text-xs text-gray-700 flex justify-between border-t border-gray-100"
                                        >
                                          <span>Area</span>
                                          <span className="font-semibold text-gray-500">{matchingRoom.area}</span>
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                min="0"
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                                value={item.rate}
                                onChange={e => updateItem(room.id, item.id, 'rate', e.target.value)}
                              />
                            </td>
                            <td className="py-2 font-medium text-gray-800">
                              {amount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 text-right">
                              <button onClick={() => removeItem(room.id, item.id)} className="text-gray-400 hover:text-red-500 font-bold">&times;</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                <Button variant="outline" size="sm" onClick={() => addItem(room.id)}>
                  + Add Item
                </Button>
              </div>
            </div>
          ))}

          <Button variant="outline" className="w-full py-3 border-dashed border-2 text-gray-500 hover:text-blue-600 hover:border-blue-300" onClick={addRoom}>
            + Add Another Room
          </Button>
        </div>
      </div>
    </div>
  );
}
