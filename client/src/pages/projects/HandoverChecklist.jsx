/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from 'react'
import styles from './HandoverChecklist.module.css'
import { Badge, Button, Modal } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import { getHandoverChecklist, createHandoverChecklist, addHandoverItem, updateHandoverItem, signOffHandoverChecklist, getRoomHandovers, signOffRoomHandover } from '../../api/handover'
export default function HandoverChecklist({ projectId }) {
  const [checklist, setChecklist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [collapsedRooms, setCollapsedRooms] = useState(new Set())
  const [isSignOffModalOpen, setIsSignOffModalOpen] = useState(false)
  const [newItemText, setNewItemText] = useState({})
  const [newRoomText, setNewRoomText] = useState('')
  const [uploadingItem, setUploadingItem] = useState(null)
  const [roomSignOffModal, setRoomSignOffModal] = useState({ isOpen: false, roomId: null, clientName: '', otp: '1234' })
  const fileInputRef = useRef(null)
  const toast = useToast()

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    Promise.all([
      getHandoverChecklist(projectId).catch(e => {
        if (e?.response?.status === 404) return null
        throw e
      }),
      getRoomHandovers(projectId).catch(() => [])
    ])
      .then(([raw, roomHandoversRaw]) => {
        if (!raw) { setChecklist(null); return }
        
        const roomHandovers = Array.isArray(roomHandoversRaw) ? roomHandoversRaw : []
        const roomStatusMap = {}
        roomHandovers.forEach(rh => {
          roomStatusMap[rh.room] = rh
        })

        const rawItems = raw.items || []
        const roomMap = {}
        rawItems.forEach(i => {
          const roomName = i.room || 'General'
          if (!roomMap[roomName]) {
            roomMap[roomName] = {
              id: roomName,
              name: roomName,
              items: [],
              isSignedOff: roomStatusMap[roomName]?.status === 'signed_off',
              signedOffAt: roomStatusMap[roomName]?.signedOffAt || null,
              clientName: roomStatusMap[roomName]?.clientName || null
            }
          }
          roomMap[roomName].items.push({
            id: i.id,
            desc: i.description || i.desc,
            isChecked: i.is_checked || i.isChecked || false,
            checkedBy: i.checked_by || i.checkedBy || null,
            checkedAt: i.checked_at || i.checkedAt || null,
            photoKey: i.photo_key || i.photoKey || null,
            itemType: i.item_type || 'inspection',
            serialNumber: i.serial_number || '',
            warrantyExpiryDate: i.warranty_expiry_date || '',
            hasManual: i.has_manual || false,
            hasWarrantyCard: i.has_warranty_card || false,
            hasBrandRegistrationCard: i.has_brand_registration_card || false,
            keyDetails: i.key_details || ''
          })
        })

        const normalized = {
          id: raw.id,
          status: raw.status || 'in_progress',
          signedOffAt: raw.signed_off_at || raw.signedOffAt || null,
          rooms: Object.values(roomMap)
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

  const handleUpdateDocFields = async (itemId, fields) => {
    const newRooms = checklist.rooms.map(r => ({
      ...r,
      items: r.items.map(i => {
        if (i.id !== itemId) return i
        return {
          ...i,
          serialNumber: fields.serial_number !== undefined ? fields.serial_number : i.serialNumber,
          warrantyExpiryDate: fields.warranty_expiry_date !== undefined ? fields.warranty_expiry_date : i.warrantyExpiryDate,
          hasManual: fields.has_manual !== undefined ? fields.has_manual : i.hasManual,
          hasWarrantyCard: fields.has_warranty_card !== undefined ? fields.has_warranty_card : i.hasWarrantyCard,
          hasBrandRegistrationCard: fields.has_brand_registration_card !== undefined ? fields.has_brand_registration_card : i.hasBrandRegistrationCard,
          keyDetails: fields.key_details !== undefined ? fields.key_details : i.keyDetails
        }
      })
    }))
    setChecklist({ ...checklist, rooms: newRooms })

    try {
      await updateHandoverItem(itemId, { checklistId: checklist.id, ...fields })
    } catch {
      toast.error('Failed to update product details')
    }
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
      toast.success('Project handover finalized successfully')
    } catch {
      toast.error('Failed to finalize project handover')
    }
  }

  const handleRoomSignOff = async () => {
    const { roomId, clientName, otp } = roomSignOffModal
    if (!clientName.trim() || !otp.trim()) {
      toast.error('Client name and OTP are required')
      return
    }

    try {
      await signOffRoomHandover(projectId, { 
        checklistId: checklist.id,
        roomName: roomId,
        clientName,
        otp
      })
      
      const newRooms = checklist.rooms.map(r => {
        if (r.id !== roomId) return r
        return { ...r, isSignedOff: true, signedOffAt: new Date().toISOString(), clientName }
      })
      setChecklist({ ...checklist, rooms: newRooms })
      setRoomSignOffModal({ isOpen: false, roomId: null, clientName: '', otp: '1234' })
      toast.success(`Room ${roomId} signed off successfully`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to sign off room. Ensure checklist is internally authorized.')
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
  const allRoomsSignedOff = checklist.rooms.length > 0 && checklist.rooms.every(r => r.isSignedOff)
  const isAllChecked = allRoomsSignedOff
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
            title={!isAllChecked ? 'All rooms must be signed off before final project handover' : ''}
          >
            Finalize Project Handover
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
                {room.isSignedOff && <Badge variant="success">Signed Off by {room.clientName}</Badge>}
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                {!room.isSignedOff && !isReadOnly && (
                  <Button 
                    variant="outline" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setRoomSignOffModal({ isOpen: true, roomId: room.id, clientName: '', otp: '1234' })
                    }}
                    disabled={room.items.length === 0 || !room.items.every(i => i.isChecked)}
                  >
                    Sign Off Room
                  </Button>
                )}
                <div className={`${styles.chevron} ${collapsedRooms.has(room.id) ? styles.collapsed : ''}`}>▼</div>
              </div>
            </div>

            {!collapsedRooms.has(room.id) && (
              <div className={styles.itemsList}>
                {room.items.map(item => (
                  <div key={item.id} className={`${styles.itemRow} ${item.isChecked ? styles.checked : ''}`}>
                    <div className={styles.checkboxWrapper} title="Physically handed to client">
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={item.isChecked}
                        onChange={() => toggleItem(room.id, item.id)}
                        disabled={isReadOnly || room.isSignedOff}
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
                      {item.itemType === 'document' && (
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px', padding: '8px', background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)' }}>SERIAL NUMBER</label>
                            <input 
                              type="text" 
                              placeholder="e.g. SN12345" 
                              value={item.serialNumber || ''} 
                              disabled={isReadOnly || room.isSignedOff}
                              onChange={(e) => handleUpdateDocFields(item.id, { serial_number: e.target.value })}
                              style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', width: '120px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)' }}>WARRANTY EXPIRY</label>
                            <input 
                              type="date" 
                              value={item.warrantyExpiryDate ? item.warrantyExpiryDate.split('T')[0] : ''} 
                              disabled={isReadOnly || room.isSignedOff}
                              onChange={(e) => handleUpdateDocFields(item.id, { warranty_expiry_date: e.target.value })}
                              style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', height: '22px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, marginTop: '12px' }}>
                            <input 
                              type="checkbox" 
                              checked={item.hasManual} 
                              disabled={isReadOnly || room.isSignedOff}
                              onChange={(e) => handleUpdateDocFields(item.id, { has_manual: e.target.checked })}
                            />
                            <span>Manual</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, marginTop: '12px' }}>
                            <input 
                              type="checkbox" 
                              checked={item.hasWarrantyCard} 
                              disabled={isReadOnly || room.isSignedOff}
                              onChange={(e) => handleUpdateDocFields(item.id, { has_warranty_card: e.target.checked })}
                            />
                            <span>Warranty Card</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, marginTop: '12px' }}>
                            <input 
                              type="checkbox" 
                              checked={item.hasBrandRegistrationCard} 
                              disabled={isReadOnly || room.isSignedOff}
                              onChange={(e) => handleUpdateDocFields(item.id, { has_brand_registration_card: e.target.checked })}
                            />
                            <span>Brand Reg. Card</span>
                          </div>
                        </div>
                      )}
                      {item.itemType === 'key_access' && (
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px', padding: '8px', background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', width: '100%' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)' }}>HANDOVER DETAILS / QUANTITY / ACCESS CODES</label>
                            <input 
                              type="text" 
                              placeholder="e.g. 3 physical keys / Temporary code: 1234 / Card #402" 
                              value={item.keyDetails || ''} 
                              disabled={isReadOnly || room.isSignedOff}
                              onChange={(e) => handleUpdateDocFields(item.id, { key_details: e.target.value })}
                              style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', width: '100%' }}
                            />
                          </div>
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
                        disabled={isReadOnly || room.isSignedOff}
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
                      ) : !(isReadOnly || room.isSignedOff) ? (
                        <div className={styles.photoEmpty} onClick={() => triggerFileInput(room.id, item.id)}>
                          + Photo
                        </div>
                      ) : (
                        <div className={styles.photoEmpty} style={{ cursor: 'default', opacity: 0.5 }}>
                          No Photo
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {!isReadOnly && !room.isSignedOff && (
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
        title="Finalize Project Handover"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsSignOffModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSignOff}>Finalize Project</Button>
          </>
        }
      >
        <p>This will finalize the handover for the entire project. All rooms have been signed off individually. Proceed with project completion?</p>
      </Modal>

      <Modal
        isOpen={roomSignOffModal.isOpen}
        onClose={() => setRoomSignOffModal({ ...roomSignOffModal, isOpen: false })}
        title={`Sign Off Room: ${roomSignOffModal.roomId}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoomSignOffModal({ ...roomSignOffModal, isOpen: false })}>Cancel</Button>
            <Button variant="primary" onClick={handleRoomSignOff}>Sign Off Room</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p>Please provide the client name and OTP to sign off this room. Once signed, the room checklist will be locked.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Client Name</label>
            <input 
              type="text" 
              value={roomSignOffModal.clientName}
              onChange={(e) => setRoomSignOffModal({ ...roomSignOffModal, clientName: e.target.value })}
              placeholder="e.g. John Doe"
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Client OTP (Use 1234 for testing)</label>
            <input 
              type="text" 
              value={roomSignOffModal.otp}
              onChange={(e) => setRoomSignOffModal({ ...roomSignOffModal, otp: e.target.value })}
              placeholder="Enter 4 digit OTP"
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
