import React, { useState, useEffect } from 'react';
import './PortalProject.css';

export default function PortalProject() {
  const [project, setProject] = useState(null);
  const [phases, setPhases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [projRes, phaseRes, payRes, docRes] = await Promise.all([
          fetch('/api/portal/project').then(r => r.json()),
          fetch('/api/portal/project/phases').then(r => r.json()),
          fetch('/api/portal/project/payments').then(r => r.json()),
          fetch('/api/portal/project/documents').then(r => r.json())
        ]);

        if (projRes.success) setProject(projRes.data);
        if (phaseRes.success) setPhases(phaseRes.data);
        if (payRes.success) setPayments(payRes.data);
        if (docRes.success) setDocuments(docRes.data);
      } catch (error) {
        console.error('Failed to load project data', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div className="portal-loading">Loading project details...</div>;
  if (!project) return <div className="portal-error">Failed to load project details.</div>;

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid': return 'badge-green';
      case 'invoice_raised': return 'badge-amber';
      case 'overdue': return 'badge-red';
      default: return 'badge-gray';
    }
  };

  const formatCurrency = (amount) => {
    if (amount == null) return 'TBD';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  return (
    <div className="portal-project-container">
      {/* Project Status Card */}
      <section className="portal-card">
        <div className="portal-card-header">
          <h2 className="portal-card-title">Your Project: {project.name}</h2>
          <span className={`status-badge status-${project.status ? project.status.toLowerCase() : 'active'}`}>
            {project.status || 'Active'}
          </span>
        </div>
        <div className="portal-project-meta">
          <div className="meta-item">
            <span className="meta-label">Project Manager</span>
            <span className="meta-value">{project.pm_name || 'Unassigned'}</span>
            {project.pm_name && <a href={`tel:+910000000000`} className="meta-link">Call PM</a>}
          </div>
          {project.designer_name && (
            <div className="meta-item">
              <span className="meta-label">Designer</span>
              <span className="meta-value">{project.designer_name}</span>
            </div>
          )}
          <div className="meta-item">
            <span className="meta-label">Timeline</span>
            <span className="meta-value">
              {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'TBD'} &rarr;{' '}
              {project.target_date ? new Date(project.target_date).toLocaleDateString() : 'TBD'}
            </span>
          </div>
        </div>
      </section>

      {/* Progress Section */}
      <section className="portal-card">
        <h3 className="portal-section-title">Progress</h3>
        
        <div className="progress-bar-container">
          <div className="progress-bar-header">
            <span>Overall Completion</span>
            <span>{project.task_completion_pct || 0}%</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${project.task_completion_pct || 0}%` }}></div>
          </div>
        </div>

        <div className="phases-timeline">
          {phases.map((phase) => (
            <div key={phase.id} className={`phase-step ${phase.status === 'completed' ? 'completed' : phase.status === 'in_progress' ? 'active' : ''}`}>
              <div className="phase-dot"></div>
              <div className="phase-name">{phase.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Payment Schedule */}
      <section className="portal-card">
        <h3 className="portal-section-title">Payment Schedule</h3>
        <div className="table-responsive">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Milestone</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan="4" className="text-center">No payment milestones scheduled</td></tr>
              ) : (
                payments.map(payment => (
                  <tr key={payment.id}>
                    <td>{payment.name}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>{payment.due_date ? new Date(payment.due_date).toLocaleDateString() : 'TBD'}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(payment.status)}`}>
                        {payment.status ? payment.status.replace('_', ' ') : 'scheduled'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Documents Section */}
      <section className="portal-card">
        <h3 className="portal-section-title">Documents</h3>
        <div className="document-grid">
          {documents.length === 0 ? (
            <p className="text-muted">No documents available</p>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="document-card">
                <div className="doc-icon">📄</div>
                <div className="doc-info">
                  <div className="doc-name">{doc.name}</div>
                  <div className="doc-meta">{new Date(doc.createdAt || doc.created_at).toLocaleDateString()}</div>
                </div>
                <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer" className="doc-download-btn">
                  Download
                </a>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
