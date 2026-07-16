/* eslint-disable no-unused-vars, react-hooks/purity */
import React, { useState } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function RequirementsWorkshop({ leadId, lead, onUpdate }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Initialize from lead custom_fields or default to empty array
  const initialRooms = lead?.custom_fields?.room_requirements || [];
  const [rooms, setRooms] = useState(initialRooms);

  const [newRoom, setNewRoom] = useState({
    name: '',
    type: 'Bedroom',
    budget: '',
    materialPreference: 'Laminate',
    priority: 'Medium',
    notes: ''
  });

  const [isAdding, setIsAdding] = useState(false);

  const handleAddRoom = () => {
    if (!newRoom.name) {
      toast.error('Room name is required');
      return;
    }
    const updatedRooms = [...rooms, { ...newRoom, id: Date.now() }];
    setRooms(updatedRooms);
    saveRequirements(updatedRooms);
    
    // Reset form
    setNewRoom({
      name: '',
      type: 'Bedroom',
      budget: '',
      materialPreference: 'Laminate',
      priority: 'Medium',
      notes: ''
    });
    setIsAdding(false);
  };

  const removeRoom = (id) => {
    const updatedRooms = rooms.filter(r => r.id !== id);
    setRooms(updatedRooms);
    saveRequirements(updatedRooms);
  };

  const saveRequirements = async (updatedRooms) => {
    setLoading(true);
    try {
      const res = await api.patch(`/leads/${leadId}/requirements`, {
        room_requirements: updatedRooms
      });
      if (res.data.success) {
        toast.success('Requirements saved');
        if (onUpdate) onUpdate();
      }
    } catch (e) {
      toast.error('Failed to save requirements');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getTotalBudget = () => {
    return rooms.reduce((acc, r) => acc + (parseFloat(r.budget) || 0), 0);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Requirements Workshop</h3>
          <p className="text-sm text-gray-500">Capture detailed scope room-by-room.</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-500">Estimated Scope Budget</div>
          <div className="text-xl font-bold text-indigo-700">₹{getTotalBudget().toLocaleString()}</div>
        </div>
      </div>

      <div className="space-y-4">
        {rooms.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300">
            No rooms added yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => (
              <div key={room.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 relative group">
                <button 
                  onClick={() => removeRoom(room.id)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded">{room.type}</span>
                  <span className={`text-[10px] font-bold uppercase ${
                    room.priority === 'High' ? 'text-red-600' : room.priority === 'Medium' ? 'text-yellow-600' : 'text-green-600'
                  }`}>{room.priority} Priority</span>
                </div>
                <h4 className="font-bold text-gray-900 text-lg">{room.name}</h4>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Budget:</span>
                    <span className="font-medium text-gray-900">₹{room.budget ? Number(room.budget).toLocaleString() : 'TBD'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Material:</span>
                    <span className="font-medium text-gray-900">{room.materialPreference}</span>
                  </div>
                </div>
                {room.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 italic">
                    "{room.notes}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!isAdding ? (
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Room to Scope
          </button>
        ) : (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mt-4">
            <h4 className="font-semibold text-gray-800 mb-3">Add New Room</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Room Name</label>
                <input 
                  type="text" 
                  value={newRoom.name}
                  onChange={e => setNewRoom({...newRoom, name: e.target.value})}
                  className="w-full text-sm border-gray-300 rounded p-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Master Bedroom"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Room Type</label>
                <select 
                  value={newRoom.type}
                  onChange={e => setNewRoom({...newRoom, type: e.target.value})}
                  className="w-full text-sm border-gray-300 rounded p-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="Bedroom">Bedroom</option>
                  <option value="Kitchen">Kitchen</option>
                  <option value="Living Room">Living Room</option>
                  <option value="Bathroom">Bathroom</option>
                  <option value="Balcony">Balcony</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Budget (₹)</label>
                <input 
                  type="number" 
                  value={newRoom.budget}
                  onChange={e => setNewRoom({...newRoom, budget: e.target.value})}
                  className="w-full text-sm border-gray-300 rounded p-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., 200000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Material Preference</label>
                <select 
                  value={newRoom.materialPreference}
                  onChange={e => setNewRoom({...newRoom, materialPreference: e.target.value})}
                  className="w-full text-sm border-gray-300 rounded p-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="Laminate">Laminate</option>
                  <option value="Acrylic">Acrylic</option>
                  <option value="Veneer">Veneer</option>
                  <option value="PU">PU Paint</option>
                  <option value="Solid Wood">Solid Wood</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                <select 
                  value={newRoom.priority}
                  onChange={e => setNewRoom({...newRoom, priority: e.target.value})}
                  className="w-full text-sm border-gray-300 rounded p-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="High">Must Have</option>
                  <option value="Medium">Nice to Have</option>
                  <option value="Low">Future Upgrade</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Specific Notes</label>
                <input 
                  type="text" 
                  value={newRoom.notes}
                  onChange={e => setNewRoom({...newRoom, notes: e.target.value})}
                  className="w-full text-sm border-gray-300 rounded p-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Needs a walk-in wardrobe"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button 
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddRoom}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                {loading ? 'Saving...' : 'Save Room'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
