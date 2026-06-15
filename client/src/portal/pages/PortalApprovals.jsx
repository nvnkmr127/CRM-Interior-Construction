import React, { useState, useEffect } from 'react';
import './PortalApprovals.css';

export default function PortalApprovals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [revisionId, setRevisionId] = useState(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [toast, setToast] = useState(null);

  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/portal/approvals');
      const data = await res.json();
      if (res.ok && data.success) {
        setApprovals(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch approvals', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async (docId) => {
    setProcessingId(docId);
    try {
      const res = await fetch(`/api/portal/approvals/${docId}/approve`, { method: 'POST' });
      if (res.ok) {
        showToast('Design approved!');
        await fetchApprovals();
      } else {
        showToast('Failed to approve design', 'error');
      }
    } catch (e) {
      showToast('Error approving design', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmitRevision = async (docId) => {
    if (!revisionNote.trim()) return;
    setProcessingId(docId);
    try {
      const res = await fetch(`/api/portal/approvals/${docId}/revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: revisionNote })
      });
      if (res.ok) {
        showToast("Revision requested. We'll update you shortly.");
        setRevisionId(null);
        setRevisionNote('');
        await fetchApprovals();
      } else {
        showToast('Failed to submit revision request', 'error');
      }
    } catch (e) {
      showToast('Error submitting revision request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="portal-loading">Loading pending approvals...</div>;

  return (
    <div className="portal-approvals-container">
      {toast && (
        <div className={`portal-toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      <h2 className="portal-page-title">Pending Approvals</h2>

      {approvals.length === 0 ? (
        <div className="portal-empty-state">
          <div className="empty-icon">✓</div>
          <h3>All Caught Up!</h3>
          <p>No designs awaiting your approval. Check back soon!</p>
        </div>
      ) : (
        <div className="approvals-list">
          {approvals.map(doc => (
            <div key={doc.id} className="approval-card">
              <div className="approval-header">
                <div className="approval-title-group">
                  <h3 className="doc-name">{doc.name}</h3>
                  <div className="doc-badges">
                    <span className="badge badge-type">{doc.doc_type || 'Document'}</span>
                    <span className="badge badge-version">v{doc.version || 1}</span>
                  </div>
                </div>
                <div className="doc-date">
                  Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="approval-actions">
                <a 
                  href={doc.downloadUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn-outline btn-block text-center"
                >
                  Download to Preview
                </a>
                
                {revisionId === doc.id ? (
                  <div className="revision-box">
                    <textarea 
                      placeholder="Please describe the changes needed..."
                      value={revisionNote}
                      onChange={e => setRevisionNote(e.target.value)}
                      disabled={processingId === doc.id}
                      rows={3}
                    />
                    <div className="revision-actions">
                      <button 
                        className="btn btn-ghost" 
                        onClick={() => { setRevisionId(null); setRevisionNote(''); }}
                        disabled={processingId === doc.id}
                      >
                        Cancel
                      </button>
                      <button 
                        className="btn btn-amber" 
                        onClick={() => handleSubmitRevision(doc.id)}
                        disabled={!revisionNote.trim() || processingId === doc.id}
                      >
                        {processingId === doc.id ? 'Submitting...' : 'Submit Revision'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="action-row">
                    <button 
                      className="btn btn-green btn-block"
                      onClick={() => handleApprove(doc.id)}
                      disabled={processingId === doc.id}
                    >
                      {processingId === doc.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button 
                      className="btn btn-amber-outline btn-block"
                      onClick={() => setRevisionId(doc.id)}
                      disabled={processingId === doc.id}
                    >
                      Request Revision
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
