import { useState, useEffect } from 'react'
import { orgApi } from '../../api/org'
import { useToast } from '../../store/toastContext'
import { Button, Input, Select, Avatar, Drawer } from '../../components/ui'
import { OrgNodeCard } from '../../components/ui'
import AssignEmployeesModal from './AssignEmployeesModal'
import layoutStyles from './ConfigLayout.module.css'
import orgStyles from './OrgChart.module.css'

// -----------------------------------------------------------------------------
// Recursive Org Node Component
// -----------------------------------------------------------------------------
const OrgNode = ({ node, type, onDropNode, toggleExpand, expandedNodes, onNodeClick }) => {
  const isExpanded = expandedNodes.has(node.id)
  
  const handleDragStart = (e) => {
    e.dataTransfer.setData('nodeId', node.id)
    e.dataTransfer.setData('type', type)
    e.stopPropagation()
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('nodeId')
    const draggedType = e.dataTransfer.getData('type')
    
    if (draggedType === type && draggedId !== node.id) {
      onDropNode(draggedId, node.id)
    }
    e.stopPropagation()
  }

  return (
    <div className={orgStyles.orgNodeContainer}>
      <OrgNodeCard 
        node={node} 
        type={type}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={(n, t) => onNodeClick(n, t)}
      />

      {node.children && node.children.length > 0 && (
        <button 
          onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white border border-gray-300 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-500 hover:text-primary-600 hover:border-primary-600 shadow-sm z-10 transition-colors"
        >
          {isExpanded ? '-' : '+'}
        </button>
      )}

      {isExpanded && node.children && node.children.length > 0 && (
        <div className={orgStyles.orgChildren}>
          {node.children.map(child => (
            <OrgNode 
              key={child.id} 
              node={child} 
              type={type} 
              onDropNode={onDropNode} 
              toggleExpand={toggleExpand}
              expandedNodes={expandedNodes}
              onNodeClick={onNodeClick}
            />
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
  
  // Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState('view') // 'view', 'edit', 'create'
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    location: '',
    timezone: '',
    parent_id: '',
    manager_id: '',
    description: '',
    department_id: '',
    branch_id: ''
  })

  // Assign Employees Modal States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)

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
      const uList = Array.isArray(uRes) ? uRes : []
      const dList = Array.isArray(dRes) ? dRes : []
      const bList = Array.isArray(bRes) ? bRes : []

      setUsers(uList)
      setDepartments(dList)
      setBranches(bList)
      
      const initialExpanded = new Set()
      uList.filter(u => !u.manager_id).forEach(u => initialExpanded.add(u.id))
      dList.filter(d => !d.parent_id).forEach(d => initialExpanded.add(d.id))
      bList.filter(b => !b.parent_id).forEach(b => initialExpanded.add(b.id))
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
    
    const hasParent = new Set()

    const isAncestor = (potentialAncestorId, targetParentId) => {
      let curr = itemMap.get(targetParentId)
      const visited = new Set()
      while (curr && curr[parentKey]) {
        if (visited.has(curr.id)) break
        visited.add(curr.id)
        if (curr[parentKey] === potentialAncestorId) return true
        curr = itemMap.get(curr[parentKey])
      }
      return false
    }
    
    itemMap.forEach(item => {
      const parentId = item[parentKey]
      if (parentId && parentId !== item.id && itemMap.has(parentId)) {
        if (!isAncestor(item.id, parentId)) {
          itemMap.get(parentId).children.push(item)
          hasParent.add(item.id)
        }
      }
    })
    
    const roots = []
    itemMap.forEach(item => {
      if (!hasParent.has(item.id)) {
        roots.push(item)
      }
    })
    
    return roots
  }

  // ---- Drag Handlers ----
  const handleDropNode = async (draggedId, newParentId, type) => {
    try {
      if (type === 'user') {
        const currentTarget = users.find(u => u.id === draggedId)
        if (!currentTarget || currentTarget.manager_id === newParentId) return
        setUsers(prev => prev.map(u => u.id === draggedId ? { ...u, manager_id: newParentId } : u))
        await orgApi.updateUserOrgInfo(draggedId, { manager_id: newParentId })
      } else if (type === 'department') {
        const currentTarget = departments.find(d => d.id === draggedId)
        if (!currentTarget || currentTarget.parent_id === newParentId) return
        await orgApi.updateDepartment(draggedId, { parent_id: newParentId })
      } else if (type === 'branch') {
        const currentTarget = branches.find(b => b.id === draggedId)
        if (!currentTarget || currentTarget.parent_id === newParentId) return
        await orgApi.updateBranch(draggedId, { parent_id: newParentId })
      }
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} hierarchy updated`)
      setExpandedNodes(prev => new Set(prev).add(newParentId))
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || `Failed to update hierarchy`)
      loadData() 
    }
  }

  // ---- CRUD Handlers ----
  const handleSaveEntity = async (e) => {
    e.preventDefault()
    if (!formData.name?.trim() && selectedType !== 'user') {
      toast.error('Name is required')
      return
    }

    const data = {
      ...formData,
      name: formData.name ? formData.name.trim() : '',
      manager_id: formData.manager_id || null,
      parent_id: formData.parent_id || null,
      department_id: formData.department_id || null,
      branch_id: formData.branch_id || null
    }
    
    try {
      if (selectedType === 'department') {
        if (drawerMode === 'edit') await orgApi.updateDepartment(selectedNode.id, data)
        else await orgApi.createDepartment(data)
      } else if (selectedType === 'branch') {
        if (drawerMode === 'edit') await orgApi.updateBranch(selectedNode.id, data)
        else await orgApi.createBranch(data)
      } else if (selectedType === 'user') {
        if (drawerMode === 'edit') {
          await orgApi.updateUserOrgInfo(selectedNode.id, data)
        }
      }
      
      toast.success(`${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} saved successfully`)
      setIsDrawerOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || `Failed to save ${selectedType}`)
    }
  }

  const handleDeleteEntity = async () => {
    if (!confirm(`Are you sure you want to delete this ${selectedType}?`)) return
    try {
      if (selectedType === 'department') await orgApi.deleteDepartment(selectedNode.id)
      if (selectedType === 'branch') await orgApi.deleteBranch(selectedNode.id)
      toast.success(`${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} deleted`)
      setIsDrawerOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || `Failed to delete ${selectedType}`)
    }
  }

  const handleNodeClick = (node, type) => {
    setSelectedNode(node)
    setSelectedType(type)
    setFormData({
      name: node.name || '',
      code: node.code || '',
      location: node.location || '',
      timezone: node.timezone || 'Asia/Kolkata',
      parent_id: node.parent_id || '',
      manager_id: node.manager_id || '',
      description: node.description || '',
      department_id: node.department_id || '',
      branch_id: node.branch_id || ''
    })
    setDrawerMode('view')
    setIsDrawerOpen(true)
  }

  const openCreateDrawer = (type) => {
    setSelectedType(type)
    setSelectedNode(null)
    setFormData({
      name: '',
      code: '',
      location: '',
      timezone: 'Asia/Kolkata',
      parent_id: '',
      manager_id: '',
      description: '',
      department_id: '',
      branch_id: ''
    })
    setDrawerMode('create')
    setIsDrawerOpen(true)
  }

  // ---- Renders ----
  const filteredUsers = search ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase())) : users
  const userTreeRoots = buildTree(filteredUsers, 'manager_id')

  const filteredDepartments = search ? departments.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.code?.toLowerCase().includes(search.toLowerCase())) : departments
  const departmentTreeRoots = buildTree(filteredDepartments, 'parent_id')

  const filteredBranches = search ? branches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || b.location?.toLowerCase().includes(search.toLowerCase())) : branches
  const branchTreeRoots = buildTree(filteredBranches, 'parent_id')

  const renderDrawerContent = () => {
    if (drawerMode === 'view' && selectedNode) {
      return (
        <div className="space-y-6">
          <div className="flex items-start gap-4 pb-6 border-b border-gray-100">
            <Avatar name={selectedNode.name || '?'} size="lg" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{selectedNode.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{selectedType.toUpperCase()}</p>
            </div>
          </div>
          
          {selectedType !== 'user' && (() => {
            const assignedUsers = users.filter(u => selectedType === 'department' ? u.department_id === selectedNode.id : u.branch_id === selectedNode.id)
            const currentHeadName = selectedNode.manager_name || users.find(u => u.id === selectedNode.manager_id)?.name || 'Unassigned'

            return (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Head / Manager</span>
                    <span className="font-semibold text-gray-900">{currentHeadName}</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Headcount</span>
                    <span className="font-semibold text-gray-900">{assignedUsers.length}</span>
                  </div>
                  {selectedType === 'branch' && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 col-span-2">
                      <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Location Info</span>
                      <span className="font-semibold text-gray-900">{selectedNode.location || 'N/A'} {selectedNode.timezone ? `(${selectedNode.timezone})` : ''}</span>
                    </div>
                  )}
                  {selectedType === 'department' && selectedNode.code && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 col-span-2">
                      <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Department Code</span>
                      <span className="font-semibold text-gray-900">{selectedNode.code}</span>
                    </div>
                  )}
                  {selectedType === 'department' && selectedNode.description && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 col-span-2">
                      <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Description</span>
                      <p className="text-sm text-gray-700">{selectedNode.description}</p>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Assigned Employees ({assignedUsers.length})</h3>
                    <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(true)}>Assign</Button>
                  </div>
                  
                  <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto pr-1">
                    {assignedUsers.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No employees assigned.</p>
                    ) : (
                      assignedUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-colors">
                          <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => handleNodeClick(u, 'user')}>
                            <Avatar name={u.name} size="sm" url={u.avatar_url} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                              <p className="text-xs text-gray-500 truncate">{u.role_name || 'No Role'}</p>
                            </div>
                          </div>
                          <button 
                            title={`Unassign ${u.name}`}
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                const patchData = selectedType === 'department' ? { department_id: null } : { branch_id: null }
                                await orgApi.updateUserOrgInfo(u.id, patchData)
                                toast.success(`${u.name} unassigned`)
                                loadData()
                              } catch (err) {
                                toast.error('Failed to unassign user')
                              }
                            }}
                            className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors text-xs font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-6 border-t border-gray-100 flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setDrawerMode('edit')}>Edit</Button>
                    <Button variant="danger" className="flex-1" onClick={handleDeleteEntity}>Delete</Button>
                  </div>
                </div>
              </>
            )
          })()}

          {selectedType === 'user' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Role</span>
                  <span className="font-semibold text-gray-900">{selectedNode.role_name || 'No Role'}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Email</span>
                  <span className="font-semibold text-gray-900 break-words">{selectedNode.email}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Reports To</span>
                  <span className="font-semibold text-gray-900">{selectedNode.manager_name || users.find(u => u.id === selectedNode.manager_id)?.name || 'Direct / None'}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Department</span>
                  <span className="font-semibold text-gray-900">{selectedNode.department_name || departments.find(d => d.id === selectedNode.department_id)?.name || 'Unassigned'}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 col-span-2">
                  <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Branch</span>
                  <span className="font-semibold text-gray-900">{selectedNode.branch_name || branches.find(b => b.id === selectedNode.branch_id)?.name || 'Unassigned'}</span>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDrawerMode('edit')}>Edit Assignment</Button>
              </div>
            </>
          )}
        </div>
      )
    }

    if (drawerMode === 'edit' || drawerMode === 'create') {
      const isDept = selectedType === 'department'
      const isUser = selectedType === 'user'
      const entity = selectedNode || {}
      return (
        <form onSubmit={handleSaveEntity} className="space-y-4">
          {isUser ? (
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-4">Update organization assignment for <strong>{entity.name}</strong>.</p>
              <div className="space-y-4">
                <Select 
                  label="Manager" 
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...users.filter(u => u.id !== entity.id).map(u => ({ value: u.id, label: u.name }))
                  ]}
                  value={formData.manager_id}
                  onChange={v => setFormData(p => ({ ...p, manager_id: v }))}
                />
                <Select 
                  label="Department" 
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...departments.map(d => ({ value: d.id, label: d.name }))
                  ]}
                  value={formData.department_id}
                  onChange={v => setFormData(p => ({ ...p, department_id: v }))}
                />
                <Select 
                  label="Branch" 
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...branches.map(b => ({ value: b.id, label: b.name }))
                  ]}
                  value={formData.branch_id}
                  onChange={v => setFormData(p => ({ ...p, branch_id: v }))}
                />
              </div>
            </div>
          ) : (
            <>
              <Input 
                label={`${isDept ? 'Department' : 'Branch'} Name *`} 
                value={formData.name} 
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                required 
              />
              
              {isDept && (
                <Input 
                  label="Department Code" 
                  value={formData.code} 
                  onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
                  placeholder="e.g. ENG-01" 
                />
              )}
    
              {!isDept && (
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Location" 
                    value={formData.location} 
                    onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                    placeholder="City, Country" 
                  />
                  <Input 
                    label="Timezone" 
                    value={formData.timezone} 
                    onChange={e => setFormData(p => ({ ...p, timezone: e.target.value }))}
                    placeholder="e.g. Asia/Kolkata, UTC" 
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <Select 
                  label="Parent" 
                  options={[
                    { value: '', label: 'None (Top Level)' },
                    ...(isDept ? departments : branches)
                      .filter(item => !entity?.id || item.id !== entity.id)
                      .map(item => ({ value: item.id, label: item.name }))
                  ]}
                  value={formData.parent_id}
                  onChange={v => setFormData(p => ({ ...p, parent_id: v }))}
                />
                <Select 
                  label="Manager" 
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...users.map(u => ({ value: u.id, label: u.name }))
                  ]}
                  value={formData.manager_id}
                  onChange={v => setFormData(p => ({ ...p, manager_id: v }))}
                />
              </div>
    
              {isDept && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea 
                    value={formData.description} 
                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2 border" 
                    rows={3}
                  />
                </div>
              )}
            </>
          )}
          
          <div className="pt-6 mt-6 border-t border-gray-100 flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Save {isUser ? 'Assignment' : (isDept ? 'Department' : 'Branch')}</Button>
          </div>
        </form>
      )
    }
    return null
  }

  return (
    <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        
        {/* Header */}
        <div className={layoutStyles.sectionHeader} style={{ flexShrink: 0, margin: 0, padding: '16px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className={layoutStyles.sectionTitle}>Organization Architecture</h2>
            <p className={layoutStyles.sectionDesc}>Visualize and manage CRM reporting lines, departments, and regional branches.</p>
          </div>
          <div className="flex gap-3">
            {activeTab === 'departments' && (
              <Button variant="primary" onClick={() => openCreateDrawer('department')} className="flex items-center gap-2">
                ➕ Add Department
              </Button>
            )}
            {activeTab === 'branches' && (
              <Button variant="primary" onClick={() => openCreateDrawer('branch')} className="flex items-center gap-2">
                ➕ Add Branch
              </Button>
            )}
          </div>
        </div>

        {/* Tabs & Search */}
        <div className="px-6 pt-4 flex flex-col sm:flex-row justify-between items-end gap-4 border-b border-gray-200" style={{ flexShrink: 0 }}>
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

        {/* Content Area - Visual Org Chart */}
        <div className="bg-slate-50 relative p-6" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          
          <div className={orgStyles.orgTree} style={{ flexWrap: 'wrap', gap: '24px', justifyContent: 'flex-start' }}>
            {/* USERS TREE */}
            {activeTab === 'users' && (
              userTreeRoots.length === 0 ? (
                <div className="text-center text-gray-500 py-12">No users found.</div>
              ) : (
                userTreeRoots.map(root => (
                  <OrgNode 
                    key={root.id} node={root} type="user" 
                    onDropNode={(draggedId, newParentId) => handleDropNode(draggedId, newParentId, 'user')} 
                    expandedNodes={expandedNodes} toggleExpand={toggleExpand} onNodeClick={handleNodeClick}
                  />
                ))
              )
            )}

            {/* DEPARTMENTS TREE */}
            {activeTab === 'departments' && (
              departmentTreeRoots.length === 0 ? (
                <div className="text-center text-gray-500 py-12">No departments found.</div>
              ) : (
                departmentTreeRoots.map(root => (
                  <OrgNode 
                    key={root.id} node={root} type="department" 
                    onDropNode={(draggedId, newParentId) => handleDropNode(draggedId, newParentId, 'department')} 
                    expandedNodes={expandedNodes} toggleExpand={toggleExpand} onNodeClick={handleNodeClick}
                  />
                ))
              )
            )}

            {/* BRANCHES TREE */}
            {activeTab === 'branches' && (
              branchTreeRoots.length === 0 ? (
                <div className="text-center text-gray-500 py-12">No branches found.</div>
              ) : (
                branchTreeRoots.map(root => (
                  <OrgNode 
                    key={root.id} node={root} type="branch" 
                    onDropNode={(draggedId, newParentId) => handleDropNode(draggedId, newParentId, 'branch')} 
                    expandedNodes={expandedNodes} toggleExpand={toggleExpand} onNodeClick={handleNodeClick}
                  />
                ))
              )
            )}
          </div>
        </div>
      </div>

      {/* Slide-over Drawer for Details/Edit */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={
          drawerMode === 'view' ? 'Details' : 
          drawerMode === 'edit' ? `Edit ${selectedType}` : `New ${selectedType}`
        }
        width={400}
      >
        <div className="p-6">
          {renderDrawerContent()}
        </div>
      </Drawer>

      {/* Assign Employees Modal */}
      {selectedNode && (selectedType === 'department' || selectedType === 'branch') && (
        <AssignEmployeesModal 
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          entityType={selectedType}
          entityId={selectedNode.id}
          entityName={selectedNode.name}
          users={users}
          onAssignSuccess={loadData}
        />
      )}
    </div>
  )
}
