import { useState, useEffect } from 'react'
import { orgApi } from '../../api/org'
import { useToast } from '../../store/toastContext'
import { Button, Input, Select, Avatar, Drawer, Badge } from '../../components/ui'
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
    
    const hasParent = new Set()
    
    itemMap.forEach(item => {
      const parentId = item[parentKey]
      if (parentId && parentId !== item.id && itemMap.has(parentId)) {
        itemMap.get(parentId).children.push(item)
        hasParent.add(item.id)
      }
    })
    
    const roots = []
    itemMap.forEach(item => {
      if (!hasParent.has(item.id)) {
        roots.push(item)
      }
    })
    
    if (roots.length === 0 && items.length > 0) {
      // Fallback for complete circular reference
      roots.push(itemMap.values().next().value)
    }
    
    return roots
  }

  // ---- Drag Handlers ----
  const handleDropNode = async (draggedId, newParentId, type) => {
    try {
      if (type === 'user') {
        const currentTarget = users.find(u => u.id === draggedId)
        if (currentTarget.manager_id === newParentId) return
        setUsers(prev => prev.map(u => u.id === draggedId ? { ...u, manager_id: newParentId } : u))
        await orgApi.updateUserOrgInfo(draggedId, { manager_id: newParentId })
      } else if (type === 'department') {
        await orgApi.updateDepartment(draggedId, { parent_id: newParentId })
      } else if (type === 'branch') {
        await orgApi.updateBranch(draggedId, { parent_id: newParentId })
      }
      toast.success(`${type} hierarchy updated`)
      setExpandedNodes(prev => new Set(prev).add(newParentId))
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to update hierarchy`)
      loadData() 
    }
  }

  // ---- CRUD Handlers ----
  const handleSaveEntity = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const data = Object.fromEntries(fd.entries())
    if (!data.manager_id) data.manager_id = null
    if (!data.parent_id) data.parent_id = null
    
    try {
      if (selectedType === 'department') {
        if (drawerMode === 'edit') await orgApi.updateDepartment(selectedNode.id, data)
        else await orgApi.createDepartment(data)
      } else if (selectedType === 'branch') {
        if (drawerMode === 'edit') await orgApi.updateBranch(selectedNode.id, data)
        else await orgApi.createBranch(data)
      } else if (selectedType === 'user') {
        if (drawerMode === 'edit') {
          if (!data.department_id) data.department_id = null
          if (!data.branch_id) data.branch_id = null
          await orgApi.updateUserOrgInfo(selectedNode.id, data)
        }
      }
      
      toast.success(`${selectedType} saved successfully`)
      setIsDrawerOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to save ${selectedType}`)
    }
  }

  const handleDeleteEntity = async () => {
    if (!confirm(`Are you sure you want to delete this ${selectedType}?`)) return
    try {
      if (selectedType === 'department') await orgApi.deleteDepartment(selectedNode.id)
      if (selectedType === 'branch') await orgApi.deleteBranch(selectedNode.id)
      toast.success(`${selectedType} deleted`)
      setIsDrawerOpen(false)
      loadData()
    } catch (err) {
      toast.error(`Failed to delete ${selectedType}`)
    }
  }

  const handleNodeClick = (node, type) => {
    setSelectedNode(node)
    setSelectedType(type)
    setDrawerMode('view')
    setIsDrawerOpen(true)
  }

  const openCreateDrawer = (type) => {
    setSelectedType(type)
    setSelectedNode(null)
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
          
          <div className="grid grid-cols-2 gap-4">
            {selectedType !== 'user' && (
              <>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Manager</span>
                  <span className="font-semibold text-gray-900">{selectedNode.manager_name || 'Unassigned'}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Headcount</span>
                  <span className="font-semibold text-gray-900">{selectedNode.employee_count || 0}</span>
                </div>
              </>
            )}
            {selectedType === 'branch' && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 col-span-2">
                <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Location Info</span>
                <span className="font-semibold text-gray-900">{selectedNode.location} - {selectedNode.timezone}</span>
              </div>
            )}
            {selectedType === 'user' && (
              <>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Role</span>
                  <span className="font-semibold text-gray-900">{selectedNode.role_name || 'No Role'}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Email</span>
                  <span className="font-semibold text-gray-900 break-words">{selectedNode.email}</span>
                </div>
                
                <div className="pt-6 border-t border-gray-100 flex gap-3 col-span-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDrawerMode('edit')}>Edit Assignment</Button>
                </div>
              </>
            )}
          </div>
          
          {selectedType !== 'user' && (() => {
            const assignedUsers = users.filter(u => selectedType === 'department' ? u.department_id === selectedNode.id : u.branch_id === selectedNode.id)
            return (
              <div className="pt-6 border-t border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Assigned Employees ({assignedUsers.length})</h3>
                  <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(true)}>Assign</Button>
                </div>
                
                <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
                  {assignedUsers.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No employees assigned.</p>
                  ) : (
                    assignedUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-colors cursor-pointer" onClick={() => handleNodeClick(u, 'user')}>
                        <Avatar name={u.name} size="sm" url={u.avatar_url} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                          <p className="text-xs text-gray-500 truncate">{u.role_name || 'No Role'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-6 border-t border-gray-100 flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setDrawerMode('edit')}>Edit</Button>
                  <Button variant="danger" className="flex-1" onClick={handleDeleteEntity}>Delete</Button>
                </div>
              </div>
            )
          })()}
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
                <Select label="Manager" name="manager_id" defaultValue={entity.manager_id || ''}>
                  <option value="">Unassigned</option>
                  {users.filter(u => u.id !== entity.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
                <Select label="Department" name="department_id" defaultValue={entity.department_id || ''}>
                  <option value="">Unassigned</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                <Select label="Branch" name="branch_id" defaultValue={entity.branch_id || ''}>
                  <option value="">Unassigned</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </div>
            </div>
          ) : (
            <>
              <Input label={`${isDept ? 'Department' : 'Branch'} Name *`} name="name" defaultValue={entity.name} required />
              
              {isDept && (
                <Input label="Department Code" name="code" defaultValue={entity.code} placeholder="e.g. ENG-01" />
              )}
    
              {!isDept && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Location" name="location" defaultValue={entity.location} placeholder="City, Country" />
                  <Input label="Timezone" name="timezone" defaultValue={entity.timezone} placeholder="e.g. UTC, EST" />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <Select label="Parent" name="parent_id" defaultValue={entity.parent_id || ''}>
                  <option value="">None (Top Level)</option>
                  {(isDept ? departments : branches)
                    .filter(item => item.id !== entity.id)
                    .map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
                <Select label="Manager" name="manager_id" defaultValue={entity.manager_id || ''}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </div>
    
              {isDept && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea 
                    name="description" 
                    defaultValue={entity.description} 
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
