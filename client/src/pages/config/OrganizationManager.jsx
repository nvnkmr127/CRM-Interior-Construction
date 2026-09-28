import { useState, useEffect } from 'react'
import { orgApi } from '../../api/org'
import { useToast } from '../../store/toastContext'
import { Button, Input, Select, Avatar, Modal } from '../../components/ui'
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
      <div style={{ position: 'relative', width: '280px' }}>
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
      </div>

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
  
  // Reporting Structure History (for Back to Old Structure)
  const [structureHistory, setStructureHistory] = useState([])
  const [isReverting, setIsReverting] = useState(false)
  
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

  // Add Department Pop-up Form Modal State
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false)
  const [deptFormData, setDeptFormData] = useState({
    name: '',
    code: '',
    parent_id: '',
    manager_id: '',
    description: ''
  })

  // Add Branch Pop-up Form Modal State
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false)
  const [branchFormData, setBranchFormData] = useState({
    name: '',
    location: '',
    timezone: 'Asia/Kolkata',
    parent_id: '',
    manager_id: ''
  })

  // Department Details Pop-up Modal State
  const [isDeptDetailsModalOpen, setIsDeptDetailsModalOpen] = useState(false)
  const [deptDetailsMode, setDeptDetailsMode] = useState('view') // 'view' or 'edit'

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
      const isSuper = ['superadmin', 'super admin', 'owner', 'super_admin'].includes(item.role_name?.toLowerCase())
      // Super Admin is top authority and must never be nested under other employees
      const parentId = isSuper ? null : item[parentKey]
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
    
    // Sort roots so Super Admin / Owner always appears at the very top of the hierarchy!
    roots.sort((a, b) => {
      const aIsSuper = ['superadmin', 'super admin', 'owner', 'super_admin'].includes(a.role_name?.toLowerCase()) ? 1 : 0
      const bIsSuper = ['superadmin', 'super admin', 'owner', 'super_admin'].includes(b.role_name?.toLowerCase()) ? 1 : 0
      return bIsSuper - aIsSuper
    })

    return roots
  }

  const isUserAncestor = (potentialAncestorId, targetManagerId) => {
    let currId = targetManagerId
    const visited = new Set()
    while (currId) {
      if (currId === potentialAncestorId) return true
      if (visited.has(currId)) break
      visited.add(currId)
      const managerUser = users.find(u => u.id === currId)
      currId = managerUser ? managerUser.manager_id : null
    }
    return false
  }

  // ---- Drag Handlers ----
  const handleDropNode = async (draggedId, newParentId, type) => {
    try {
      if (type === 'user') {
        const currentTarget = users.find(u => u.id === draggedId)
        if (!currentTarget || currentTarget.manager_id === newParentId) return
        
        const isTargetSuper = ['superadmin', 'super admin', 'owner', 'super_admin'].includes(currentTarget.role_name?.toLowerCase())
        if (isTargetSuper && newParentId) {
          toast.error('Super Admin / Owner is the top organizational authority and cannot report to any employee.')
          return
        }

        if (isUserAncestor(draggedId, newParentId)) {
          toast.error('Cannot move a manager under their own report (Circular reporting)')
          return
        }

        const oldManager = users.find(u => u.id === currentTarget.manager_id)
        const newManager = users.find(u => u.id === newParentId)
        
        await orgApi.updateUserOrgInfo(draggedId, { manager_id: newParentId })

        // Push previous reporting line to history only on success
        setStructureHistory(prev => [
          ...prev,
          {
            userId: draggedId,
            userName: currentTarget.name,
            oldManagerId: currentTarget.manager_id || null,
            oldManagerName: oldManager ? oldManager.name : 'Top Level / Direct',
            newManagerId: newParentId,
            newManagerName: newManager ? newManager.name : 'Top Level / Direct',
            timestamp: Date.now()
          }
        ])

        setUsers(prev => prev.map(u => u.id === draggedId ? { ...u, manager_id: newParentId } : u))
        toast.success(`${currentTarget.name} reporting to ${newManager ? newManager.name : 'Top Level'}`)
        setExpandedNodes(prev => new Set(prev).add(newParentId))
        loadData()
        return
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

  // ---- Revert to Old Structure Handlers ----
  const handleBackToOldStructure = async () => {
    if (structureHistory.length === 0 || isReverting) return
    const lastChange = structureHistory[structureHistory.length - 1]
    setIsReverting(true)
    try {
      await orgApi.updateUserOrgInfo(lastChange.userId, { manager_id: lastChange.oldManagerId || null })
      setUsers(prev => prev.map(u => u.id === lastChange.userId ? { ...u, manager_id: lastChange.oldManagerId || null } : u))
      setStructureHistory(prev => prev.slice(0, -1))
      if (lastChange.oldManagerId) {
        setExpandedNodes(prev => new Set(prev).add(lastChange.oldManagerId))
      }
      toast.success(`Restored ${lastChange.userName} back under ${lastChange.oldManagerName}`)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to revert structure')
      loadData()
    } finally {
      setIsReverting(false)
    }
  }

  const handleRevertAllToOriginal = async () => {
    if (structureHistory.length === 0 || isReverting) return
    if (!confirm(`Revert all ${structureHistory.length} reporting structure changes back to the original structure?`)) return
    setIsReverting(true)
    try {
      for (let i = structureHistory.length - 1; i >= 0; i--) {
        const change = structureHistory[i]
        await orgApi.updateUserOrgInfo(change.userId, { manager_id: change.oldManagerId || null })
      }
      setStructureHistory([])
      toast.success('Successfully reverted back to original reporting structure')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to revert all changes')
      loadData()
    } finally {
      setIsReverting(false)
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
          const oldManagerId = selectedNode.manager_id || null
          const newManagerId = data.manager_id || null
          
          if (newManagerId && isUserAncestor(selectedNode.id, newManagerId)) {
            toast.error('Cannot set manager: Circular reporting detected')
            return
          }
          
          await orgApi.updateUserOrgInfo(selectedNode.id, data)

          if (oldManagerId !== newManagerId) {
            const oldManager = users.find(u => u.id === oldManagerId)
            const newManager = users.find(u => u.id === newManagerId)
            setStructureHistory(prev => [
              ...prev,
              {
                userId: selectedNode.id,
                userName: selectedNode.name,
                oldManagerId: oldManagerId,
                oldManagerName: oldManager ? oldManager.name : 'Top Level / Direct',
                newManagerId: newManagerId,
                newManagerName: newManager ? newManager.name : 'Top Level / Direct',
                timestamp: Date.now()
              }
            ])
          }
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

    if (type === 'department') {
      setDeptDetailsMode('view')
      setIsDeptDetailsModalOpen(true)
      return
    }

    setDrawerMode('view')
    setIsDrawerOpen(true)
  }

  const handleUpdateDepartment = async (e) => {
    e.preventDefault()
    if (!formData.name?.trim()) {
      toast.error('Department name is required')
      return
    }

    const data = {
      name: formData.name.trim(),
      code: formData.code ? formData.code.trim() : null,
      parent_id: formData.parent_id || null,
      manager_id: formData.manager_id || null,
      description: formData.description ? formData.description.trim() : null
    }

    try {
      await orgApi.updateDepartment(selectedNode.id, data)
      toast.success('Department updated successfully')
      setIsDeptDetailsModalOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update department')
    }
  }

  const handleDeleteDepartmentFromModal = async () => {
    if (!confirm(`Are you sure you want to delete the "${selectedNode?.name}" department?`)) return
    try {
      await orgApi.deleteDepartment(selectedNode.id)
      toast.success('Department deleted')
      setIsDeptDetailsModalOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to delete department')
    }
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

  const openAddDepartmentModal = () => {
    setDeptFormData({
      name: '',
      code: '',
      parent_id: '',
      manager_id: '',
      description: ''
    })
    setIsAddDeptModalOpen(true)
  }

  const handleCreateDepartment = async (e) => {
    e.preventDefault()
    if (!deptFormData.name?.trim()) {
      toast.error('Department name is required')
      return
    }

    const data = {
      name: deptFormData.name.trim(),
      code: deptFormData.code ? deptFormData.code.trim() : null,
      parent_id: deptFormData.parent_id || null,
      manager_id: deptFormData.manager_id || null,
      description: deptFormData.description ? deptFormData.description.trim() : null
    }

    try {
      await orgApi.createDepartment(data)
      toast.success('Department created successfully')
      setIsAddDeptModalOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to create department')
    }
  }

  const openAddBranchModal = () => {
    setBranchFormData({
      name: '',
      location: '',
      timezone: 'Asia/Kolkata',
      parent_id: '',
      manager_id: ''
    })
    setIsAddBranchModalOpen(true)
  }

  const handleCreateBranch = async (e) => {
    e.preventDefault()
    if (!branchFormData.name?.trim()) {
      toast.error('Branch name is required')
      return
    }

    const data = {
      name: branchFormData.name.trim(),
      location: branchFormData.location ? branchFormData.location.trim() : null,
      timezone: branchFormData.timezone ? branchFormData.timezone.trim() : 'Asia/Kolkata',
      parent_id: branchFormData.parent_id || null,
      manager_id: branchFormData.manager_id || null
    }

    try {
      await orgApi.createBranch(data)
      toast.success('Branch created successfully')
      setIsAddBranchModalOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to create branch')
    }
  }

  // ---- Enhanced Search Filter Logic for all 3 Tabs ----
  const searchLower = search.trim().toLowerCase()
  
  const filteredUsers = searchLower 
    ? users.filter(u => 
        (u.name && u.name.toLowerCase().includes(searchLower)) ||
        (u.role_name && u.role_name.toLowerCase().includes(searchLower)) ||
        (u.email && u.email.toLowerCase().includes(searchLower)) ||
        (u.department_name && u.department_name.toLowerCase().includes(searchLower)) ||
        (u.branch_name && u.branch_name.toLowerCase().includes(searchLower))
      )
    : users
  const userTreeRoots = buildTree(filteredUsers, 'manager_id')

  const filteredDepartments = searchLower 
    ? departments.filter(d => 
        (d.name && d.name.toLowerCase().includes(searchLower)) || 
        (d.code && d.code.toLowerCase().includes(searchLower)) ||
        (d.manager_name && d.manager_name.toLowerCase().includes(searchLower)) ||
        (d.description && d.description.toLowerCase().includes(searchLower))
      ) 
    : departments
  const departmentTreeRoots = buildTree(filteredDepartments, 'parent_id')

  const filteredBranches = searchLower 
    ? branches.filter(b => 
        (b.name && b.name.toLowerCase().includes(searchLower)) || 
        (b.location && b.location.toLowerCase().includes(searchLower)) ||
        (b.manager_name && b.manager_name.toLowerCase().includes(searchLower)) ||
        (b.timezone && b.timezone.toLowerCase().includes(searchLower))
      ) 
    : branches
  const branchTreeRoots = buildTree(filteredBranches, 'parent_id')

  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case 'users':
        return 'Search members by name, role or email...'
      case 'departments':
        return 'Search departments by name, code or head...'
      case 'branches':
        return 'Search branches by name, location or manager...'
      default:
        return 'Search...'
    }
  }

  const getMatchCount = () => {
    if (!search.trim()) return null
    if (activeTab === 'users') return filteredUsers.length
    if (activeTab === 'departments') return filteredDepartments.length
    if (activeTab === 'branches') return filteredBranches.length
    return null
  }

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
                {['superadmin', 'super admin', 'owner', 'super_admin'].includes(entity.role_name?.toLowerCase()) ? (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900 leading-relaxed flex items-center gap-2">
                    <span className="text-base">👑</span>
                    <span><strong>Super Admin / Owner:</strong> Holds apex organizational authority and does not report to any subordinate role.</span>
                  </div>
                ) : (
                  <Select 
                    label="Manager" 
                    options={[
                      { value: '', label: 'Unassigned (Top Level)' },
                      ...users.filter(u => u.id !== entity.id).map(u => ({ value: u.id, label: u.name }))
                    ]}
                    value={formData.manager_id}
                    onChange={v => setFormData(p => ({ ...p, manager_id: v }))}
                  />
                )}
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
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => drawerMode === 'edit' && selectedNode ? setDrawerMode('view') : setIsDrawerOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">Save {isUser ? 'Assignment' : (isDept ? 'Department' : 'Branch')}</Button>
          </div>
        </form>
      )
    }
    return null
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
        
        {/* Header - scrolls naturally with page */}
        <div className={layoutStyles.sectionHeader} style={{ margin: 0, padding: '16px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className={layoutStyles.sectionTitle}>Organization Architecture</h2>
            <p className={layoutStyles.sectionDesc}>Visualize and manage CRM reporting lines, departments, and regional branches.</p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'users' && (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleBackToOldStructure} 
                  disabled={structureHistory.length === 0 || isReverting}
                  className={`flex items-center gap-2 text-sm font-medium transition-all ${
                    structureHistory.length > 0 
                      ? 'border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100 shadow-sm' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  title={
                    structureHistory.length > 0 
                      ? `Revert: ${structureHistory[structureHistory.length - 1].userName} back under ${structureHistory[structureHistory.length - 1].oldManagerName}` 
                      : 'No previous changes to revert'
                  }
                >
                  <span>↶</span>
                  <span>{isReverting ? 'Reverting...' : 'Back to Old Structure'}</span>
                  {structureHistory.length > 0 && (
                    <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                      {structureHistory.length}
                    </span>
                  )}
                </Button>
                {structureHistory.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRevertAllToOriginal}
                    disabled={isReverting}
                    className="text-xs text-gray-500 hover:text-red-600"
                    title="Revert all changes back to initial state"
                  >
                    Reset All
                  </Button>
                )}
              </div>
            )}
            {activeTab === 'departments' && (
              <Button variant="primary" onClick={openAddDepartmentModal} className="flex items-center gap-2">
                ➕ Add Department
              </Button>
            )}
            {activeTab === 'branches' && (
              <Button variant="primary" onClick={openAddBranchModal} className="flex items-center gap-2">
                ➕ Add Branch
              </Button>
            )}
          </div>
        </div>

        {/* Tabs & Search - scrolls naturally with page */}
        <div className="px-6 pt-4 flex flex-col sm:flex-row justify-between items-end gap-4 border-b border-gray-200">
          <div className="flex gap-6 overflow-x-auto w-full sm:w-auto no-scrollbar">
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

          <div className="pb-3 w-full sm:w-80">
            <div className={orgStyles.searchBarContainer}>
              <span className={orgStyles.searchBarIcon}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input 
                type="text"
                placeholder={getSearchPlaceholder()} 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className={orgStyles.searchBarInput}
              />
              {getMatchCount() !== null && (
                <span className={orgStyles.searchBadge}>
                  {getMatchCount()} {getMatchCount() === 1 ? 'match' : 'matches'}
                </span>
              )}
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className={orgStyles.searchClearBtn}
                  title="Clear search"
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Area - Visual Org Chart */}
        <div className="bg-slate-50 relative" style={{ minHeight: '600px', width: '100%' }}>
          
          {/* Revert to Old Structure notification banner */}
          {activeTab === 'users' && structureHistory.length > 0 && (
            <div className="px-6 pt-6">
              <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 text-xs flex flex-wrap justify-between items-center rounded-lg shadow-sm gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 font-bold">ℹ️</span>
                  <span>
                    Reporting structure updated ({structureHistory.length} {structureHistory.length === 1 ? 'change' : 'changes'}). Last moved: <strong>{structureHistory[structureHistory.length - 1].userName}</strong> under <strong>{structureHistory[structureHistory.length - 1].newManagerName}</strong>.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleBackToOldStructure}
                    disabled={isReverting}
                    className="font-semibold text-amber-800 hover:text-amber-950 underline flex items-center gap-1 cursor-pointer"
                  >
                    ↶ Back to Old Structure
                  </button>
                  {structureHistory.length > 1 && (
                    <button 
                      onClick={handleRevertAllToOriginal}
                      disabled={isReverting}
                      className="text-gray-500 hover:text-red-700 underline cursor-pointer"
                    >
                      Revert All
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className={orgStyles.orgTreeWrapper}>
            <div className={orgStyles.orgTree}>
              {/* USERS TREE */}
              {activeTab === 'users' && (
                userTreeRoots.length === 0 ? (
                  search.trim() ? (
                    <div className={orgStyles.emptySearchState}>
                      <span className={orgStyles.emptySearchIcon}>🔍</span>
                      <h4 className={orgStyles.emptySearchTitle}>No matching team members found</h4>
                      <p className={orgStyles.emptySearchDesc}>No members match "{search}". Try searching by another name, role, or email.</p>
                      <Button variant="outline" size="sm" onClick={() => setSearch('')} className="mt-4">
                        Clear Search
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-12">No users found.</div>
                  )
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
                  search.trim() ? (
                    <div className={orgStyles.emptySearchState}>
                      <span className={orgStyles.emptySearchIcon}>🏢</span>
                      <h4 className={orgStyles.emptySearchTitle}>No matching departments found</h4>
                      <p className={orgStyles.emptySearchDesc}>No departments match "{search}". Try searching by another department name or code.</p>
                      <Button variant="outline" size="sm" onClick={() => setSearch('')} className="mt-4">
                        Clear Search
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-12">No departments found.</div>
                  )
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
                  search.trim() ? (
                    <div className={orgStyles.emptySearchState}>
                      <span className={orgStyles.emptySearchIcon}>📍</span>
                      <h4 className={orgStyles.emptySearchTitle}>No matching branches found</h4>
                      <p className={orgStyles.emptySearchDesc}>No branches match "{search}". Try searching by another branch name or location.</p>
                      <Button variant="outline" size="sm" onClick={() => setSearch('')} className="mt-4">
                        Clear Search
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-12">No branches found.</div>
                  )
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
      </div>

      {/* Pop-up Modal for Details/Edit (Users, Branches, etc.) */}
      <Modal
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={
          drawerMode === 'view' ? `${selectedNode?.name || ''} Details` : 
          drawerMode === 'edit' ? `Edit ${selectedType ? (selectedType.charAt(0).toUpperCase() + selectedType.slice(1)) : ''}` : `New ${selectedType ? (selectedType.charAt(0).toUpperCase() + selectedType.slice(1)) : ''}`
        }
        size="lg"
      >
        <div className="p-2 sm:p-4">
          {renderDrawerContent()}
        </div>
      </Modal>

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

      {/* Add Department Pop-up Form Modal */}
      <Modal
        isOpen={isAddDeptModalOpen}
        onClose={() => setIsAddDeptModalOpen(false)}
        title="Add Department"
        size="md"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button type="button" variant="ghost" onClick={() => setIsAddDeptModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-department-form" variant="primary">
              Create Department
            </Button>
          </div>
        }
      >
        <form id="add-department-form" onSubmit={handleCreateDepartment} className="space-y-4">
          <Input 
            label="Department Name *" 
            placeholder="e.g. Interior Design, Civil Works"
            value={deptFormData.name} 
            onChange={e => setDeptFormData(p => ({ ...p, name: e.target.value }))}
            required 
            autoFocus
          />
          
          <Input 
            label="Department Code" 
            placeholder="e.g. DES-01, CIV-02" 
            value={deptFormData.code} 
            onChange={e => setDeptFormData(p => ({ ...p, code: e.target.value }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select 
              label="Parent Department" 
              options={[
                { value: '', label: 'None (Top Level)' },
                ...departments.map(d => ({ value: d.id, label: d.name }))
              ]}
              value={deptFormData.parent_id}
              onChange={v => setDeptFormData(p => ({ ...p, parent_id: v }))}
            />

            <Select 
              label="Department Head / Manager" 
              options={[
                { value: '', label: 'Unassigned' },
                ...users.map(u => ({ value: u.id, label: u.name }))
              ]}
              value={deptFormData.manager_id}
              onChange={v => setDeptFormData(p => ({ ...p, manager_id: v }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea 
              placeholder="Brief description of the department's role and responsibilities..."
              value={deptFormData.description} 
              onChange={e => setDeptFormData(p => ({ ...p, description: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border" 
              rows={3}
            />
          </div>
        </form>
      </Modal>

      {/* Add Branch Pop-up Form Modal */}
      <Modal
        isOpen={isAddBranchModalOpen}
        onClose={() => setIsAddBranchModalOpen(false)}
        title="Add Branch"
        size="md"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button type="button" variant="ghost" onClick={() => setIsAddBranchModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-branch-form" variant="primary">
              Create Branch
            </Button>
          </div>
        }
      >
        <form id="add-branch-form" onSubmit={handleCreateBranch} className="space-y-4">
          <Input 
            label="Branch Name *" 
            placeholder="e.g. Downtown Studio, North Regional Hub"
            value={branchFormData.name} 
            onChange={e => setBranchFormData(p => ({ ...p, name: e.target.value }))}
            required 
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input 
              label="Location" 
              placeholder="City, Country" 
              value={branchFormData.location} 
              onChange={e => setBranchFormData(p => ({ ...p, location: e.target.value }))}
            />
            <Input 
              label="Timezone" 
              placeholder="e.g. Asia/Kolkata, UTC" 
              value={branchFormData.timezone} 
              onChange={e => setBranchFormData(p => ({ ...p, timezone: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select 
              label="Parent Branch" 
              options={[
                { value: '', label: 'None (Top Level)' },
                ...branches.map(b => ({ value: b.id, label: b.name }))
              ]}
              value={branchFormData.parent_id}
              onChange={v => setBranchFormData(p => ({ ...p, parent_id: v }))}
            />

            <Select 
              label="Branch Head / Manager" 
              options={[
                { value: '', label: 'Unassigned' },
                ...users.map(u => ({ value: u.id, label: u.name }))
              ]}
              value={branchFormData.manager_id}
              onChange={v => setBranchFormData(p => ({ ...p, manager_id: v }))}
            />
          </div>
        </form>
      </Modal>

      {/* Department Details & Edit Pop-up Modal */}
      {selectedNode && selectedType === 'department' && (
        <Modal
          isOpen={isDeptDetailsModalOpen}
          onClose={() => setIsDeptDetailsModalOpen(false)}
          title={deptDetailsMode === 'edit' ? `Edit Department: ${selectedNode.name}` : `${selectedNode.name} Details`}
          size="lg"
          footer={
            deptDetailsMode === 'edit' ? (
              <div className="flex gap-3 justify-end w-full">
                <Button variant="ghost" onClick={() => setDeptDetailsMode('view')}>
                  Cancel
                </Button>
                <Button type="submit" form="edit-department-form" variant="primary">
                  Save Changes
                </Button>
              </div>
            ) : (
              <div className="flex justify-between items-center w-full">
                <Button variant="danger" size="sm" onClick={handleDeleteDepartmentFromModal}>
                  Delete Department
                </Button>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setIsDeptDetailsModalOpen(false)}>
                    Close
                  </Button>
                  <Button variant="primary" onClick={() => setDeptDetailsMode('edit')}>
                    Edit Department
                  </Button>
                </div>
              </div>
            )
          }
        >
          {deptDetailsMode === 'edit' ? (
            <form id="edit-department-form" onSubmit={handleUpdateDepartment} className="space-y-4">
              <Input 
                label="Department Name *" 
                value={formData.name} 
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                required 
                autoFocus
              />
              
              <Input 
                label="Department Code" 
                placeholder="e.g. ID-01, DES-01" 
                value={formData.code} 
                onChange={e => setFormData(p => ({ ...p, code: e.target.value }))}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select 
                  label="Parent Department" 
                  options={[
                    { value: '', label: 'None (Top Level)' },
                    ...departments
                      .filter(d => d.id !== selectedNode.id)
                      .map(d => ({ value: d.id, label: d.name }))
                  ]}
                  value={formData.parent_id}
                  onChange={v => setFormData(p => ({ ...p, parent_id: v }))}
                />

                <Select 
                  label="Department Head / Manager" 
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...users.map(u => ({ value: u.id, label: u.name }))
                  ]}
                  value={formData.manager_id}
                  onChange={v => setFormData(p => ({ ...p, manager_id: v }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  placeholder="Department description..."
                  value={formData.description} 
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-2.5 border" 
                  rows={3}
                />
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Header Card Summary */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
                <Avatar name={selectedNode.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900 truncate">{selectedNode.name}</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      DEPARTMENT
                    </span>
                  </div>
                  {selectedNode.code && (
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Code: {selectedNode.code}</p>
                  )}
                </div>
              </div>

              {/* Key Info Cards */}
              {(() => {
                const assignedUsers = users.filter(u => u.department_id === selectedNode.id)
                const currentHeadName = selectedNode.manager_name || users.find(u => u.id === selectedNode.manager_id)?.name || 'Unassigned'
                const parentDeptName = departments.find(d => d.id === selectedNode.parent_id)?.name || 'None (Top Level)'

                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-100">
                        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Head / Manager</span>
                        <span className="font-semibold text-gray-900 text-sm">{currentHeadName}</span>
                      </div>
                      <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-100">
                        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Headcount</span>
                        <span className="font-semibold text-gray-900 text-sm">{assignedUsers.length} {assignedUsers.length === 1 ? 'member' : 'members'}</span>
                      </div>
                      <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-100">
                        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Parent Division</span>
                        <span className="font-semibold text-gray-900 text-sm truncate block" title={parentDeptName}>{parentDeptName}</span>
                      </div>
                    </div>

                    {selectedNode.description && (
                      <div className="bg-gray-50 p-3.5 rounded-lg border border-gray-100">
                        <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</span>
                        <p className="text-sm text-gray-700 leading-relaxed">{selectedNode.description}</p>
                      </div>
                    )}

                    {/* Assigned Employees List */}
                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-bold text-gray-900">
                          Assigned Employees ({assignedUsers.length})
                        </h4>
                        <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(true)}>
                          + Assign Staff
                        </Button>
                      </div>

                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 border border-gray-100 rounded-lg p-2 bg-white">
                        {assignedUsers.length === 0 ? (
                          <div className="py-6 text-center text-sm text-gray-400 italic">
                            No employees assigned to this department yet.
                          </div>
                        ) : (
                          assignedUsers.map(u => (
                            <div key={u.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md transition-colors">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
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
                                    await orgApi.updateUserOrgInfo(u.id, { department_id: null })
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
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
