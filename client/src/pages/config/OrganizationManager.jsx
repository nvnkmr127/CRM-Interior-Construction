import { useState, useEffect } from 'react'
import { orgApi } from '../../api/org'
import { useToast } from '../../store/toastContext'
import { Button, Input, Modal, Avatar, Select } from '../../components/ui'

// -----------------------------------------------------------------------------
// Tree Node Component
// -----------------------------------------------------------------------------
const TreeNode = ({ node, isRoot = false, type = 'user', onDropNode, expandedNodes, toggleExpand, onEdit, onDelete, onAssign }) => {
  const isExpanded = expandedNodes.has(node.id)
  
  const handleDragStart = (e) => {
    e.dataTransfer.setData('nodeId', node.id)
    e.dataTransfer.setData('type', type)
    e.stopPropagation()
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.currentTarget.style.background = 'var(--color-background-soft)'
  }

  const handleDragLeave = (e) => {
    e.currentTarget.style.background = 'transparent'
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.currentTarget.style.background = 'transparent'
    const draggedId = e.dataTransfer.getData('nodeId')
    const draggedType = e.dataTransfer.getData('type')
    
    if (draggedType === type && draggedId !== node.id) {
      onDropNode(draggedId, node.id)
    }
    e.stopPropagation()
  }

  const renderContent = () => {
    if (type === 'user') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', minWidth: '300px' }}>
          <Avatar name={node.name} size="sm" />
          <div>
            <div style={{ fontWeight: 600 }}>{node.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{node.role_name || 'No Role'}</div>
          </div>
        </div>
      )
    }

    if (type === 'department') {
      return (
        <div className="flex flex-col p-4 w-72 h-44 cursor-grab">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{node.name}</h3>
              {node.code && <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded font-mono">{node.code}</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); onEdit(node); }} className="text-gray-400 hover:text-primary-600 text-xs">✏️</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="text-gray-400 hover:text-red-600 text-xs">🗑️</button>
            </div>
          </div>
          <p className="text-xs text-gray-500 flex-grow line-clamp-2 mb-2">{node.description || 'No description'}</p>
          <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              {node.manager_name ? (
                <>
                  <Avatar name={node.manager_name} size="xs" />
                  <span className="text-[11px] font-medium text-gray-700 truncate w-20">{node.manager_name}</span>
                </>
              ) : (
                <span className="text-[11px] text-gray-400 italic">No Manager</span>
              )}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); onAssign(node.id); }}
              className="flex items-center gap-1 text-[11px] text-primary-600 hover:text-primary-700 font-medium"
            >
              👥 <span>{node.employee_count || 0} Users</span>
            </button>
          </div>
        </div>
      )
    }

    if (type === 'branch') {
      return (
        <div className="flex flex-col p-4 w-72 h-44 cursor-grab">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{node.name}</h3>
              <div className="flex flex-col mt-1">
                {node.location && <span className="text-[10px] text-gray-500 truncate">📍 {node.location}</span>}
                {node.timezone && <span className="text-[10px] text-gray-500 truncate">🕒 {node.timezone}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); onEdit(node); }} className="text-gray-400 hover:text-primary-600 text-xs">✏️</button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="text-gray-400 hover:text-red-600 text-xs">🗑️</button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              {node.manager_name ? (
                <>
                  <Avatar name={node.manager_name} size="xs" />
                  <span className="text-[11px] font-medium text-gray-700 truncate w-20">{node.manager_name}</span>
                </>
              ) : (
                <span className="text-[11px] text-gray-400 italic">No Manager</span>
              )}
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); onAssign(node.id); }}
              className="flex items-center gap-1 text-[11px] text-primary-600 hover:text-primary-700 font-medium"
            >
              👥 <span>{node.employee_count || 0} Users</span>
            </button>
          </div>
        </div>
      )
    }
  }

  return (
    <div style={{ marginLeft: isRoot ? '0' : '32px', position: 'relative' }}>
      {!isRoot && <div style={{ position: 'absolute', left: '-32px', top: '24px', width: '32px', height: '1px', background: 'var(--color-border)' }} />}
      {!isRoot && <div style={{ position: 'absolute', left: '-32px', top: '-16px', width: '1px', height: '40px', background: 'var(--color-border)' }} />}
      
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px' }}>
        <div 
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: '1px solid var(--color-border)', borderRadius: '8px',
            background: 'white', cursor: 'grab', width: 'max-content',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
          }}
        >
          {renderContent()}
        </div>

        {node.children?.length > 0 && (
          <button 
            onClick={() => toggleExpand(node.id)}
            style={{ marginTop: type === 'user' ? '12px' : '24px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-soft)', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
          >
            {isExpanded ? '-' : '+'}
          </button>
        )}
      </div>

      {isExpanded && node.children && node.children.length > 0 && (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '-16px', top: 0, bottom: '32px', width: '1px', background: 'var(--color-border)' }} />
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} type={type} onDropNode={onDropNode} expandedNodes={expandedNodes} toggleExpand={toggleExpand} onEdit={onEdit} onDelete={onDelete} onAssign={onAssign} />
          ))}
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export default function OrganizationManager() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('users')
  const [search, setSearch] = useState('')
  
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [branches, setBranches] = useState([])
  
  const [expandedNodes, setExpandedNodes] = useState(new Set())
  
  // Modals
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false)
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  
  // Edit States
  const [editingDept, setEditingDept] = useState(null)
  const [editingBranch, setEditingBranch] = useState(null)
  const [assignTarget, setAssignTarget] = useState(null) // { type: 'department' | 'branch', id: string }
  const [selectedUsers, setSelectedUsers] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [uRes, dRes, bRes] = await Promise.all([
        orgApi.getHierarchy(),
        orgApi.getDepartments(),
        orgApi.getBranches()
      ])
      setUsers(uRes)
      setDepartments(dRes)
      setBranches(bRes)
      
      const initialExpanded = new Set()
      uRes.filter(u => !u.manager_id).forEach(u => initialExpanded.add(u.id))
      dRes.filter(d => !d.parent_id).forEach(d => initialExpanded.add(d.id))
      bRes.filter(b => !b.parent_id).forEach(b => initialExpanded.add(b.id))
      setExpandedNodes(initialExpanded)
    } catch (err) {
      toast.error('Failed to load org structure')
    }
  }

  const toggleExpand = (id) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const buildTree = (items, parentKey) => {
    const itemMap = new Map()
    items.forEach(item => itemMap.set(item.id, { ...item, children: [] }))
    const roots = []
    itemMap.forEach(item => {
      const parentId = item[parentKey]
      if (parentId && itemMap.has(parentId)) {
        itemMap.get(parentId).children.push(item)
      } else {
        roots.push(item)
      }
    })
    return roots
  }

  // ---- Drag Handlers ----
  const handleDropUserNode = async (draggedId, newParentId) => {
    try {
      const currentTarget = users.find(u => u.id === draggedId)
      if (currentTarget.manager_id === newParentId) return
      
      setUsers(prev => prev.map(u => u.id === draggedId ? { ...u, manager_id: newParentId } : u))
      await orgApi.updateUserOrgInfo(draggedId, { manager_id: newParentId })
      toast.success('Reporting manager updated')
      setExpandedNodes(prev => new Set(prev).add(newParentId))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user hierarchy')
      loadData() 
    }
  }

  const handleDropDeptNode = async (draggedId, newParentId) => {
    try {
      await orgApi.updateDepartment(draggedId, { parent_id: newParentId })
      toast.success('Department hierarchy updated')
      setExpandedNodes(prev => new Set(prev).add(newParentId))
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update department hierarchy')
    }
  }

  const handleDropBranchNode = async (draggedId, newParentId) => {
    try {
      await orgApi.updateBranch(draggedId, { parent_id: newParentId })
      toast.success('Branch hierarchy updated')
      setExpandedNodes(prev => new Set(prev).add(newParentId))
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update branch hierarchy')
    }
  }

  // ---- CRUD Handlers ----
  const handleSaveDepartment = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const data = Object.fromEntries(fd.entries())
    if (!data.manager_id) data.manager_id = null
    if (!data.parent_id) data.parent_id = null
    
    try {
      if (editingDept?.id) {
        await orgApi.updateDepartment(editingDept.id, data)
        toast.success('Department updated')
      } else {
        await orgApi.createDepartment(data)
        toast.success('Department created')
      }
      setIsDeptModalOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save department')
    }
  }

  const handleDeleteDepartment = async (id) => {
    if (!confirm('Are you sure you want to delete this department?')) return
    try {
      await orgApi.deleteDepartment(id)
      toast.success('Department deleted')
      loadData()
    } catch (err) {
      toast.error('Failed to delete department')
    }
  }

  const handleSaveBranch = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const data = Object.fromEntries(fd.entries())
    if (!data.manager_id) data.manager_id = null
    if (!data.parent_id) data.parent_id = null
    
    try {
      if (editingBranch?.id) {
        await orgApi.updateBranch(editingBranch.id, data)
        toast.success('Branch updated')
      } else {
        await orgApi.createBranch(data)
        toast.success('Branch created')
      }
      setIsBranchModalOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save branch')
    }
  }

  const handleDeleteBranch = async (id) => {
    if (!confirm('Are you sure you want to delete this branch?')) return
    try {
      await orgApi.deleteBranch(id)
      toast.success('Branch deleted')
      loadData()
    } catch (err) {
      toast.error('Failed to delete branch')
    }
  }

  const handleBatchAssign = async () => {
    if (selectedUsers.length === 0) return toast.error('No users selected')
    try {
      const payload = { user_ids: selectedUsers }
      if (assignTarget.type === 'department') payload.department_id = assignTarget.id
      if (assignTarget.type === 'branch') payload.branch_id = assignTarget.id

      await orgApi.batchAssignUsers(payload)
      toast.success(`Assigned ${selectedUsers.length} users successfully`)
      setIsAssignModalOpen(false)
      setSelectedUsers([])
      loadData()
    } catch (err) {
      toast.error('Failed to assign users')
    }
  }

  // ---- Renders ----
  const filteredUsers = search ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase())) : users
  const userTreeRoots = buildTree(search ? filteredUsers : users, 'manager_id')

  const filteredDepartments = search ? departments.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.code?.toLowerCase().includes(search.toLowerCase())) : departments
  const departmentTreeRoots = buildTree(search ? filteredDepartments : departments, 'parent_id')

  const filteredBranches = search ? branches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || b.location?.toLowerCase().includes(search.toLowerCase())) : branches
  const branchTreeRoots = buildTree(search ? filteredBranches : branches, 'parent_id')

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8 space-y-8">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Organization Hierarchy</h2>
            <p className="text-gray-500 mt-1">Manage reporting structures, departments, and branches.</p>
          </div>
          <div className="flex gap-3">
            {activeTab === 'departments' && (
              <Button variant="primary" onClick={() => { setEditingDept(null); setIsDeptModalOpen(true); }} className="flex items-center gap-2">
                ➕ Add Department
              </Button>
            )}
            {activeTab === 'branches' && (
              <Button variant="primary" onClick={() => { setEditingBranch(null); setIsBranchModalOpen(true); }} className="flex items-center gap-2">
                ➕ Add Branch
              </Button>
            )}
          </div>
        </div>

        {/* Tabs & Search */}
        <div className="p-6 pb-0 flex flex-col sm:flex-row justify-between items-end gap-4 border-b border-gray-200">
          <div className="flex gap-6 overflow-x-auto w-full no-scrollbar">
            {['users', 'departments', 'branches'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'users' ? 'Reporting Structure' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="pb-4 w-full sm:w-72">
            <Input 
              placeholder={`Search ${activeTab}...`} 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-50"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 bg-gray-50/50 min-h-[500px] overflow-x-auto">
          
          {/* USERS TREE */}
          {activeTab === 'users' && (
            <div className="min-w-[800px]">
              {userTreeRoots.length === 0 ? (
                <div className="text-center text-gray-500 py-12">No users found.</div>
              ) : (
                userTreeRoots.map(root => (
                  <TreeNode key={root.id} node={root} isRoot={true} type="user" onDropNode={handleDropUserNode} expandedNodes={expandedNodes} toggleExpand={toggleExpand} />
                ))
              )}
            </div>
          )}

          {/* DEPARTMENTS TREE */}
          {activeTab === 'departments' && (
            <div className="min-w-[800px]">
              {departmentTreeRoots.length === 0 ? (
                <div className="text-center text-gray-500 py-12">No departments found.</div>
              ) : (
                departmentTreeRoots.map(root => (
                  <TreeNode 
                    key={root.id} node={root} isRoot={true} type="department" 
                    onDropNode={handleDropDeptNode} expandedNodes={expandedNodes} toggleExpand={toggleExpand}
                    onEdit={(dept) => { setEditingDept(dept); setIsDeptModalOpen(true); }}
                    onDelete={handleDeleteDepartment}
                    onAssign={(id) => { setAssignTarget({ type: 'department', id }); setIsAssignModalOpen(true); }}
                  />
                ))
              )}
            </div>
          )}

          {/* BRANCHES TREE */}
          {activeTab === 'branches' && (
            <div className="min-w-[800px]">
              {branchTreeRoots.length === 0 ? (
                <div className="text-center text-gray-500 py-12">No branches found.</div>
              ) : (
                branchTreeRoots.map(root => (
                  <TreeNode 
                    key={root.id} node={root} isRoot={true} type="branch" 
                    onDropNode={handleDropBranchNode} expandedNodes={expandedNodes} toggleExpand={toggleExpand}
                    onEdit={(branch) => { setEditingBranch(branch); setIsBranchModalOpen(true); }}
                    onDelete={handleDeleteBranch}
                    onAssign={(id) => { setAssignTarget({ type: 'branch', id }); setIsAssignModalOpen(true); }}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- MODALS ---------------- */}

      <Modal isOpen={isDeptModalOpen} onClose={() => setIsDeptModalOpen(false)} title={editingDept ? "Edit Department" : "New Department"} size="md">
        <form onSubmit={handleSaveDepartment} className="space-y-4">
          <Input label="Department Name *" name="name" defaultValue={editingDept?.name} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Department Code" name="code" defaultValue={editingDept?.code} placeholder="e.g. ENG-01" />
            <Select label="Parent Department" name="parent_id" defaultValue={editingDept?.parent_id || ''}>
              <option value="">None (Top Level)</option>
              {departments.filter(d => d.id !== editingDept?.id).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <Select label="Department Manager" name="manager_id" defaultValue={editingDept?.manager_id || ''}>
            <option value="">Unassigned</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea 
              name="description" 
              defaultValue={editingDept?.description} 
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border" 
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsDeptModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Save Department</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isBranchModalOpen} onClose={() => setIsBranchModalOpen(false)} title={editingBranch ? "Edit Branch" : "New Branch"} size="md">
        <form onSubmit={handleSaveBranch} className="space-y-4">
          <Input label="Branch Name *" name="name" defaultValue={editingBranch?.name} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Location" name="location" defaultValue={editingBranch?.location} placeholder="City, Country" />
            <Input label="Timezone" name="timezone" defaultValue={editingBranch?.timezone} placeholder="e.g. UTC, EST" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Parent Branch" name="parent_id" defaultValue={editingBranch?.parent_id || ''}>
              <option value="">None (HQ)</option>
              {branches.filter(b => b.id !== editingBranch?.id).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
            <Select label="Branch Manager" name="manager_id" defaultValue={editingBranch?.manager_id || ''}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsBranchModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Save Branch</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isAssignModalOpen} onClose={() => { setIsAssignModalOpen(false); setSelectedUsers([]); }} title={`Assign Users`} size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Select users to assign them to this {assignTarget?.type}. This will override their current assignment.</p>
          
          <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto p-2 space-y-1">
            {users.map(u => (
              <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded text-primary-600 focus:ring-primary-500"
                  checked={selectedUsers.includes(u.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedUsers(prev => [...prev, u.id])
                    else setSelectedUsers(prev => prev.filter(id => id !== u.id))
                  }}
                />
                <Avatar name={u.name} size="xs" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{u.name}</span>
                  <span className="text-xs text-gray-500">{u.email}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4">
            <span className="text-sm text-gray-500">{selectedUsers.length} selected</span>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => { setIsAssignModalOpen(false); setSelectedUsers([]); }}>Cancel</Button>
              <Button variant="primary" onClick={handleBatchAssign}>Assign Users</Button>
            </div>
          </div>
        </div>
      </Modal>

    </div>
  )
}
