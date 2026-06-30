import { useState, useEffect } from 'react';
import { useToast } from '../../store/toastContext';
import { getVendorCapacityReport, updateVendorCapacityProfile } from '../../api/vendorCapacityApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState, Modal, Button } from '../../components/ui';
import styles from './VendorCapacityPage.module.css';

export default function VendorCapacityPage() {
  usePageTitle('Vendor Capacity');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Vendor Capacity' }]);

  const toast = useToast();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [teamStrength, setTeamStrength] = useState(0);
  const [maxProjects, setMaxProjects] = useState(5);
  const [status, setStatus] = useState('active');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getVendorCapacityReport();
      setVendors(res || []);
    } catch (err) {
      toast.error('Failed to load vendor capacity data');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (vendor) => {
    setSelectedVendor(vendor);
    setTeamStrength(vendor.estimatedTeamStrength || 0);
    setMaxProjects(vendor.maxConcurrentProjects || 5);
    setStatus(vendor.status || 'active');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateVendorCapacityProfile(selectedVendor.vendorName, {
        estimatedTeamStrength: teamStrength,
        maxConcurrentProjects: maxProjects,
        status
      });
      toast.success('Vendor capacity profile updated');
      setShowModal(false);
      fetchData(); // Refresh list
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (availabilityStatus) => {
    switch (availabilityStatus) {
      case 'Overloaded': return '#d93025';
      case 'At Capacity': return '#f29900';
      case 'Available': return '#1e8e3e';
      default: return '#5f6368';
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Vendor Capacity Profile</h1>
          <div className={styles.desc}>Track active project loads and manage vendor bandwidth.</div>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : vendors.length === 0 ? (
        <EmptyState title="No vendors found" description="No vendors are currently assigned to any projects." />
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Vendor Name</th>
                <th className={styles.th}>Active Projects</th>
                <th className={styles.th}>Max Projects</th>
                <th className={styles.th}>Team Strength</th>
                <th className={styles.th}>Utilization</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.vendorName} className={styles.tr}>
                  <td className={styles.td}><strong>{v.vendorName}</strong></td>
                  <td className={styles.td}>{v.activeProjectCount}</td>
                  <td className={styles.td}>{v.maxConcurrentProjects}</td>
                  <td className={styles.td}>{v.estimatedTeamStrength}</td>
                  <td className={styles.td}>
                    <div className={styles.progressBar}>
                      <div 
                        className={styles.progressFill} 
                        style={{ 
                          width: `${Math.min(v.utilizationPercent, 100)}%`,
                          backgroundColor: getStatusColor(v.availabilityStatus)
                        }} 
                      />
                    </div>
                    <span className={styles.utilText}>{v.utilizationPercent}%</span>
                  </td>
                  <td className={styles.td}>
                    <span 
                      className={styles.statusBadge}
                      style={{ color: getStatusColor(v.availabilityStatus), backgroundColor: getStatusColor(v.availabilityStatus) + '22' }}
                    >
                      {v.availabilityStatus}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <Button variant="secondary" size="sm" onClick={() => handleEdit(v)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && selectedVendor && (
        <Modal title={`Edit Profile: ${selectedVendor.vendorName}`} onClose={() => setShowModal(false)} size="sm">
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Estimated Team Strength</label>
              <input 
                type="number" 
                min="0"
                value={teamStrength} 
                onChange={e => setTeamStrength(parseInt(e.target.value) || 0)} 
              />
            </div>
            <div className={styles.formGroup}>
              <label>Max Concurrent Projects</label>
              <input 
                type="number" 
                min="1"
                value={maxProjects} 
                onChange={e => setMaxProjects(parseInt(e.target.value) || 1)} 
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Vendor Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
            </div>
            
            <div className={styles.modalActions}>
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" loading={submitting}>Save</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
