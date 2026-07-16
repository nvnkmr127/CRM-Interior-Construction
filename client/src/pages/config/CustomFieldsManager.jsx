/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors 
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { configApi } from '../../api/config';
import styles from './CustomFieldsManager.module.css';

// SVG Icons
const DragIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);
const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

function SortableRow({ field, onEdit, onDelete, onToggleActive }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    position: 'relative'
  };

  return (
    <tr ref={setNodeRef} style={style} className={`${styles.row} ${isDragging ? styles.rowDragging : ''}`}>
      <td className={styles.td}>
        <div {...attributes} {...listeners} className={styles.dragHandle}>
          <DragIcon />
        </div>
      </td>
      <td className={styles.td}>{field.label}</td>
      <td className={styles.td}>{field.name}</td>
      <td className={styles.td}>{field.field_type}</td>
      <td className={styles.td}>{field.is_required ? 'Yes' : 'No'}</td>
      <td className={styles.td}>
        <input 
          type="checkbox" 
          checked={field.is_active} 
          onChange={(e) => onToggleActive(field, e.target.checked)} 
        />
      </td>
      <td className={styles.td}>
        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={() => onEdit(field)}><EditIcon/></button>
          <button className={`${styles.actionBtn} ${styles.actionBtnDelete}`} onClick={() => onDelete(field.id)}><TrashIcon/></button>
        </div>
      </td>
    </tr>
  );
}

export default function CustomFieldsManager() {
  const [activeEntity, setActiveEntity] = useState('lead');
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    label: '', name: '', field_type: 'text', is_required: false, optionsStr: ''
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchFields = async () => {
    try {
      setLoading(true);
      const res = await configApi.getCustomFields(activeEntity);
      const sorted = (res || []).sort((a,b) => a.sort_order - b.sort_order);
      setFields(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, [activeEntity]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id);
      const newIndex = fields.findIndex((f) => f.id === over.id);
      
      const newOrder = arrayMove(fields, oldIndex, newIndex);
      setFields(newOrder);

      try {
        await configApi.updateCustomField(active.id, { sort_order: newIndex });
      } catch (err) {
        console.error('Failed to save order', err);
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this field?')) {
      await configApi.deleteCustomField(id);
      setFields(fields.filter(f => f.id !== id));
    }
  };

  const handleToggleActive = async (field, isActive) => {
    await configApi.updateCustomField(field.id, { is_active: isActive });
    setFields(fields.map(f => f.id === field.id ? { ...f, is_active: isActive } : f));
  };

  const openModal = (field = null) => {
    if (field) {
      setEditingField(field);
      setFormData({
        label: field.label,
        name: field.name,
        field_type: field.field_type,
        is_required: field.is_required,
        optionsStr: field.options ? field.options.join(', ') : ''
      });
    } else {
      setEditingField(null);
      setFormData({ label: '', name: '', field_type: 'text', is_required: false, optionsStr: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        entity: activeEntity,
        label: formData.label,
        name: formData.name,
        field_type: formData.field_type,
        is_required: formData.is_required,
        options: formData.optionsStr ? formData.optionsStr.split(',').map(s => s.trim()).filter(Boolean) : []
      };

      if (editingField) {
        await configApi.updateCustomField(editingField.id, payload);
      } else {
        payload.sort_order = fields.length;
        await configApi.addCustomField(payload);
      }
      setIsModalOpen(false);
      fetchFields();
    } catch (e) {
      alert('Failed to save custom field');
      console.error(e);
    }
  };

  const generateName = (label) => {
    if (editingField) return formData.name;
    return label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          {['lead', 'project', 'task'].map(ent => (
            <button 
              key={ent}
              className={`${styles.tab} ${activeEntity === ent ? styles.activeTab : ''}`}
              onClick={() => setActiveEntity(ent)}
            >
              {ent.charAt(0).toUpperCase() + ent.slice(1)}s
            </button>
          ))}
        </div>
        <button className={styles.addButton} onClick={() => openModal()}>+ Add Field</button>
      </div>

      <div className={styles.tableContainer}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th} style={{width: '40px'}}></th>
                <th className={styles.th}>Label</th>
                <th className={styles.th}>Internal Name</th>
                <th className={styles.th}>Type</th>
                <th className={styles.th}>Required</th>
                <th className={styles.th}>Active</th>
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {fields.map(field => (
                  <SortableRow 
                    key={field.id} 
                    field={field} 
                    onEdit={openModal} 
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                  />
                ))}
                {fields.length === 0 && !loading && (
                  <tr><td colSpan="7" style={{padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)'}}>No custom fields found.</td></tr>
                )}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 style={{marginTop: 0}}>{editingField ? 'Edit Field' : 'Add Custom Field'}</h3>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>Label</label>
              <input 
                className={styles.input} 
                value={formData.label} 
                onChange={(e) => setFormData({...formData, label: e.target.value, name: generateName(e.target.value)})}
                placeholder="e.g. Budget Range"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Internal Name</label>
              <input 
                className={styles.input} 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                disabled={!!editingField}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Field Type</label>
              <select 
                className={styles.select}
                value={formData.field_type}
                onChange={(e) => setFormData({...formData, field_type: e.target.value})}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="dropdown">Dropdown</option>
                <option value="multi_select">Multi Select</option>
                <option value="file">File</option>
                <option value="boolean">Yes/No</option>
              </select>
            </div>

            {['dropdown', 'multi_select'].includes(formData.field_type) && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Options (comma separated)</label>
                <input 
                  className={styles.input} 
                  value={formData.optionsStr} 
                  onChange={(e) => setFormData({...formData, optionsStr: e.target.value})}
                  placeholder="e.g. <5L, 5-10L, >10L"
                />
              </div>
            )}

            <div className={styles.checkboxContainer}>
              <input 
                type="checkbox" 
                id="isRequired"
                checked={formData.is_required}
                onChange={(e) => setFormData({...formData, is_required: e.target.checked})}
              />
              <label htmlFor="isRequired" className={styles.label}>Required Field</label>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
