/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import layoutStyles from './ConfigLayout.module.css';
import styles from './TradeActivityTemplatesManager.module.css';
import { Button, Input } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import { configApi } from '../../api/config';


const TRADES = [
  { id: 'civil', label: 'Civil Work' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'false_ceiling', label: 'False Ceiling' },
  { id: 'flooring', label: 'Flooring' },
  { id: 'painting', label: 'Painting' },
  { id: 'carpentry', label: 'Carpentry' },
  { id: 'glass', label: 'Glass Work' },
  { id: 'soft_furnishing', label: 'Soft Furnishing' }
];

const ROOM_TYPES = ['General', 'Kitchen', 'Bedroom', 'Bathroom', 'Living Room'];

export default function TradeActivityTemplatesManager() {
  const [templates, setTemplates] = useState([]);
  const [selectedTrade, setSelectedTrade] = useState('civil');
  const [selectedRoomType, setSelectedRoomType] = useState('General');
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState('activities'); // 'activities' or 'dependencies'

  // Dependencies states
  const [dependencyTemplates, setDependencyTemplates] = useState([]);
  const [depTrade, setDepTrade] = useState('painting');
  const [depDependsOnTrade, setDepDependsOnTrade] = useState('civil');
  const [savingDep, setSavingDep] = useState(false);

  const [enforcementMode, setEnforcementMode] = useState('hard');
  const updateTenantConfig = async (config) => {
    if (config.dependency_enforcement_mode) {
      setEnforcementMode(config.dependency_enforcement_mode);
    }
  };

  // Form states for creating new template
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSortOrder, setNewSortOrder] = useState(10);
  const [saving, setSaving] = useState(false);

  // Edit states
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRoomType, setEditRoomType] = useState('');
  const [editSortOrder, setEditSortOrder] = useState(0);

  const toast = useToast();

  useEffect(() => {
    fetchTemplates();
    fetchDependencyTemplates();
  }, []);

  const fetchDependencyTemplates = async () => {
    try {
      const data = await configApi.getTradeDependencyTemplates();
      setDependencyTemplates(data || []);
    } catch (err) {
      toast.error('Failed to load dependency templates.');
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await configApi.getTradeTemplates();
      setTemplates(data || []);
    } catch (err) {
      toast.error('Failed to load activity templates.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return toast.error('Activity template name is required.');
    setSaving(true);
    try {
      const template = await configApi.createTradeTemplate({
        trade: selectedTrade,
        room_type: selectedRoomType,
        activity_name: newName.trim(),
        description: newDesc.trim() || null,
        sort_order: Number(newSortOrder)
      });
      setTemplates(prev => [...prev, template]);
      setNewName('');
      setNewDesc('');
      setNewSortOrder(prev => prev + 10);
      toast.success('Activity template created successfully.');
    } catch (err) {
      toast.error('Failed to create template.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (tpl) => {
    setEditingId(tpl.id);
    setEditName(tpl.activity_name);
    setEditDesc(tpl.description || '');
    setEditRoomType(tpl.room_type);
    setEditSortOrder(tpl.sort_order);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleUpdateTemplate = async (id) => {
    if (!editName.trim()) return toast.error('Name is required.');
    try {
      const updated = await configApi.updateTradeTemplate(id, {
        activity_name: editName.trim(),
        description: editDesc.trim() || null,
        room_type: editRoomType,
        sort_order: Number(editSortOrder)
      });
      setTemplates(prev => prev.map(t => t.id === id ? updated : t));
      setEditingId(null);
      toast.success('Template updated successfully.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update template.');
    }
  };

  const handleDeleteTemplate = async (id, isGlobal) => {
    if (isGlobal) {
      return toast.error('System default templates cannot be deleted.');
    }
    if (!window.confirm('Are you sure you want to delete this custom template?')) return;
    try {
      await configApi.deleteTradeTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Template deleted.');
    } catch (err) {
      toast.error('Failed to delete template.');
    }
  };

  const handleCreateDependencyTemplate = async (e) => {
    e.preventDefault();
    if (depTrade === depDependsOnTrade) return toast.error('A trade cannot depend on itself.');
    setSavingDep(true);
    try {
      const tpl = await configApi.createTradeDependencyTemplate({
        trade: depTrade,
        depends_on_trade: depDependsOnTrade
      });
      setDependencyTemplates(prev => [...prev, tpl]);
      toast.success('Dependency created successfully.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create dependency.');
    } finally {
      setSavingDep(false);
    }
  };

  const handleDeleteDependencyTemplate = async (id, isGlobal) => {
    if (isGlobal) return toast.error('System default dependencies cannot be deleted.');
    if (!window.confirm('Are you sure you want to delete this custom dependency?')) return;
    try {
      await configApi.deleteTradeDependencyTemplate(id);
      setDependencyTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Dependency deleted.');
    } catch (err) {
      toast.error('Failed to delete dependency.');
    }
  };

  const handleToggleEnforcementMode = async (mode) => {
    try {
      await updateTenantConfig({ dependency_enforcement_mode: mode });
      toast.success(`Dependency enforcement mode set to ${mode}.`);
    } catch (err) {
      toast.error('Failed to update enforcement mode.');
    }
  };

  // Filter templates based on current selections
  const filteredTemplates = templates.filter(t => t.trade === selectedTrade && (t.room_type === selectedRoomType || selectedRoomType === 'all'));

  if (loading) {
    return <div className={layoutStyles.loading}>Loading activity templates config panel…</div>;
  }

  return (
    <div className={layoutStyles.container}>
      <div className={layoutStyles.header}>
        <h1 className={layoutStyles.title}>Trade Execution Config</h1>
        <p className={layoutStyles.description}>
          Configure templates per trade and standard dependency sequences.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', padding: '0 32px' }}>
        <button
          onClick={() => setActiveTab('activities')}
          className={`${styles.tabBtn} ${activeTab === 'activities' ? styles.tabBtnActive : ''}`}
        >
          Activity Templates
        </button>
        <button
          onClick={() => setActiveTab('dependencies')}
          className={`${styles.tabBtn} ${activeTab === 'dependencies' ? styles.tabBtnActive : ''}`}
        >
          Trade Dependencies
        </button>
      </div>

      {activeTab === 'activities' && (
      <div className={styles.workspace}>
        {/* Left Side Trade selector */}
        <div className={styles.tradeSidebar}>
          <h2 className={styles.sectionTitle}>Select Trade</h2>
          <div className={styles.tradeList}>
            {TRADES.map(trade => (
              <button
                key={trade.id}
                className={`${styles.tradeBtn} ${selectedTrade === trade.id ? styles.tradeBtnActive : ''}`}
                onClick={() => setSelectedTrade(trade.id)}
              >
                <span>{trade.label}</span>
                <span className={styles.badge}>
                  {templates.filter(t => t.trade === trade.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side Templates List and Addition Form */}
        <div className={styles.mainContent}>
          <div className={styles.filterBar}>
            <div className={styles.filterItem}>
              <label>Filter Room Type:</label>
              <select
                className={styles.selectInput}
                value={selectedRoomType}
                onChange={e => setSelectedRoomType(e.target.value)}
              >
                <option value="all">All Room Types</option>
                {ROOM_TYPES.map(rt => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Create Template Form */}
          <form className={styles.createCard} onSubmit={handleCreateTemplate}>
            <h3 className={styles.cardTitle}>Add Template Activity for {TRADES.find(t => t.id === selectedTrade)?.label}</h3>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label>Activity Title *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Wall pipe routing"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formField}>
                <label>Room Type *</label>
                <select
                  className={styles.formInput}
                  value={selectedRoomType === 'all' ? 'General' : selectedRoomType}
                  onChange={e => setSelectedRoomType(e.target.value)}
                >
                  {ROOM_TYPES.map(rt => (
                    <option key={rt} value={rt}>{rt}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formField}>
                <label>Sort Order</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={newSortOrder}
                  onChange={e => setNewSortOrder(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.formField} style={{ marginBottom: 16 }}>
              <label>Description</label>
              <textarea
                className={styles.formInput}
                style={{ minHeight: 60 }}
                placeholder="Details or guidelines for this task..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
            </div>
            <div className={styles.formActions}>
              <Button variant="primary" size="sm" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Add Template'}
              </Button>
            </div>
          </form>

          {/* Templates Grid / List */}
          <div className={styles.templatesList}>
            {filteredTemplates.length === 0 ? (
              <div className={styles.emptyState}>
                <span>📋</span>
                <p>No activity templates configured for this selection.</p>
              </div>
            ) : (
              filteredTemplates
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                .map(tpl => {
                  const isGlobal = !tpl.tenant_id;
                  const isEditing = editingId === tpl.id;

                  return (
                    <div key={tpl.id} className={styles.templateRow}>
                      {isEditing ? (
                        <div className={styles.editRowForm}>
                          <div className={styles.formGrid}>
                            <div className={styles.formField}>
                              <label>Title</label>
                              <input
                                type="text"
                                className={styles.formInput}
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                              />
                            </div>
                            <div className={styles.formField}>
                              <label>Room Type</label>
                              <select
                                className={styles.formInput}
                                value={editRoomType}
                                onChange={e => setEditRoomType(e.target.value)}
                              >
                                {ROOM_TYPES.map(rt => (
                                  <option key={rt} value={rt}>{rt}</option>
                                ))}
                              </select>
                            </div>
                            <div className={styles.formField}>
                              <label>Sort Order</label>
                              <input
                                type="number"
                                className={styles.formInput}
                                value={editSortOrder}
                                onChange={e => setEditSortOrder(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className={styles.formField} style={{ margin: '8px 0 12px 0' }}>
                            <label>Description</label>
                            <textarea
                              className={styles.formInput}
                              style={{ minHeight: 60 }}
                              value={editDesc}
                              onChange={e => setEditDesc(e.target.value)}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>
                              Cancel
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => handleUpdateTemplate(tpl.id)}>
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={styles.templateInfo}>
                            <div className={styles.templateHeader}>
                              <span className={styles.templateName}>{tpl.activity_name}</span>
                              <div className={styles.tagGroup}>
                                <span className={styles.roomTag}>📍 {tpl.room_type}</span>
                                <span className={styles.sortTag}>Order: {tpl.sort_order}</span>
                                {isGlobal ? (
                                  <span className={styles.systemTag}>Default</span>
                                ) : (
                                  <span className={styles.customTag}>Custom</span>
                                )}
                              </div>
                            </div>
                            {tpl.description && (
                              <p className={styles.templateDesc}>{tpl.description}</p>
                            )}
                          </div>
                          <div className={styles.rowActions}>
                            {!isGlobal && (
                              <>
                                <button className={styles.editBtn} onClick={() => startEdit(tpl)}>
                                  ✏️
                                </button>
                                <button className={styles.deleteBtn} onClick={() => handleDeleteTemplate(tpl.id, isGlobal)}>
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
      )}

      {activeTab === 'dependencies' && (
        <div className={styles.workspace} style={{ flexDirection: 'column' }}>
          
          <div className={styles.createCard} style={{ marginBottom: 24 }}>
            <h3 className={styles.cardTitle}>Global Dependency Enforcement Mode</h3>
            <p className={styles.description} style={{ marginBottom: 16 }}>
              Determine what happens when a site supervisor tries to start or complete an activity before its prerequisites are met.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button 
                variant={enforcementMode === 'hard' ? 'primary' : 'outline'} 
                onClick={() => handleToggleEnforcementMode('hard')}
              >
                Hard Block (Prevent update)
              </Button>
              <Button 
                variant={enforcementMode === 'soft' ? 'primary' : 'outline'} 
                onClick={() => handleToggleEnforcementMode('soft')}
              >
                Soft Warning (Allow with confirmation)
              </Button>
              <Button 
                variant={enforcementMode === 'none' ? 'primary' : 'outline'} 
                onClick={() => handleToggleEnforcementMode('none')}
              >
                None (Do not enforce)
              </Button>
            </div>
          </div>

          <div className={styles.createCard} style={{ marginBottom: 24 }}>
            <h3 className={styles.cardTitle}>Add Standard Trade Sequence</h3>
            <form onSubmit={handleCreateDependencyTemplate} className={styles.formGrid} style={{ alignItems: 'flex-end' }}>
              <div className={styles.formField}>
                <label>This Trade...</label>
                <select className={styles.formInput} value={depTrade} onChange={e => setDepTrade(e.target.value)}>
                  {TRADES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ paddingBottom: 10, fontWeight: 'bold', color: 'var(--color-text-secondary)' }}>
                depends on
              </div>
              <div className={styles.formField}>
                <label>...This Trade</label>
                <select className={styles.formInput} value={depDependsOnTrade} onChange={e => setDepDependsOnTrade(e.target.value)}>
                  {TRADES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <Button variant="primary" type="submit" disabled={savingDep}>
                {savingDep ? 'Adding...' : 'Add Dependency'}
              </Button>
            </form>
          </div>

          <div className={styles.templatesList} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {dependencyTemplates.length === 0 ? (
               <div className={styles.emptyState}>No dependencies configured.</div>
            ) : (
              dependencyTemplates.map(dep => {
                const isGlobal = !dep.tenant_id;
                const tradeLabel = TRADES.find(t => t.id === dep.trade)?.label || dep.trade;
                const dependsOnLabel = TRADES.find(t => t.id === dep.depends_on_trade)?.label || dep.depends_on_trade;
                return (
                  <div key={dep.id} className={styles.templateRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{tradeLabel}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>depends on {dependsOnLabel}</div>
                      {isGlobal ? (
                        <span className={styles.systemTag} style={{ marginTop: 4, display: 'inline-block' }}>Default</span>
                      ) : (
                        <span className={styles.customTag} style={{ marginTop: 4, display: 'inline-block' }}>Custom</span>
                      )}
                    </div>
                    {!isGlobal && (
                      <button className={styles.deleteBtn} onClick={() => handleDeleteDependencyTemplate(dep.id, isGlobal)}>🗑️</button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
