import React, { useState, useEffect } from 'react';
import { getHandoverChecklist, createHandoverChecklist, addHandoverItem, updateHandoverItem, signOffHandoverChecklist } from '../../api/handover';
import { Badge, Button, Spinner } from '../../components/ui';

export default function HandoverChecklist({ projectId }) {
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [addingToRoom, setAddingToRoom] = useState(null);
  const [newItemDesc, setNewItemDesc] = useState('');

  const [addingRoom, setAddingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  const fetchChecklist = async () => {
    setLoading(true);
    try {
      const res = await getHandoverChecklist(projectId);
      setChecklist(res.data?.data || res.data);
    } catch (e) {
      if (e.response?.status === 404) {
        setChecklist(null);
      } else {
        console.error('Failed to fetch checklist', e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchChecklist();
  }, [projectId]);

  const handleCreateChecklist = async () => {
    try {
      await createHandoverChecklist(projectId);
      fetchChecklist();
    } catch (e) {
      console.error(e);
      alert('Error creating checklist');
    }
  };

  const handleToggleItem = async (item) => {
    try {
      const updatedItems = checklist.items.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i);
      setChecklist({ ...checklist, items: updatedItems });
      await updateHandoverItem(item.id, { checklistId: checklist.id, is_checked: !item.is_checked });
      // Soft fetch to get updated timestamps
      const res = await getHandoverChecklist(projectId);
      setChecklist(res.data?.data || res.data);
    } catch (e) {
      console.error(e);
      fetchChecklist();
    }
  };

  const handleAddItem = async (room) => {
    if (!newItemDesc) return;
    try {
      await addHandoverItem(projectId, { checklistId: checklist.id, room, description: newItemDesc });
      setAddingToRoom(null);
      setNewItemDesc('');
      fetchChecklist();
    } catch (e) {
      console.error(e);
      alert('Failed to add item');
    }
  };

  const handleAddRoom = async () => {
    if (!newRoomName || !newItemDesc) return alert('Room name and description are required.');
    try {
      await addHandoverItem(projectId, { checklistId: checklist.id, room: newRoomName, description: newItemDesc });
      setAddingRoom(false);
      setNewRoomName('');
      setNewItemDesc('');
      fetchChecklist();
    } catch (e) {
      console.error(e);
      alert('Failed to add room');
    }
  };

  const handleSignOff = async () => {
    if (!window.confirm('Send to client for final sign-off?')) return;
    try {
      await signOffHandoverChecklist(checklist.id);
      fetchChecklist();
      alert('Sent for client sign-off successfully!');
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || 'Failed to send sign-off');
    }
  };

  const handlePhotoUpload = async (item) => {
    alert(`Mocking Photo Upload for: ${item.description}`);
    try {
      await updateHandoverItem(item.id, { checklistId: checklist.id, photo_key: 'mock_s3_key_' + Date.now() + '.jpg' });
      fetchChecklist();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;
  }

  if (!checklist) {
    return (
      <div className="text-center py-24 bg-slate-800/40 rounded-xl border border-slate-700/50 shadow-inner animate-in fade-in">
        <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center mx-auto mb-5 text-2xl shadow-lg">📋</div>
        <h3 className="text-xl font-bold text-white mb-3">No handover checklist yet</h3>
        <p className="text-slate-400 mb-8 max-w-sm mx-auto text-sm leading-relaxed">Create a standardized checklist based on the project type to ensure a smooth handover process.</p>
        <Button onClick={handleCreateChecklist} variant="primary" className="shadow-lg shadow-blue-500/20">Create Checklist</Button>
      </div>
    );
  }

  const rooms = checklist.items.reduce((acc, item) => {
    if (!acc[item.room]) acc[item.room] = [];
    acc[item.room].push(item);
    return acc;
  }, {});

  const totalItems = checklist.items.length;
  const checkedItems = checklist.items.filter(i => i.is_checked).length;
  const progressPct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
  const isAllChecked = totalItems > 0 && checkedItems === totalItems;
  const isSignedOff = checklist.status === 'signed_off';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1 w-full">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                Checklist Progress
                {isSignedOff && <Badge variant="success">Signed Off</Badge>}
              </h3>
              <p className="text-slate-400 text-sm mt-1">{checkedItems} of {totalItems} items checked</p>
            </div>
            <p className="text-xl font-black text-blue-400">{progressPct}%</p>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-3 shadow-inner">
            <div className="bg-blue-500 h-3 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        
        <div className="shrink-0">
          <Button 
            variant={isAllChecked && !isSignedOff ? "success" : "outline"} 
            disabled={!isAllChecked || isSignedOff}
            onClick={handleSignOff}
            className="w-full md:w-auto"
          >
            {isSignedOff ? 'Client Signed Off' : 'Send for Client Sign-Off'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(rooms).map(([room, items]) => (
          <div key={room} className="bg-slate-800/80 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
            <div className="bg-slate-900/60 px-5 py-3 border-b border-slate-700 flex justify-between items-center">
              <h4 className="text-white font-bold tracking-wide">{room}</h4>
              <Badge variant="neutral">{items.filter(i => i.is_checked).length} / {items.length}</Badge>
            </div>
            
            <div className="divide-y divide-slate-700/50">
              {items.map(item => (
                <div key={item.id} className={`p-4 flex items-start gap-4 transition-colors ${item.is_checked ? 'bg-green-900/10' : 'hover:bg-slate-700/30'}`}>
                  <div className="pt-0.5 shrink-0">
                    <button 
                      onClick={() => !isSignedOff && handleToggleItem(item)}
                      disabled={isSignedOff}
                      className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${item.is_checked ? 'bg-green-500 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-slate-900 border-slate-600 hover:border-blue-500'}`}
                    >
                      {item.is_checked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm ${item.is_checked ? 'text-slate-300 line-through opacity-70' : 'text-white font-medium'}`}>
                      {item.description}
                    </p>
                    {item.is_checked && item.checked_at && (
                      <p className="text-[11px] text-green-400/80 mt-1.5 font-medium">Checked {new Date(item.checked_at).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    {item.photo_key ? (
                      <div className="w-10 h-10 rounded border border-slate-600 bg-slate-900 flex items-center justify-center overflow-hidden cursor-pointer hover:border-slate-400 transition-colors">
                        <span className="text-xs">📸</span>
                      </div>
                    ) : (
                      !isSignedOff && (
                        <button onClick={() => handlePhotoUpload(item)} className="text-slate-500 hover:text-blue-400 p-2 transition-colors text-sm font-medium flex items-center gap-1.5 bg-slate-800 rounded border border-slate-700 hover:border-blue-500/50">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                          Upload
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}

              {/* Add Item to Room Form */}
              {!isSignedOff && (
                <div className="p-4 bg-slate-800/40">
                  {addingToRoom === room ? (
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        autoFocus
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors"
                        placeholder="Item description..."
                        value={newItemDesc}
                        onChange={e => setNewItemDesc(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddItem(room)}
                      />
                      <Button variant="success" size="sm" onClick={() => handleAddItem(room)}>Save</Button>
                      <Button variant="outline" size="sm" onClick={() => { setAddingToRoom(null); setNewItemDesc(''); }}>Cancel</Button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingToRoom(room)} className="text-sm text-slate-400 hover:text-white font-medium flex items-center gap-1.5 transition-colors">
                      <span className="text-lg leading-none">+</span> Add item to {room}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {!isSignedOff && (
          <div className="border border-dashed border-slate-600 rounded-xl p-4 bg-slate-800/30">
            {addingRoom ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-48">
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Room Name</label>
                  <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="e.g. Balcony" autoFocus />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">First Item</label>
                  <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500" value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} placeholder="Description..." onKeyDown={e => e.key === 'Enter' && handleAddRoom()} />
                </div>
                <div className="flex gap-2">
                  <Button variant="success" size="sm" className="h-[38px]" onClick={handleAddRoom}>Add Room</Button>
                  <Button variant="outline" size="sm" className="h-[38px]" onClick={() => { setAddingRoom(false); setNewRoomName(''); setNewItemDesc(''); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingRoom(true)} className="w-full text-center py-2 text-sm text-slate-400 hover:text-white font-medium flex items-center justify-center gap-2 transition-colors">
                <span className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-lg leading-none pb-0.5">+</span> Add New Room
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
