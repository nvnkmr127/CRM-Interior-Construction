import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFormSubmissions, getFormById } from '../../../api/leadForms';
import { useToast } from '../../../store/toastContext';
import styles from './LeadForms.module.css';

export default function LeadFormSubmissionsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [form, setForm] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [formData, submissionsData] = await Promise.all([
        getFormById(id),
        getFormSubmissions(id)
      ]);
      if (formData.success) setForm(formData.data);
      if (submissionsData.success) setSubmissions(submissionsData.data);
    } catch (error) {
      toast.addToast('Failed to load submissions', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (!form) return <div>Form not found</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Submissions: {form.name}</h2>
          <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>Total Submissions: {form.submissions}</p>
        </div>
        <button className={styles.actions} onClick={() => navigate('/leads/forms')} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', cursor: 'pointer' }}>
          Back to Forms
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>IP Address</th>
              <th>Lead Record</th>
              <th>Data (JSON)</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map(sub => (
              <tr key={sub.id}>
                <td>{new Date(sub.created_at).toLocaleString()}</td>
                <td>{sub.ip_address}</td>
                <td>
                  {sub.lead_id ? (
                    <span className={`${styles.badge} ${styles.active}`}>Created ({sub.lead_id.substring(0,8)}...)</span>
                  ) : (
                    <span className={`${styles.badge} ${styles.inactive}`}>Not Created</span>
                  )}
                </td>
                <td>
                  <pre style={{ margin: 0, padding: '8px', background: '#f9fafb', borderRadius: '4px', fontSize: '12px', overflowX: 'auto', maxWidth: '300px' }}>
                    {JSON.stringify(sub.data, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan="4" className={styles.emptyState}>No submissions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
