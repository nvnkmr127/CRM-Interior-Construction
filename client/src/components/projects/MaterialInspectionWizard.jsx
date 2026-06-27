import { useState } from 'react';
import styles from './MaterialInspectionWizard.module.css';
import { Button, Input } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

export default function MaterialInspectionWizard({ projectId, delivery, onCancel, onSave }) {
  const [inspectionNotes, setInspectionNotes] = useState('');
  const toast = useToast();

  // Initialize checklist items state
  const [itemsState, setItemsState] = useState(
    (delivery.items || []).map(item => ({
      itemId: item.id,
      itemName: item.item_name,
      brandExpected: item.brand || '—',
      specExpected: item.material_specifications || '—',
      quantityExpected: parseFloat(item.quantity_expected || 0),
      quantityReceived: parseFloat(item.quantity_expected || 0),
      specificationConformanceStatus: 'conforming',
      specificationVarianceDetails: '',
      inspectionStatus: 'accepted',
      rejectedQuantity: 0.00,
      rejectionReason: ''
    }))
  );

  const handleItemChange = (index, field, value) => {
    setItemsState(prev =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const updated = { ...item, [field]: value };
        
        // Auto-fill rejected quantity if rejected
        if (field === 'inspectionStatus' && value === 'rejected' && updated.rejectedQuantity === 0) {
          updated.rejectedQuantity = updated.quantityExpected;
        } else if (field === 'inspectionStatus' && value === 'accepted') {
          updated.rejectedQuantity = 0.00;
          updated.rejectionReason = '';
        }
        return updated;
      })
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validations
    for (const item of itemsState) {
      if (item.quantityReceived < 0) {
        return toast.error(`Received quantity for "${item.itemName}" cannot be negative.`);
      }
      if (item.specificationConformanceStatus === 'non-conforming' && !item.specificationVarianceDetails.trim()) {
        return toast.error(`Please provide variance details for non-conforming item: "${item.itemName}".`);
      }
      if (item.inspectionStatus === 'rejected') {
        if (item.rejectedQuantity <= 0) {
          return toast.error(`Please provide a valid rejected quantity for rejected item: "${item.itemName}".`);
        }
        if (item.rejectedQuantity > item.quantityReceived) {
          return toast.error(`Rejected quantity cannot exceed received quantity for "${item.itemName}".`);
        }
        if (!item.rejectionReason.trim()) {
          return toast.error(`Please state the rejection reason for: "${item.itemName}".`);
        }
      }
    }

    try {
      const res = await api.post(`/projects/${projectId}/material-deliveries/${delivery.id}/inspect`, {
        inspectionNotes: inspectionNotes.trim(),
        items: itemsState
      });
      
      const anyRejected = itemsState.some(i => i.inspectionStatus === 'rejected');
      if (anyRejected) {
        toast.success('Inspection record logged. Substandard items rejected & vendor notified!');
      } else {
        toast.success('Inspection logged successfully. All items accepted.');
      }
      
      if (onSave) onSave(res.data?.data || res.data);
    } catch (err) {
      toast.error('Failed to log material inspection record.');
    }
  };

  const anyRejectionsExist = itemsState.some(i => i.inspectionStatus === 'rejected');

  return (
    <div className={styles.wizardContainer}>
      <div className={styles.wizardHeader}>
        <div>
          <h2>Incoming Material Inspection Wizard</h2>
          <p className={styles.subtext}>
            Delivery No: <strong>{delivery.delivery_number}</strong> | Linked PO: <strong>{delivery.po_number || 'None'}</strong>
          </p>
        </div>
        <Button variant="outline" onClick={onCancel}>Close</Button>
      </div>

      <form onSubmit={handleSubmit} className={styles.wizardForm}>
        <div className={styles.instructions}>
          💡 Compare the arrived material specs (brand, thickness, color, grade) against expected PO parameters and record rejections/variances below.
        </div>

        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Material Details & PO Specs</th>
                <th style={{ width: '120px' }}>Expected Qty</th>
                <th style={{ width: '120px' }}>Received Qty</th>
                <th style={{ width: '180px' }}>Spec Conformance</th>
                <th style={{ width: '200px' }}>Inspection Status</th>
              </tr>
            </thead>
            <tbody>
              {itemsState.map((item, index) => (
                <tr key={item.itemId} className={item.inspectionStatus === 'rejected' ? styles.rowRejected : ''}>
                  <td>
                    <div className={styles.itemName}>{item.itemName}</div>
                    <div className={styles.itemSpecs}>
                      <span><strong>Expected Brand:</strong> {item.brandExpected}</span>
                      <span><strong>Expected Specifications:</strong> {item.specExpected}</span>
                    </div>
                  </td>
                  <td><strong>{item.quantityExpected}</strong></td>
                  <td>
                    <input 
                      type="number"
                      step="0.01"
                      className={styles.numInput}
                      value={item.quantityReceived}
                      onChange={e => handleItemChange(index, 'quantityReceived', parseFloat(e.target.value) || 0)}
                      required
                    />
                  </td>
                  <td>
                    <select 
                      className={styles.selectInput}
                      value={item.specificationConformanceStatus}
                      onChange={e => handleItemChange(index, 'specificationConformanceStatus', e.target.value)}
                    >
                      <option value="conforming">Conforming ✔</option>
                      <option value="non-conforming">Non-Conforming ⚠</option>
                    </select>

                    {item.specificationConformanceStatus === 'non-conforming' && (
                      <textarea 
                        className={styles.inlineTextarea}
                        placeholder="Log variance (e.g. Received 12mm thickness instead of 18mm)"
                        value={item.specificationVarianceDetails}
                        onChange={e => handleItemChange(index, 'specificationVarianceDetails', e.target.value)}
                        required
                      />
                    )}
                  </td>
                  <td>
                    <select 
                      className={styles.selectInput}
                      value={item.inspectionStatus}
                      onChange={e => handleItemChange(index, 'inspectionStatus', e.target.value)}
                    >
                      <option value="accepted">Accept Item</option>
                      <option value="rejected">Reject Item ❌</option>
                    </select>

                    {item.inspectionStatus === 'rejected' && (
                      <div className={styles.rejectionFields}>
                        <div className={styles.formGroupInline}>
                          <label>Reject Qty:</label>
                          <input 
                            type="number"
                            step="0.01"
                            max={item.quantityReceived}
                            className={styles.numInputSmall}
                            value={item.rejectedQuantity}
                            onChange={e => handleItemChange(index, 'rejectedQuantity', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <input 
                          type="text"
                          className={styles.textInputSmall}
                          placeholder="Rejection reason..."
                          value={item.rejectionReason}
                          onChange={e => handleItemChange(index, 'rejectionReason', e.target.value)}
                          required
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.bottomBlock}>
          <div className={styles.formGroup}>
            <label>General Inspection Notes / Remarks</label>
            <textarea 
              className={styles.notesTextarea}
              placeholder="Record overall site storage check, delivery driver names, or vehicle number..."
              value={inspectionNotes}
              onChange={e => setInspectionNotes(e.target.value)}
            />
          </div>

          {anyRejectionsExist && (
            <div className={styles.rejectionWarning}>
              🚨 <strong>Vendor Accountability Warning:</strong> Rejections detected. Submitting this form will automatically flag this delivery in the vendor ledger and dispatch a notification to the supplier requesting replacements.
            </div>
          )}

          <div className={styles.actions}>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" variant="primary">Submit Material Inspection Record</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
