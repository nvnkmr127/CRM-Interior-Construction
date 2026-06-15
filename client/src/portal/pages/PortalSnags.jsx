import React, { useState, useEffect } from 'react';
import './PortalSnags.css';

export default function PortalSnags() {
  const [snags, setSnags] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Carpentry');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  
  const categories = ['Carpentry', 'Electrical', 'Plumbing', 'Paint', 'Flooring', 'Other'];

  const fetchSnags = async () => {
    try {
      const res = await fetch('/api/portal/snags');
      const data = await res.json();
      if (res.ok && data.success) {
        setSnags(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch snags', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnags();
  }, []);

  const handlePhotoSelect = (e) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        key: null,
        status: 'pending' // pending, uploading, done, error
      }));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  // Mock S3 upload since no external storage configured for portal route in this stub
  const uploadToS3 = async (file) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`snags/${Date.now()}_${file.name}`);
      }, 1000);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title) return;
    
    setIsSubmitting(true);
    try {
      // 1. Upload all photos
      const uploadedPhotos = [...photos];
      for (let i = 0; i < uploadedPhotos.length; i++) {
        if (uploadedPhotos[i].status === 'pending') {
          uploadedPhotos[i].status = 'uploading';
          setPhotos([...uploadedPhotos]);
          
          const key = await uploadToS3(uploadedPhotos[i].file);
          uploadedPhotos[i].key = key;
          uploadedPhotos[i].status = 'done';
          setPhotos([...uploadedPhotos]);
        }
      }

      const photoKeys = uploadedPhotos.map(p => p.key).filter(k => k);

      // 2. Submit snag
      const res = await fetch('/api/portal/snags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, description, photoKeys })
      });

      if (res.ok) {
        setTitle('');
        setCategory('Carpentry');
        setDescription('');
        photos.forEach(p => URL.revokeObjectURL(p.preview));
        setPhotos([]);
        await fetchSnags();
      } else {
        alert('Failed to raise snag');
      }
    } catch (e) {
      alert('Error raising snag');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (id) => {
    setVerifyingId(id);
    try {
      const res = await fetch(`/api/portal/snags/${id}/verify`, { method: 'POST' });
      if (res.ok) {
        await fetchSnags();
      } else {
        alert('Failed to verify snag');
      }
    } catch (e) {
      alert('Error verifying snag');
    } finally {
      setVerifyingId(null);
    }
  };

  const getStatusBadge = (status, verifiedAt) => {
    if (verifiedAt) return <span className="badge badge-gray">Verified by you</span>;
    switch (status) {
      case 'open': return <span className="badge badge-red">Open</span>;
      case 'assigned': return <span className="badge badge-amber">Assigned</span>;
      case 'in_progress': return <span className="badge badge-blue">In Progress</span>;
      case 'resolved': return <span className="badge badge-green">Resolved</span>;
      case 'client_verified': return <span className="badge badge-gray">Verified by you</span>;
      default: return <span className="badge badge-gray">{status}</span>;
    }
  };

  if (loading) return <div className="portal-loading">Loading your snags...</div>;

  return (
    <div className="portal-snags-container">
      <h2 className="portal-page-title">Snag Management</h2>
      
      {/* Raise New Snag Section */}
      <section className="portal-card new-snag-card">
        <h3 className="portal-section-title">Raise New Snag</h3>
        <form onSubmit={handleSubmit} className="new-snag-form">
          <div className="form-row">
            <div className="form-group flex-2">
              <label>Title *</label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="Brief description of the issue"
                required 
                disabled={isSubmitting}
              />
            </div>
            <div className="form-group flex-1">
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} disabled={isSubmitting}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Additional details..."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>Photos</label>
            <div className="photo-upload-wrapper">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handlePhotoSelect} 
                disabled={isSubmitting}
                id="photo-upload"
                className="sr-only"
              />
              <label htmlFor="photo-upload" className="photo-upload-btn">
                + Add Photos
              </label>
              <div className="photo-preview-grid">
                {photos.map((photo, index) => (
                  <div key={index} className="photo-preview-item">
                    <img src={photo.preview} alt={`Preview ${index}`} />
                    <button type="button" className="remove-photo-btn" onClick={() => removePhoto(index)} disabled={isSubmitting}>&times;</button>
                    {photo.status === 'uploading' && <div className="photo-overlay">Uploading...</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={!title || isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Snag'}
          </button>
        </form>
      </section>

      {/* My Snags List */}
      <section className="portal-card snags-list-card">
        <h3 className="portal-section-title">My Snags</h3>
        {snags.length === 0 ? (
          <p className="empty-text">You haven't raised any snags yet.</p>
        ) : (
          <div className="snags-list">
            {snags.map(snag => {
              const isResolved = snag.status === 'resolved';
              const isVerified = snag.status === 'client_verified';
              
              return (
                <div key={snag.id} className={`snag-item ${isVerified ? 'snag-verified' : ''}`}>
                  <div className="snag-info">
                    <div className="snag-header">
                      <h4 className="snag-title">{snag.title}</h4>
                      <div className="snag-badges">
                        <span className="badge badge-category">{snag.category}</span>
                        {getStatusBadge(snag.status, isVerified)}
                      </div>
                    </div>
                    <div className="snag-date">Raised on: {new Date(snag.created_at).toLocaleDateString()}</div>
                  </div>
                  
                  {isResolved && !isVerified && (
                    <div className="snag-action">
                      <button 
                        className="btn btn-green btn-sm"
                        onClick={() => handleVerify(snag.id)}
                        disabled={verifyingId === snag.id}
                      >
                        {verifyingId === snag.id ? 'Verifying...' : 'Mark Verified'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
