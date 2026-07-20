import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import styles from './ApprovalMatrixPage.module.css';

const TRANSACTION_TYPES = [
  { value: 'invoice', label: 'Invoice Generation' },
  { value: 'payment', label: 'Payment Milestone' },
  { value: 'payment_update', label: 'Payment Update' },
  { value: 'discount', label: 'Discount Application' },
  { value: 'credit', label: 'Credit Note' },
  { value: 'refund', label: 'Refund' },
  { value: 'change_order', label: 'Change Order' }
];

const AVAILABLE_ROLES = [
  'superadmin',
  'admin',
  'finance:executive',
  'finance:manager',
  'finance:head',
  'director',
  'projects:manager'
];

export default function ApprovalMatrixPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const [formData, setFormData] = useState({
    transaction_type: 'invoice',
    min_amount: 0,
    max_amount: '',
    department: '',
    branch: '',
    priority: '',
    effective_date: '',
    expiry_date: '',
    validation_rules: '',
    required_roles: ['finance:manager']
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await api.get('/approval-matrix');
      setRules(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load approval matrix rules');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (rule = null) => {
    if (rule) {
      setFormData({
        transaction_type: rule.transaction_type,
        min_amount: rule.min_amount || 0,
        max_amount: rule.max_amount || '',
        department: rule.department || '',
        branch: rule.branch || '',
        priority: rule.priority || '',
        effective_date: rule.effective_date ? rule.effective_date.substring(0, 10) : '',
        expiry_date: rule.expiry_date ? rule.expiry_date.substring(0, 10) : '',
        validation_rules: rule.validation_rules ? JSON.stringify(rule.validation_rules, null, 2) : '',
        required_roles: rule.required_roles || []
      });
      setEditingRule(rule);
    } else {
      setFormData({
        transaction_type: 'invoice',
        min_amount: 0,
        max_amount: '',
        department: '',
        branch: '',
        priority: '',
        effective_date: '',
        expiry_date: '',
        validation_rules: '',
        required_roles: ['finance:manager']
      });
      setEditingRule(null);
    }
    setIsModalOpen(true);
  };

  const handleRoleChange = (index, value) => {
    const newRoles = [...formData.required_roles];
    newRoles[index] = value;
    setFormData({ ...formData, required_roles: newRoles });
  };

  const handleAddRole = () => {
    setFormData({ ...formData, required_roles: [...formData.required_roles, AVAILABLE_ROLES[0]] });
  };

  const handleRemoveRole = (index) => {
    const newRoles = formData.required_roles.filter((_, i) => i !== index);
    setFormData({ ...formData, required_roles: newRoles });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let parsedValidation = null;
      if (formData.validation_rules) {
        try {
          parsedValidation = JSON.parse(formData.validation_rules);
        } catch (e) {
          toast.error('Validation Rules must be valid JSON');
          return;
        }
      }

      const payload = {
        ...formData,
        max_amount: formData.max_amount === '' ? null : Number(formData.max_amount),
        min_amount: Number(formData.min_amount),
        effective_date: formData.effective_date || null,
        expiry_date: formData.expiry_date || null,
        validation_rules: parsedValidation
      };

      if (editingRule) {
        await api.put(`/approval-matrix/${editingRule.id}`, payload);
        toast.success('Rule updated successfully');
      } else {
        await api.post('/approval-matrix', payload);
        toast.success('Rule created successfully');
      }
      setIsModalOpen(false);
      fetchRules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save rule');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      await api.delete(`/approval-matrix/${id}`);
      toast.success('Rule deleted successfully');
      fetchRules();
    } catch (err) {
      toast.error('Failed to delete rule');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Approval Matrix</h1>
          <p className={styles.subtitle}>Configure dynamic multi-level approval chains for transactions</p>
        </div>
        <button className={styles.addButton} onClick={() => handleOpenModal()}>
          + Create New Rule
        </button>
      </div>

      <div className={styles.card}>
        {loading ? (
          <p>Loading rules...</p>
        ) : rules.length === 0 ? (
          <p>No approval matrix rules found.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Min Amount</th>
                <th>Max Amount</th>
                <th>Department</th>
                <th>Priority</th>
                <th>Approval Chain (Roles)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id}>
                  <td>
                    {TRANSACTION_TYPES.find(t => t.value === rule.transaction_type)?.label || rule.transaction_type}
                  </td>
                  <td>₹{parseFloat(rule.min_amount).toLocaleString()}</td>
                  <td>{rule.max_amount ? `₹${parseFloat(rule.max_amount).toLocaleString()}` : 'Unlimited'}</td>
                  <td>{rule.department || '-'}</td>
                  <td>{rule.priority || '-'}</td>
                  <td>
                    {rule.required_roles.map((role, i) => (
                      <React.Fragment key={i}>
                        <span className={styles.chainBadge}>{role}</span>
                        {i < rule.required_roles.length - 1 && <span className={styles.chainArrow}>→</span>}
                      </React.Fragment>
                    ))}
                  </td>
                  <td className={styles.actions}>
                    <button className={styles.editBtn} onClick={() => handleOpenModal(rule)}>Edit</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(rule.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingRule ? 'Edit Rule' : 'Create New Rule'}</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label>Transaction Type</label>
                <select 
                  className={styles.select}
                  value={formData.transaction_type}
                  onChange={(e) => setFormData({...formData, transaction_type: e.target.value})}
                  required
                >
                  {TRANSACTION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label>Min Amount (₹)</label>
                  <input 
                    type="number" 
                    className={styles.input}
                    value={formData.min_amount}
                    onChange={(e) => setFormData({...formData, min_amount: e.target.value})}
                    required
                    min="0"
                  />
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label>Max Amount (₹)</label>
                  <input 
                    type="number" 
                    className={styles.input}
                    value={formData.max_amount}
                    onChange={(e) => setFormData({...formData, max_amount: e.target.value})}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label>Department (Optional)</label>
                  <input 
                    type="text" 
                    className={styles.input}
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    placeholder="e.g. Sales, Operations"
                  />
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label>Priority (Optional)</label>
                  <select 
                    className={styles.select}
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  >
                    <option value="">Any</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label>Effective Date (Optional)</label>
                  <input 
                    type="date" 
                    className={styles.input}
                    value={formData.effective_date}
                    onChange={(e) => setFormData({...formData, effective_date: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label>Expiry Date (Optional)</label>
                  <input 
                    type="date" 
                    className={styles.input}
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Validation Rules (Optional JSON)</label>
                <textarea 
                  className={styles.input}
                  style={{ minHeight: '80px', fontFamily: 'monospace' }}
                  value={formData.validation_rules}
                  onChange={(e) => setFormData({...formData, validation_rules: e.target.value})}
                  placeholder='{"require_po": true}'
                />
              </div>

              <div className={styles.formGroup}>
                <label>Approval Chain (Top to Bottom)</label>
                <div className={styles.rolesContainer}>
                  {formData.required_roles.map((role, index) => (
                    <div key={index} className={styles.roleRow}>
                      <span style={{ fontWeight: 500, color: '#6b7280', width: '20px' }}>{index + 1}.</span>
                      <select 
                        className={styles.select}
                        value={role}
                        onChange={(e) => handleRoleChange(index, e.target.value)}
                        required
                      >
                        {AVAILABLE_ROLES.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {formData.required_roles.length > 1 && (
                        <button type="button" className={styles.removeRoleBtn} onClick={() => handleRemoveRole(index)}>
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className={styles.addRoleBtn} onClick={handleAddRole}>
                    + Add Approval Stage
                  </button>
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
