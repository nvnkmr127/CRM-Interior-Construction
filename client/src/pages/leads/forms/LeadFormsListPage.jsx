import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getForms, deleteForm } from '../../../api/leadForms';
import { useToast } from '../../../store/toastContext';
import styles from './LeadForms.module.css';

export default function LeadFormsListPage() {
  const [forms, setForms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  const fetchForms = async () => {
    try {
      setIsLoading(true);
      const data = await getForms();
      if (data.success) {
        setForms(data.data);
      }
    } catch (error) {
      toast.addToast('Error fetching forms', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this form?')) return;
    try {
      await deleteForm(id);
      toast.addToast('Form deleted', 'success');
      fetchForms();
    } catch (error) {
      toast.addToast('Failed to delete form', 'error');
    }
  };

  const copyEmbedCode = (slug) => {
    const url = `${window.location.origin}/forms/${slug}`;
    const iframeCode = `<iframe src="${url}" width="100%" height="500" frameborder="0"></iframe>`;
    navigator.clipboard.writeText(iframeCode);
    toast.addToast('Iframe embed code copied to clipboard!', 'success');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Lead Forms</h2>
        <button className={styles.primaryBtn} onClick={() => navigate('/leads/forms/new')}>
          Create Form
        </button>
      </div>

      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Form Name</th>
                <th>Status</th>
                <th>Views</th>
                <th>Submissions</th>
                <th>Created Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map(form => (
                <tr key={form.id}>
                  <td>
                    <div className={styles.formName}>{form.name}</div>
                    <a href={`/forms/${form.slug}`} target="_blank" rel="noreferrer" className={styles.publicLink}>
                      /forms/{form.slug}
                    </a>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[form.status]}`}>
                      {form.status}
                    </span>
                  </td>
                  <td>{form.views}</td>
                  <td>{form.submissions}</td>
                  <td>{new Date(form.created_at).toLocaleDateString()}</td>
                  <td className={styles.actions}>
                    <button onClick={() => navigate(`/leads/forms/${form.id}/edit`)}>Edit</button>
                    <button onClick={() => navigate(`/leads/forms/${form.id}/submissions`)}>Submissions</button>
                    <button onClick={() => copyEmbedCode(form.slug)}>Embed</button>
                    <button onClick={() => handleDelete(form.id)} className={styles.danger}>Delete</button>
                  </td>
                </tr>
              ))}
              {forms.length === 0 && (
                <tr>
                  <td colSpan="6" className={styles.emptyState}>No forms found. Create your first lead form!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
