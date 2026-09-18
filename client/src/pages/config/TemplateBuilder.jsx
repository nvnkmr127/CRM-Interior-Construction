/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect, useMemo } from 'react'
import styles from './TemplateBuilder.module.css'
import { Button, Modal, Input, Select, Badge } from '../../components/ui'
import { useToast } from '../../store/toastContext'
import { configApi } from '../../api/config'
import api from '../../api/axios'
import { DEFAULT_PROJECT_TYPES } from '../../constants/projectTypes'
import { applyTemplate as applyTemplateApi } from '../../api/projects'

import { useConfirm } from '../../store/confirmContext';

export default function TemplateBuilder() {
  const { confirm } = useConfirm();
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('templates') // 'templates' | 'project_types'
  const [templates, setTemplates] = useState([])
  const [projectTypes, setProjectTypes] = useState(DEFAULT_PROJECT_TYPES)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [savingTypes, setSavingTypes] = useState(false)

  // Apply to Project modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [selectedTemplateForApply, setSelectedTemplateForApply] = useState(null)
  const [projectsList, setProjectsList] = useState([])
  const [targetProjectId, setTargetProjectId] = useState('')
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  // Form for new/editing project type
  const [newType, setNewType] = useState({ id: '', label: '', icon: '🛋️' })
  const [editingTypeId, setEditingTypeId] = useState(null)

  const [draft, setDraft] = useState({
    id: null, name: '', type: 'full_interior', desc: '',
    phases: []
  })

  useEffect(() => {
    fetchTemplates()
    fetchTenantProjectTypes()
  }, [])

  const fetchTenantProjectTypes = async () => {
    try {
      setLoadingConfig(true)
      const res = await api.get('/config/tenant-settings')
      const types = res.data?.data?.project_types || res.data?.project_types
      if (Array.isArray(types) && types.length > 0) {
        setProjectTypes(types)
      } else {
        setProjectTypes(DEFAULT_PROJECT_TYPES)
      }
    } catch (err) {
      console.warn('Using default project types:', err)
      setProjectTypes(DEFAULT_PROJECT_TYPES)
    } finally {
      setLoadingConfig(false)
    }
  }

  const openApplyModal = async (template) => {
    setSelectedTemplateForApply(template)
    setTargetProjectId('')
    setIsApplyModalOpen(true)
    try {
      setLoadingProjects(true)
      const res = await api.get('/projects?limit=100')
      const list = res.data?.data?.projects || res.data?.data || res.data?.projects || (Array.isArray(res.data) ? res.data : [])
      if (Array.isArray(list)) {
        setProjectsList(list)
        if (list.length > 0) {
          setTargetProjectId(list[0].id)
        }
      }
    } catch (err) {
      toast.error('Could not fetch project list')
    } finally {
      setLoadingProjects(false)
    }
  }

  const handleExecuteApplyTemplate = async () => {
    if (!targetProjectId) {
      return toast.error('Please select a project to apply the template')
    }
    if (!selectedTemplateForApply) return

    try {
      setApplyingTemplate(true)
      await applyTemplateApi(targetProjectId, selectedTemplateForApply.id)
      const matchedProj = projectsList.find(p => String(p.id) === String(targetProjectId))
      const projName = matchedProj?.name || 'Project'
      toast.success(`Template "${selectedTemplateForApply.name}" successfully applied to "${projName}"!`)
      setIsApplyModalOpen(false)
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to apply template to project')
    } finally {
      setApplyingTemplate(false)
    }
  }

  const saveProjectTypesToBackend = async (updatedList) => {
    try {
      setSavingTypes(true)
      await api.patch('/config/tenant-settings', {
        project_types: updatedList
      })
      setProjectTypes(updatedList)
      toast.success('Project types updated successfully!')
      setIsTypeModalOpen(false)
    } catch (err) {
      toast.error('Failed to update project types')
    } finally {
      setSavingTypes(false)
    }
  }

  const openTypeModal = (pt = null) => {
    if (pt) {
      setEditingTypeId(pt.id)
      setNewType({ id: pt.id, label: pt.label, icon: pt.icon || '📦' })
    } else {
      setEditingTypeId(null)
      setNewType({ id: '', label: '', icon: '🛋️' })
    }
    setIsTypeModalOpen(true)
  }

  const handleAddOrUpdateProjectType = async () => {
    if (!newType.label.trim()) {
      return toast.error('Project type name is required')
    }
    const generatedId = editingTypeId || newType.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_')
    
    let updatedList = []
    if (editingTypeId) {
      updatedList = projectTypes.map(t => t.id === editingTypeId ? { ...t, label: newType.label.trim(), icon: newType.icon || '📦' } : t)
    } else {
      if (projectTypes.some(t => t.id === generatedId)) {
        return toast.error('A project type with this ID already exists')
      }
      updatedList = [...projectTypes, { id: generatedId, label: newType.label.trim(), icon: newType.icon || '📦' }]
    }

    await saveProjectTypesToBackend(updatedList)
  }

  const handleDeleteProjectType = async (typeId) => {
    if (projectTypes.length <= 1) {
      return toast.error('You must keep at least one project type')
    }
    if (!await confirm(`Are you sure you want to remove this project type?`)) return

    const updatedList = projectTypes.filter(t => t.id !== typeId)
    await saveProjectTypesToBackend(updatedList)
  }

  const fetchTemplates = async () => {
    try {
      const data = await configApi.getTemplates()
      const formatted = data.map(t => {
        let parsedPhases = [];
        try {
          parsedPhases = typeof t.phases === 'string' ? JSON.parse(t.phases) : (t.phases || []);
        } catch(e) {
          console.error('Failed to parse phases for template', t.id, e);
        }
        return {
          id: t.id,
          name: t.name,
          type: t.project_type || 'full_interior',
          desc: t.description || '',
          phases: parsedPhases
        };
      })
      setTemplates(formatted)
    } catch (err) {
      toast.error('Failed to load templates')
    }
  }

  const openEditor = (tmpl = null) => {
    if (tmpl) {
      setDraft(JSON.parse(JSON.stringify(tmpl)))
    } else {
      setDraft({ id: null, name: '', type: projectTypes[0]?.id || 'full_interior', desc: '', phases: [] })
    }
    setIsModalOpen(true)
  }

  const addPhase = () => {
    setDraft({
      ...draft,
      phases: [...draft.phases, { id: Date.now().toString(), name: '', duration: 0, milestones: [] }]
    })
  }

  const addMilestone = (phaseIdx) => {
    const newPhases = [...draft.phases]
    newPhases[phaseIdx].milestones.push({ id: Date.now().toString(), name: '', triggersPayment: false })
    setDraft({ ...draft, phases: newPhases })
  }

  const saveTemplate = async () => {
    if (!draft.name) return toast.error('Template name required')
    
    const payload = {
      name: draft.name,
      project_type: draft.type,
      description: draft.desc,
      phases: draft.phases
    }

    try {
      if (draft.id) {
        await configApi.updateTemplate(draft.id, payload)
        toast.success('Template updated')
      } else {
        await configApi.createTemplate(payload)
        toast.success('Template created')
      }
      setIsModalOpen(false)
      fetchTemplates()
    } catch (err) {
      toast.error('Failed to save template')
    }
  }

  const deleteTemplate = async (id) => {
    if (!await confirm('Delete this template?')) return
    try {
      await configApi.deleteTemplate(id)
      setTemplates(templates.filter(x => x.id !== id))
      toast.success('Template deleted')
    } catch (err) {
      toast.error('Failed to delete template')
    }
  }

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.desc.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [templates, searchTerm, typeFilter]);

  // Overall Stats
  const totalPhasesCount = useMemo(() => templates.reduce((acc, t) => acc + t.phases.length, 0), [templates]);
  const totalMilestonesCount = useMemo(() => templates.reduce((acc, t) => acc + t.phases.reduce((pAcc, p) => pAcc + p.milestones.length, 0), 0), [templates]);

  return (
    <div className={`${styles.page} fade-in`}>
      {/* Top Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Project Setup & Templates</h1>
          <div style={{color:'var(--color-text-secondary)', marginTop: 4}} className="text-sm">
            Standardize your project delivery workflows, milestones, and custom project categories.
          </div>
        </div>
        {activeTab === 'templates' ? (
          <Button variant="primary" onClick={async () => openEditor()} className="flex items-center gap-2">
            <span>+</span> New Template
          </Button>
        ) : (
          <Button variant="primary" onClick={() => openTypeModal()} className="flex items-center gap-2">
            <span>+</span> Add Project Type
          </Button>
        )}
      </div>

      {/* KPI Overview Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)] flex items-center justify-center text-xl font-bold">
            📑
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-text)]">{templates.length}</div>
            <div className="text-xs text-[var(--color-text-secondary)] font-medium">Milestone Templates</div>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[var(--color-accent)] bg-opacity-10 text-[var(--color-accent)] flex items-center justify-center text-xl font-bold">
            🏷️
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-text)]">{projectTypes.length}</div>
            <div className="text-xs text-[var(--color-text-secondary)] font-medium">Project Types</div>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[var(--color-info)] bg-opacity-10 text-[var(--color-info)] flex items-center justify-center text-xl font-bold">
            ⏳
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-text)]">{totalPhasesCount}</div>
            <div className="text-xs text-[var(--color-text-secondary)] font-medium">Total Workflow Phases</div>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[var(--color-success)] bg-opacity-10 text-[var(--color-success)] flex items-center justify-center text-xl font-bold">
            🎯
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-text)]">{totalMilestonesCount}</div>
            <div className="text-xs text-[var(--color-text-secondary)] font-medium">Payment Milestones</div>
          </div>
        </div>
      </div>

      {/* Top Tab Switcher */}
      <div className="flex border-b border-[var(--color-border)] mb-6 gap-6">
        <button
          className={`pb-3 px-1 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
          onClick={() => setActiveTab('templates')}
        >
          <span>📑</span> Milestone Templates ({templates.length})
        </button>
        <button
          className={`pb-3 px-1 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'project_types'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
          onClick={() => setActiveTab('project_types')}
        >
          <span>🏷️</span> Project Types Config ({projectTypes.length})
        </button>
      </div>

      {/* TAB 1: MILESTONE TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Search templates by name..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-56">
              <Select
                options={[
                  { value: 'all', label: 'All Project Types' },
                  ...projectTypes.map(pt => ({ value: pt.id, label: `${pt.icon || ''} ${pt.label}`.trim() }))
                ]}
                value={typeFilter}
                onChange={v => setTypeFilter(v)}
              />
            </div>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-12 text-center text-[var(--color-text-secondary)]">
              <div className="text-3xl mb-2">📋</div>
              <div className="font-semibold text-base mb-1 text-[var(--color-text)]">No Templates Found</div>
              <div className="text-xs">Try adjusting your search query or filter, or create a new template.</div>
            </div>
          ) : (
            <div className={styles.templateList}>
              {filteredTemplates.map(t => {
                const totalMilestones = t.phases.reduce((acc, p) => acc + p.milestones.length, 0)
                const paymentMilestones = t.phases.reduce((acc, p) => acc + p.milestones.filter(m => m.triggersPayment).length, 0)
                const matchedType = projectTypes.find(pt => pt.id === t.type)
                const typeLabel = matchedType ? `${matchedType.icon || ''} ${matchedType.label}`.trim() : t.type.replace(/_/g, ' ')

                return (
                  <div key={t.id} className={`${styles.card} hover:-translate-y-0.5 transition-all hover:shadow-md border-t-4 border-t-[var(--color-primary)]`}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                      <div className={styles.cardName}>{t.name}</div>
                      <Badge variant="neutral">{typeLabel}</Badge>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] my-1">
                      <span className="bg-[var(--color-surface-2)] px-2 py-1 rounded border border-[var(--color-border)]">
                        ⏱️ {t.phases.length} Phases
                      </span>
                      <span className="bg-[var(--color-surface-2)] px-2 py-1 rounded border border-[var(--color-border)]">
                        🎯 {totalMilestones} Milestones
                      </span>
                      {paymentMilestones > 0 && (
                        <span className="bg-[var(--color-success)] bg-opacity-10 text-[var(--color-success)] px-2 py-1 rounded border border-[var(--color-success)] border-opacity-20 font-semibold">
                          ₹ {paymentMilestones} Paid
                        </span>
                      )}
                    </div>

                    <p style={{fontSize: 'var(--text-sm)', color:'var(--color-text-secondary)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
                      {t.desc || 'No description provided for this template.'}
                    </p>
                    
                    <div className={styles.cardActions}>
                      <Button variant="ghost" size="sm" onClick={async () => openEditor(t)}>Edit</Button>
                      <Button variant="ghost" size="sm" style={{color:'var(--color-danger)'}} onClick={async () => deleteTemplate(t.id)}>Delete</Button>
                      <Button variant="secondary" size="sm" style={{marginLeft:'auto'}} onClick={() => openApplyModal(t)}>Apply to Project</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROJECT TYPES CONFIG */}
      {activeTab === 'project_types' && (
        <div className="space-y-6">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-[var(--color-border)] pb-4">
              <div>
                <h3 className="font-bold text-lg text-[var(--color-text)] flex items-center gap-2">
                  <span>🏷️</span> Configured Project Types
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Custom project categories (such as <em>Living & Dining Rooms</em>, <em>Full Interior</em>, etc.) populate across Lead Conversion, Project Creation, and Delivery Templates.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => openTypeModal()} className="flex items-center gap-1.5 self-start sm:self-auto">
                <span>+</span> Add Project Type
              </Button>
            </div>

            {loadingConfig ? (
              <div className="text-sm text-[var(--color-text-secondary)]">Loading project types...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {projectTypes.map(pt => (
                  <div key={pt.id} className="border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-surface)] flex items-center justify-between shadow-xs hover:border-[var(--color-primary)] hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2.5 bg-[var(--color-surface-2)] rounded-lg border border-[var(--color-border)] shadow-xs">
                        {pt.icon || '📦'}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-[var(--color-text)]">{pt.label}</div>
                        <div className="text-xs text-[var(--color-text-secondary)] font-mono">ID: {pt.id}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openTypeModal(pt)}
                        title="Edit Project Type"
                      >
                        ✏️
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[var(--color-danger)]"
                        onClick={() => handleDeleteProjectType(pt.id)}
                        title="Delete Project Type"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL FOR APPLYING TEMPLATE TO A PROJECT */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Apply Template to Project"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsApplyModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleExecuteApplyTemplate} disabled={applyingTemplate || !targetProjectId}>
              {applyingTemplate ? 'Applying...' : 'Apply Template'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2 text-sm">
          {selectedTemplateForApply && (
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-3">
              <span className="text-xs text-[var(--color-text-secondary)] block mb-1 uppercase font-bold tracking-wider">Template Selected</span>
              <div className="font-bold text-[var(--color-text)]">{selectedTemplateForApply.name}</div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                {selectedTemplateForApply.phases.length} Phases • {selectedTemplateForApply.phases.reduce((acc, p) => acc + p.milestones.length, 0)} Milestones
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">Select Target Project *</label>
            {loadingProjects ? (
              <div className="text-xs text-[var(--color-text-secondary)] py-2">Loading active projects...</div>
            ) : (
              <Select
                options={projectsList.map(p => ({
                  value: p.id,
                  label: `${p.name} (${p.client_name || 'Client'})`
                }))}
                value={targetProjectId}
                onChange={v => setTargetProjectId(v)}
              />
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs">
            <strong>Note:</strong> Applying this template will populate all defined phases and milestones directly into the selected project's milestone schedule.
          </div>
        </div>
      </Modal>

      {/* MODAL FOR PROJECT TYPE CREATION / EDITING */}
      <Modal
        isOpen={isTypeModalOpen}
        onClose={() => setIsTypeModalOpen(false)}
        title={editingTypeId ? 'Edit Project Type' : 'Add New Project Type'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsTypeModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddOrUpdateProjectType} disabled={savingTypes}>
              {savingTypes ? 'Saving...' : (editingTypeId ? 'Update Project Type' : 'Save Project Type')}
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <Input
            label="Project Type Name *"
            placeholder="e.g. Living & Dining Rooms"
            value={newType.label}
            onChange={e => setNewType({ ...newType, label: e.target.value })}
          />
          <Input
            label="Icon / Emoji"
            placeholder="e.g. 🛋️"
            value={newType.icon}
            onChange={e => setNewType({ ...newType, icon: e.target.value })}
          />
        </div>
      </Modal>

      {/* MODAL FOR TEMPLATES */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={draft.id ? 'Edit Template' : 'New Template'}
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={async () => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveTemplate}>Save Template</Button>
          </>
        }
      >
        <div className={styles.modalBody}>
          <div className={styles.leftCol}>
            <div style={{display:'flex', gap:16}}>
              <div style={{flex:2}}><Input label="Template Name *" value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} /></div>
              <div style={{flex:1}}>
                <Select
                  label="Type"
                  options={projectTypes.map(pt => ({ value: pt.id, label: `${pt.icon || ''} ${pt.label}`.trim() }))}
                  value={draft.type}
                  onChange={v => setDraft({...draft, type: v})}
                />
              </div>
            </div>
            
            <div style={{display:'flex', flexDirection:'column', gap:4}}>
              <label style={{fontSize:'var(--text-sm)', fontWeight:500}}>Description</label>
              <textarea style={{width:'100%', minHeight:60, padding:8, borderRadius:4, border:'1px solid var(--color-border)'}} value={draft.desc} onChange={e => setDraft({...draft, desc: e.target.value})} />
            </div>

            <div className={styles.sectionTitle} style={{marginTop: 16}}>Phases</div>
            {draft.phases.map((p, pIdx) => (
              <div key={p.id} className={styles.phaseBlock}>
                <div className={styles.phaseHeader}>
                  <div className={styles.dragHandle}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="6" cy="4" r="1.5"/><circle cx="6" cy="8" r="1.5"/><circle cx="6" cy="12" r="1.5"/>
                      <circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="8" r="1.5"/><circle cx="10" cy="12" r="1.5"/>
                    </svg>
                  </div>
                  <div style={{flex:2}}><Input placeholder="Phase Name" value={p.name} onChange={e => { const np = [...draft.phases]; np[pIdx].name = e.target.value; setDraft({...draft, phases: np}) }} /></div>
                  <div style={{flex:1}}><Input type="number" placeholder="Days" value={p.duration} onChange={e => { const np = [...draft.phases]; np[pIdx].duration = parseInt(e.target.value); setDraft({...draft, phases: np}) }} /></div>
                  <Button variant="ghost" size="sm" onClick={async () => setDraft({...draft, phases: draft.phases.filter((_, i) => i !== pIdx)})}>✕</Button>
                </div>
                
                <div className={styles.phaseContent}>
                  <div className={styles.milestoneList}>
                    {p.milestones.map((m, mIdx) => (
                      <div key={m.id} className={styles.milestoneRow}>
                        <div style={{flex:1}}>
                          <Input placeholder="Milestone Name" value={m.name} onChange={e => { const np = [...draft.phases]; np[pIdx].milestones[mIdx].name = e.target.value; setDraft({...draft, phases: np}) }} />
                        </div>
                        <div 
                          className={`${styles.paymentToggle} ${m.triggersPayment ? styles.active : ''}`}
                          onClick={async () => { const np = [...draft.phases]; np[pIdx].milestones[mIdx].triggersPayment = !m.triggersPayment; setDraft({...draft, phases: np}) }}
                        >
                          ₹ Triggers Payment
                        </div>
                        <Button variant="ghost" size="sm" onClick={async () => { const np = [...draft.phases]; np[pIdx].milestones = np[pIdx].milestones.filter((_, i) => i !== mIdx); setDraft({...draft, phases: np}) }}>✕</Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={async () => addMilestone(pIdx)} style={{alignSelf:'flex-start'}}>+ Add Milestone</Button>
                </div>
              </div>
            ))}
            
            <Button variant="secondary" onClick={addPhase} style={{alignSelf:'flex-start'}}>+ Add Phase</Button>
          </div>

          <div className={styles.rightCol}>
            <div className={styles.sectionTitle}>Preview</div>
            <div className={styles.previewTimeline}>
              {draft.phases.length === 0 ? <div style={{color:'var(--color-text-muted)', fontSize:13}}>No phases added yet.</div> : null}
              {draft.phases.map(p => (
                <div key={p.id} className={styles.previewPhase}>
                  <div className={styles.previewPhaseName}>{p.name || 'Untitled Phase'}</div>
                  <div className={styles.previewDuration}>{p.duration || 0} days</div>
                  
                  {p.milestones.map(m => (
                    <div key={m.id} className={styles.previewMilestone}>
                      <span style={{color:'var(--color-border-strong)'}}>└</span> {m.name || 'Untitled Milestone'}
                      {m.triggersPayment && <span className={styles.previewMilestonePay}>₹ Payment</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

