import { useState, useMemo } from 'react'
import { Modal, Button, Avatar, Input } from '../../components/ui'
import { orgApi } from '../../api/org'
import { useToast } from '../../store/toastContext'

export default function AssignEmployeesModal({ isOpen, onClose, entityType, entityId, entityName, users, onAssignSuccess }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState(new Set())
  const [search, setSearch] = useState('')

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    let list = users || []
    if (search) {
      list = list.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || (u.email && u.email.toLowerCase().includes(search.toLowerCase())))
    }
    return list
  }, [users, search])

  const toggleUser = (id) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAssign = async () => {
    if (selectedUserIds.size === 0) {
      toast.error('Please select at least one user')
      return
    }

    setLoading(true)
    try {
      const payload = {
        user_ids: Array.from(selectedUserIds),
        ...(entityType === 'department' ? { department_id: entityId } : { branch_id: entityId })
      }
      
      await orgApi.batchAssignUsers(payload)
      toast.success(`${selectedUserIds.size} users assigned to ${entityName}`)
      onAssignSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign users')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Employees to ${entityName}`}
      size="lg"
      footer={
        <div className="flex gap-3 justify-end w-full">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={handleAssign} disabled={loading || selectedUserIds.size === 0}>
            {loading ? 'Assigning...' : `Assign ${selectedUserIds.size} Users`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Select users below to assign them to this {entityType}. Their existing {entityType} assignment will be overwritten.
        </p>

        <Input 
          placeholder="Search by name or email..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />

        <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col max-h-[400px]">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
            <span className="text-xs font-medium text-gray-500 uppercase">
              {filteredUsers.length} Users
            </span>
            <button 
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
              onClick={() => {
                if (selectedUserIds.size === filteredUsers.length) setSelectedUserIds(new Set())
                else setSelectedUserIds(new Set(filteredUsers.map(u => u.id)))
              }}
            >
              {selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="overflow-y-auto flex-1 h-[300px]">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No users found.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredUsers.map(user => {
                  const isAssigned = entityType === 'department' ? user.department_id === entityId : user.branch_id === entityId;
                  
                  return (
                    <li 
                      key={user.id} 
                      className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer ${selectedUserIds.has(user.id) ? 'bg-primary-50/30' : ''}`}
                      onClick={() => toggleUser(user.id)}
                    >
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 pointer-events-none"
                        checked={selectedUserIds.has(user.id)}
                        readOnly
                      />
                      <Avatar name={user.name} size="sm" url={user.avatar_url} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email || user.role_name}</p>
                      </div>
                      {isAssigned && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          Assigned Here
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
