import { useState, useEffect, useRef } from 'react'
import styles from './HandoverChecklist.module.css'
import { Badge, Button, Modal } from '../../components/ui'
import { useToast } from '../../store/toastContext'

export default function HandoverChecklist() {
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
    // Mock Fetch
    setTimeout(() => {
      // Simulate checklist exists
      setChecklist({
        id: '1',
        status: 'in_progress', // or 'signed_off'
        signedOffAt: null,
        rooms: [
          {
            id: 'r1', name: 'Master Bedroom',
            items: [
              { id: 'i1', desc: 'Wardrobe sliding doors move smoothly', isChecked: true, checkedBy: 'Priya', checkedAt: new Date(Date.now()-3600000).toISOString(), photoKey: '/wardrobe.jpg' },
              { id: 'i2', desc: 'All electrical points working', isChecked: false, checkedBy: null, checkedAt: null, photoKey: null },
            ]
          },
          {
            id: 'r2', name: 'Living Room',
            items: [
              { id: 'i3', desc: 'TV unit polished and scratch-free', isChecked: false, checkedBy: null, checkedAt: null, photoKey: null },
            ]
          }
        ]
      })
      setLoading(false)
    }, 600)
  }, [])

  const createChecklist = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    setChecklist({ id: '1', status: 'in_progress', signedOffAt: null, rooms: [] })
    setLoading(false)
  }

  const toggleRoom = (roomId) => {
    const next = new Set(collapsedRooms)
    if (next.has(roomId)) next.delete(roomId)
    else next.add(roomId)
    setCollapsedRooms(next)
  }

  const toggleItem = (roomId, itemId) => {
    if (checklist.status === 'signed_off') return
    const newRooms = checklist.rooms.map(r => {
      if (r.id !== roomId) return r
      return {
        ...r,
        items: r.items.map(i => {
          if (i.id !== itemId) return i
          const isChecked = !i.isChecked
          return { ...i, isChecked, checkedBy: isChecked ? 'You' : null, checkedAt: isChecked ? new Date().toISOString() : null }
        })
      }
    })
    setChecklist({ ...checklist, rooms: newRooms })
  }

  const handlePhotoUpload = (roomId, itemId, e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingItem(itemId)
    // Mock upload
    setTimeout(() => {
      const newRooms = checklist.rooms.map(r => {
        if (r.id !== roomId) return r
        return {
          ...r,
          items: r.items.map(i => i.id === itemId ? { ...i, photoKey: '/mock-uploaded.jpg' } : i)
        }
      })
      setChecklist({ ...checklist, rooms: newRooms })
      setUploadingItem(null)
      toast.success('Photo uploaded')
    }, 1500)
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
    toast.success('Sent OTP to client portal for sign-off.')
    // Mock successful sign off after a short delay
    setTimeout(() => {
      setChecklist({ ...checklist, status: 'signed_off', signedOffAt: new Date().toISOString() })
      toast.success('Client has signed off the checklist!')
    }, 2000)
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
