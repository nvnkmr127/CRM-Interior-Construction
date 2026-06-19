import { useState, useEffect, useRef } from 'react'
import styles from './HandoverChecklist.module.css'
import { Badge, Button, Modal } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import { getHandoverChecklist, createHandoverChecklist, addHandoverItem, updateHandoverItem, signOffHandoverChecklist } from '../../api/handover'

export default function HandoverChecklist({ projectId }) {
  const [checklist, setChecklist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [collapsedRooms, setCollapsedRooms] = useState(new Set())
  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false)
  const [newItemText, setNewItemText] = useState({})
  const [newRoomText, setNewRoomText] = useState('')
  const [uploadingItem, setUploadingItem] = useState(null)
  const fileInputRef = useRef(null)
  const toast = useToast()

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    getHandoverChecklist(projectId)
      .then(res => {
        const raw = res.data?.data || res.data
        if (!raw) { setChecklist(null); return }
        // Normalize server data to component's expected shape
        const rooms = (raw.rooms || raw.items || [])
        const normalized = {
          id: raw.id,
          status: raw.status || 'in_progress',
          signedOffAt: raw.signed_off_at || raw.signedOffAt || null,
          rooms: Array.isArray(rooms) ? rooms.map(r => ({
            id: r.id,
            name: r.room || r.name,
            items: (r.items || []).map(i => ({
              id: i.id,
              desc: i.description || i.desc,
              isChecked: i.is_checked || i.isChecked || false,
              checkedBy: i.checked_by || i.checkedBy || null,
              checkedAt: i.checked_at || i.checkedAt || null,
              photoKey: i.photo_key || i.photoKey || null,
            }))
          })) : [],
        }
        setChecklist(normalized)
      })
      .catch(err => {
        if (err?.response?.status === 404) setChecklist(null)
        else setChecklist(null)
      })
      .finally(() => setLoading(false))
  }, [projectId])

  const createChecklist = async () => {
    setLoading(true)
    try {
      const res = await createHandoverChecklist(projectId)
      const raw = res.data?.data || res.data
      setChecklist({ id: raw?.id || '1', status: 'in_progress', signedOffAt: null, rooms: [] })
    } catch {
      toast.error('Failed to create checklist')
    } finally {
      setLoading(false)
    }
  }

  const toggleRoom = (roomId) => {
    const next = new Set(collapsedRooms)
    if (next.has(roomId)) next.delete(roomId)
    else next.add(roomId)
    setCollapsedRooms(next)
  }

  const toggleItem = async (roomId, itemId) => {
    if (checklist.status === 'signed_off') return
    
    // Optimistic Update
    const oldChecklist = checklist;
    let isCheckedNew = false;
    
    const newRooms = checklist.rooms.map(r => {
      if (r.id !== roomId) return r
      return {
        ...r,
        items: r.items.map(i => {
          if (i.id !== itemId) return i
          const isChecked = !i.isChecked
          isCheckedNew = isChecked;
          return { ...i, isChecked, checkedBy: isChecked ? 'You' : null, checkedAt: isChecked ? new Date().toISOString() : null }
        })
      }
    })
    setChecklist({ ...checklist, rooms: newRooms })
    
    try {
      await updateHandoverItem(itemId, { checklistId: checklist.id, is_checked: isCheckedNew })
    } catch {
      toast.error('Failed to update item status')
      setChecklist(oldChecklist)
    }
  }

  const handlePhotoUpload = async (roomId, itemId, e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingItem(itemId)
    
    // In production, we'd upload to S3 first. 
    // Here we simulate the successful upload by updating the item with a mock storage key.
    const mockStorageKey = `handover/photos/${Date.now()}-${file.name}`
    
    try {
      await updateHandoverItem(itemId, { checklistId: checklist.id, photo_key: mockStorageKey })
      const newRooms = checklist.rooms.map(r => {
        if (r.id !== roomId) return r
        return {
          ...r,
          items: r.items.map(i => i.id === itemId ? { ...i, photoKey: mockStorageKey } : i)
        }
      })
      setChecklist({ ...checklist, rooms: newRooms })
      toast.success('Photo uploaded successfully')
    } catch {
      toast.error('Failed to upload photo')
    } finally {
      setUploadingItem(null)
    }
  }

  const triggerFileInput = (roomId, itemId) => {
    if (checklist.status === 'signed_off') return
    const input = document.getElementById(`file-${itemId}`)
    if (input) input.click()
  }

  const addItem = (e, roomId) => {
    if (e.key === 'Enter' && newItemText[roomId]?.trim()) {
      const newRooms = checklist.rooms.map(r => {
        if (r.id !== roomId) return r
        return {
          ...r,
          items: [...r.items, { id: Date.now().toString(), desc: newItemText[roomId].trim(), isChecked: false, photoKey: null }]
        }
      })
      setChecklist({ ...checklist, rooms: newRooms })
      setNewItemText({ ...newItemText, [roomId]: '' })
    }
  }

  const addRoom = (e) => {
    if (e.key === 'Enter' && newRoomText.trim()) {
      setChecklist({
        ...checklist,
        rooms: [...checklist.rooms, { id: Date.now().toString(), name: newRoomText.trim(), items: [] }]
      })
      setNewRoomText('')
    }
  }

  const handleSignOff = async () => {
    setIsSignOffModalOpen(false)
    try {
      await signOffHandoverChecklist(checklist.id)
      setChecklist({ ...checklist, status: 'signed_off', signedOffAt: new Date().toISOString() })
      toast.success('Checklist sent for client sign-off')
    } catch {
      toast.error('Failed to initiate sign-off')
    }
  }

  if (loading) return <div style={{padding:'32px', color:'var(--color-text-muted)'}}>Loading checklist...</div>

  if (!checklist) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>☑</div>
          <h2 style={{fontSize:'var(--text-xl)', color:'var(--color-text)', marginBottom:8}}>No handover checklist yet</h2>
          <p style={{marginBottom: 24}}>Create a checklist to document the project handover room by room.</p>
          <Button variant="primary" onClick={createChecklist}>Create Checklist</Button>
        </div>
      </div>
    )
  }

  const totalItems = checklist.rooms.reduce((acc, r) => acc + r.items.length, 0)
  const checkedItems = checklist.rooms.reduce((acc, r) => acc + r.items.filter(i => i.isChecked).length, 0)
  const progressPercent = totalItems === 0 ? 0 : (checkedItems / totalItems) * 100
  const isAllChecked = totalItems > 0 && checkedItems === totalItems
  const isReadOnly = checklist.status === 'signed_off'

  return (
    <div className={styles.page}>
      {isReadOnly && (
        <div className={styles.readOnlyBanner}>
          <span style={{fontSize:20}}>✓</span>
          Signed off by client on {new Date(checklist.signedOffAt).toLocaleDateString()}
        </div>
      )}

      <div className={styles.headerRow}>
        <div className={styles.statusCol}>
          <Badge variant={isReadOnly ? 'success' : 'warning'}>
            {isReadOnly ? 'Signed Off' : 'In Progress'}
          </Badge>
          <div className={styles.progressText}>{checkedItems} of {totalItems} items checked</div>
          <div className={styles.progressBg}>
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        
        {!isReadOnly && (
          <Button 
            variant="primary" 
            disabled={!isAllChecked}
            onClick={() => setIsSignOffModalOpen(true)}
            title={!isAllChecked ? 'Check all items before sending for sign-off' : ''}
          >
            Send for Client Sign-Off
          </Button>
        )}
      </div>

      <div>
        {checklist.rooms.map(room => (
          <div key={room.id} className={styles.roomSection}>
            <div className={styles.roomHeader} onClick={() => toggleRoom(room.id)}>
              <div className={styles.roomTitle}>
                {room.name}
                <Badge variant="neutral">{room.items.length} items</Badge>
              </div>
              <div className={`${styles.chevron} ${collapsedRooms.has(room.id) ? styles.collapsed : ''}`}>▼</div>
            </div>

            {!collapsedRooms.has(room.id) && (
              <div className={styles.itemsList}>
                {room.items.map(item => (
                  <div key={item.id} className={`${styles.itemRow} ${item.isChecked ? styles.checked : ''}`}>
                    <div className={styles.checkboxWrapper}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={item.isChecked}
                        onChange={() => toggleItem(room.id, item.id)}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div className={styles.itemContent}>
                      <div className={`${styles.itemDesc} ${item.isChecked ? styles.checked : ''}`}>
                        {item.desc}
                      </div>
                      {item.isChecked && item.checkedBy && (
                        <div className={styles.itemMeta}>
                          ✓ Checked by {item.checkedBy} · {new Date(item.checkedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className={styles.photoSlot}>
                      <input 
                        type="file" 
                        id={`file-${item.id}`} 
                        style={{display:'none'}} 
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(room.id, item.id, e)}
                        disabled={isReadOnly}
                      />
                      {uploadingItem === item.id ? (
                        <div className={styles.uploadProgress}>Uploading...</div>
                      ) : item.photoKey ? (
                        <img 
                          src="/placeholder.jpg" 
                          className={styles.photoThumb} 
                          alt="Thumbnail" 
                          onClick={() => window.open(item.photoKey, '_blank')}
                        />
                      ) : (
                        <div className={styles.photoEmpty} onClick={() => triggerFileInput(room.id, item.id)}>
                          + Photo
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {!isReadOnly && (
                  <div className={styles.addItemRow}>
                    <input 
                      className={styles.addItemInput} 
                      placeholder="+ Add item (press Enter)"
                      value={newItemText[room.id] || ''}
                      onChange={e => setNewItemText({...newItemText, [room.id]: e.target.value})}
                      onKeyDown={(e) => addItem(e, room.id)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {!isReadOnly && (
          <input 
            className={styles.addRoomInput} 
            placeholder="+ Add a new room (press Enter)"
            value={newRoomText}
            onChange={e => setNewRoomText(e.target.value)}
            onKeyDown={addRoom}
          />
        )}
      </div>

      <Modal
        isOpen={isSignOffModalOpen}
        onClose={() => setIsSignOffModalOpen(false)}
        title="Send for Sign-Off"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsSignOffModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSignOff}>Confirm & Send</Button>
          </>
        }
      >
        <p>This will notify the client via their portal. Once signed, the checklist is locked and cannot be modified.</p>
      </Modal>
    </div>
  )
}
