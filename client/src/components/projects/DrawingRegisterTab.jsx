import React, { useState, useEffect, useMemo } from 'react';
import { Button, Badge, Modal, Input, EmptyState, Spinner, Select } from '../ui';
import { useToast } from '../../store/toastContext';
import { useS3Upload } from '../../hooks/useS3Upload';
import styles from './DrawingRegisterTab.module.css';
import {
  getDrawingRegister,
  createDrawingRegisterEntry,
  updateDrawingRegisterEntry,
  deleteDrawingRegisterEntry,
  getDocumentUrl
} from '../../api/projects';

const STATUS_LABELS = {
  issued_for_approval: 'Issued for Approval',
  issued_for_construction: 'Issued for Construction',
  superseded: 'Superseded',
  issued_for_info: 'Issued for Information'
};

const STATUS_VARIANTS = {
  issued_for_approval: 'warning',
  issued_for_construction: 'success',
  superseded: 'neutral',
  issued_for_info: 'info'
};

export default function DrawingRegisterTab({ projectId }) {
  const toast = useToast();
  const { upload, uploading } = useS3Upload();

  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Drawer / Details state
  const [selectedDrawingNumber, setSelectedDrawingNumber] = useState(null);

  // Modals state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form states
  const [registerForm, setRegisterForm] = useState({
    drawingNumber: '',
    revisionCode: '',
    title: '',
    status: 'issued_for_approval',
    issuedDate: new Date().toISOString().split('T')[0],
    file: null
  });

  const [revisionForm, setRevisionForm] = useState({
    drawingNumber: '',
    revisionCode: '',
    title: '',
    status: 'issued_for_approval',
    issuedDate: new Date().toISOString().split('T')[0],
    file: null
  });

  const [editForm, setEditForm] = useState({
    id: '',
    drawingNumber: '',
    revisionCode: '',
    title: '',
    status: 'issued_for_approval',
    issuedDate: '',
    documentId: null
  });

  const fetchDrawings = async () => {
    setLoading(true);
    try {
      const res = await getDrawingRegister(projectId);
      if (res.data?.success) {
        setDrawings(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load drawing register.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchDrawings();
    }
  }, [projectId]);

  // Group drawings by drawing number to identify the latest version and build revision history
  const groupedDrawings = useMemo(() => {
    const groups = {};
    drawings.forEach(d => {
      if (!groups[d.drawing_number]) {
        groups[d.drawing_number] = [];
      }
      groups[d.drawing_number].push(d);
    });

    // Sort revisions in each group by created_at descending
    // The first item (index 0) is the latest revision
    const result = [];
    Object.keys(groups).forEach(drawingNumber => {
      const groupList = groups[drawingNumber].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      // Find the active revision (the one that is not superseded, or fallback to the latest one)
      const activeRevision = groupList.find(d => !d.is_superseded) || groupList[0];
      
      result.push({
        drawingNumber,
        activeRevision,
        revisions: groupList
      });
    });

    // Sort alphabetically by drawing number
    return result.sort((a, b) => a.drawingNumber.localeCompare(b.drawingNumber));
  }, [drawings]);

  const filteredGroups = useMemo(() => {
    return groupedDrawings.filter(group => {
      const active = group.activeRevision;
      const matchesSearch = 
        active.drawing_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        active.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || active.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [groupedDrawings, searchQuery, statusFilter]);

  const handleDownload = async (docId) => {
    if (!docId) return;
    try {
      const res = await getDocumentUrl(projectId, docId);
      if (res.data?.data?.url || res.data?.url) {
        window.open(res.data.data?.url || res.data.url, '_blank');
      } else {
        toast.error('Failed to get download URL.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to download document.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerForm.drawingNumber.trim() || !registerForm.revisionCode.trim() || !registerForm.title.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    try {
      let documentId = null;
      if (registerForm.file) {
        toast.info('Uploading drawing file...');
        const { doc } = await upload({
          projectId,
          file: registerForm.file,
          docType: 'drawing'
        });
        documentId = doc.id;
      }

      const payload = {
        drawingNumber: registerForm.drawingNumber.trim(),
        revisionCode: registerForm.revisionCode.trim(),
        title: registerForm.title.trim(),
        status: registerForm.status,
        issuedDate: registerForm.issuedDate,
        documentId
      };

      const res = await createDrawingRegisterEntry(projectId, payload);
      if (res.data?.success) {
        toast.success(`Drawing ${payload.drawingNumber} registered successfully!`);
        setIsRegisterModalOpen(false);
        setRegisterForm({
          drawingNumber: '',
          revisionCode: '',
          title: '',
          status: 'issued_for_approval',
          issuedDate: new Date().toISOString().split('T')[0],
          file: null
        });
        fetchDrawings();
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        toast.error('A drawing with this revision code already exists.');
      } else {
        toast.error('Failed to register drawing.');
      }
    }
  };

  const handleRevisionOpen = (group) => {
    const active = group.activeRevision;
    setRevisionForm({
      drawingNumber: active.drawing_number,
      revisionCode: '',
      title: active.title,
      status: 'issued_for_approval',
      issuedDate: new Date().toISOString().split('T')[0],
      file: null
    });
    setIsRevisionModalOpen(true);
  };

  const handleRevisionSubmit = async (e) => {
    e.preventDefault();
    if (!revisionForm.revisionCode.trim() || !revisionForm.title.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    try {
      let documentId = null;
      if (revisionForm.file) {
        toast.info('Uploading new revision file...');
        const { doc } = await upload({
          projectId,
          file: revisionForm.file,
          docType: 'drawing'
        });
        documentId = doc.id;
      }

      const payload = {
        drawingNumber: revisionForm.drawingNumber,
        revisionCode: revisionForm.revisionCode.trim(),
        title: revisionForm.title.trim(),
        status: revisionForm.status,
        issuedDate: revisionForm.issuedDate,
        documentId
      };

      const res = await createDrawingRegisterEntry(projectId, payload);
      if (res.data?.success) {
        toast.success(`New revision ${payload.revisionCode} added to drawing ${payload.drawingNumber}!`);
        setIsRevisionModalOpen(false);
        fetchDrawings();
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        toast.error('This revision code already exists for this drawing.');
      } else {
        toast.error('Failed to add drawing revision.');
      }
    }
  };

  const handleEditOpen = (drawing) => {
    setEditForm({
      id: drawing.id,
      drawingNumber: drawing.drawing_number,
      revisionCode: drawing.revision_code,
      title: drawing.title,
      status: drawing.status,
      issuedDate: drawing.issued_date ? new Date(drawing.issued_date).toISOString().split('T')[0] : '',
      documentId: drawing.document_id
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        drawingNumber: editForm.drawingNumber.trim(),
        revisionCode: editForm.revisionCode.trim(),
        title: editForm.title.trim(),
        status: editForm.status,
        issuedDate: editForm.issuedDate,
        documentId: editForm.documentId
      };

      const res = await updateDrawingRegisterEntry(projectId, editForm.id, payload);
      if (res.data?.success) {
        toast.success('Drawing entry updated successfully!');
        setIsEditModalOpen(false);
        fetchDrawings();
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        toast.error('This drawing number and revision combination already exists.');
      } else {
        toast.error('Failed to update drawing details.');
      }
    }
  };

  const handleDelete = async (id, drawingNumber, revisionCode) => {
    if (!window.confirm(`Are you sure you want to delete drawing ${drawingNumber} Revision ${revisionCode}?`)) {
      return;
    }

    try {
      const res = await deleteDrawingRegisterEntry(projectId, id);
      if (res.data?.success) {
        toast.success('Drawing entry deleted successfully.');
        // If we deleted the drawing that was currently selected in history, close history details
        if (selectedDrawingNumber === drawingNumber) {
          setSelectedDrawingNumber(null);
        }
        fetchDrawings();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete drawing.');
    }
  };

  const selectedGroup = useMemo(() => {
    return groupedDrawings.find(g => g.drawingNumber === selectedDrawingNumber);
  }, [groupedDrawings, selectedDrawingNumber]);

  return (
    <div className={styles.container}>
      <div className={styles.topActions}>
        <div className={styles.searchFilter}>
          <Input
            placeholder="Search by drawing number or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.statusSelect}
          >
            <option value="All">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <Button variant="primary" onClick={() => setIsRegisterModalOpen(true)}>
          + Register Drawing
        </Button>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <Spinner size="lg" />
          <span>Loading drawing register...</span>
        </div>
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          title="No Drawings Found"
          description="Create structured drawings and revisions in the drawing register to ensure site teams access correct documents."
          actionLabel="+ Register Drawing"
          onAction={() => setIsRegisterModalOpen(true)}
        />
      ) : (
        <div className={styles.mainLayout}>
          <div className={styles.tableSection}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Drawing Number</th>
                  <th>Title</th>
                  <th>Rev</th>
                  <th>Status</th>
                  <th>Issued Date</th>
                  <th>File</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map(group => {
                  const active = group.activeRevision;
                  const hasHistory = group.revisions.length > 1;
                  return (
                    <tr 
                      key={active.drawing_number} 
                      className={`${styles.row} ${selectedDrawingNumber === active.drawing_number ? styles.rowSelected : ''}`}
                      onClick={() => setSelectedDrawingNumber(active.drawing_number)}
                    >
                      <td className={styles.drawingNo}>
                        {active.drawing_number}
                        {hasHistory && (
                          <span className={styles.historyBadge} title="Click to view revision history">
                            ⏱️ {group.revisions.length} revs
                          </span>
                        )}
                      </td>
                      <td className={styles.drawingTitle}>{active.title}</td>
                      <td>
                        <Badge variant="accent" size="sm">{active.revision_code}</Badge>
                      </td>
                      <td>
                        <Badge variant={STATUS_VARIANTS[active.status]} size="sm">
                          {STATUS_LABELS[active.status] || active.status}
                        </Badge>
                      </td>
                      <td>
                        {active.issued_date ? new Date(active.issued_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '—'}
                      </td>
                      <td>
                        {active.document_id ? (
                          <button 
                            className={styles.fileLink}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(active.document_id);
                            }}
                            title={`Download ${active.document_name || 'drawing file'}`}
                          >
                            💾 Download File
                          </button>
                        ) : (
                          <span className={styles.noFile}>No File</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className={styles.rowActions}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleRevisionOpen(group)}
                            title="Add new revision code"
                          >
                            🔄 Revise
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEditOpen(active)}
                          >
                            ✏️
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            style={{ color: 'var(--color-danger)' }}
                            onClick={() => handleDelete(active.id, active.drawing_number, active.revision_code)}
                          >
                            🗑️
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* History Details Sidebar */}
          {selectedGroup && (
            <div className={styles.historySidebar}>
              <div className={styles.sidebarHeader}>
                <div>
                  <h3>Drawing {selectedGroup.drawingNumber}</h3>
                  <p className={styles.sidebarSubtitle}>Revision History Trail</p>
                </div>
                <button 
                  className={styles.closeBtn} 
                  onClick={() => setSelectedDrawingNumber(null)}
                >
                  ✕
                </button>
              </div>

              <div className={styles.revisionList}>
                {selectedGroup.revisions.map((rev, index) => (
                  <div 
                    key={rev.id} 
                    className={`${styles.revisionCard} ${!rev.is_superseded ? styles.revisionCardActive : ''}`}
                  >
                    <div className={styles.revCardHeader}>
                      <span className={styles.revCode}>Revision {rev.revision_code}</span>
                      {rev.is_superseded ? (
                        <Badge variant="neutral" size="sm">Superseded</Badge>
                      ) : (
                        <Badge variant={STATUS_VARIANTS[rev.status]} size="sm">Latest Active</Badge>
                      )}
                    </div>

                    <h4 className={styles.revTitle}>{rev.title}</h4>

                    <div className={styles.revMetaGrid}>
                      <span>Status:</span>
                      <strong>{STATUS_LABELS[rev.status] || rev.status}</strong>
                      
                      <span>Issued:</span>
                      <span>{rev.issued_date ? new Date(rev.issued_date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      }) : '—'}</span>

                      <span>By:</span>
                      <span>{rev.issued_by_name || '—'}</span>
                    </div>

                    <div className={styles.revCardActions}>
                      {rev.document_id ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownload(rev.document_id)}
                        >
                          💾 Download
                        </Button>
                      ) : (
                        <span className={styles.noFile}>No associated file</span>
                      )}

                      <div className={styles.revCardRightActions}>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEditOpen(rev)}
                          title="Edit this revision"
                        >
                          ✏️
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          style={{ color: 'var(--color-danger)' }}
                          onClick={() => handleDelete(rev.id, rev.drawing_number, rev.revision_code)}
                          title="Delete this revision"
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Register Drawing Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => !uploading && setIsRegisterModalOpen(false)}
        title="Register New Project Drawing"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsRegisterModalOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRegisterSubmit} loading={uploading}>
              Register Drawing
            </Button>
          </>
        }
      >
        <form onSubmit={handleRegisterSubmit} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label className={styles.required}>Drawing Number</label>
            <Input
              placeholder="e.g. ARCH-A-101"
              value={registerForm.drawingNumber}
              onChange={(e) => setRegisterForm({ ...registerForm, drawingNumber: e.target.value })}
              required
              disabled={uploading}
            />
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.required}>Initial Revision Code</label>
              <Input
                placeholder="e.g. R0, A, Rev 0"
                value={registerForm.revisionCode}
                onChange={(e) => setRegisterForm({ ...registerForm, revisionCode: e.target.value })}
                required
                disabled={uploading}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.required}>Issued Date</label>
              <Input
                type="date"
                value={registerForm.issuedDate}
                onChange={(e) => setRegisterForm({ ...registerForm, issuedDate: e.target.value })}
                required
                disabled={uploading}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.required}>Drawing Title</label>
            <Input
              placeholder="e.g. Ground Floor Electrical Layout"
              value={registerForm.title}
              onChange={(e) => setRegisterForm({ ...registerForm, title: e.target.value })}
              required
              disabled={uploading}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.required}>Status</label>
            <select
              value={registerForm.status}
              onChange={(e) => setRegisterForm({ ...registerForm, status: e.target.value })}
              className={styles.modalSelect}
              disabled={uploading}
            >
              <option value="issued_for_approval">Issued for Approval</option>
              <option value="issued_for_construction">Issued for Construction</option>
              <option value="issued_for_info">Issued for Information</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Upload Drawing File (PDF / CAD / Image)</label>
            <input
              type="file"
              onChange={(e) => setRegisterForm({ ...registerForm, file: e.target.files[0] })}
              className={styles.fileInput}
              disabled={uploading}
            />
            {registerForm.file && (
              <span className={styles.fileDetails}>
                Selected: {registerForm.file.name} ({Math.round(registerForm.file.size / 1024)} KB)
              </span>
            )}
          </div>
        </form>
      </Modal>

      {/* Add Revision Modal */}
      <Modal
        isOpen={isRevisionModalOpen}
        onClose={() => !uploading && setIsRevisionModalOpen(false)}
        title={`Add Revision for Drawing ${revisionForm.drawingNumber}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsRevisionModalOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRevisionSubmit} loading={uploading}>
              Submit Revision
            </Button>
          </>
        }
      >
        <form onSubmit={handleRevisionSubmit} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.required}>New Revision Code</label>
              <Input
                placeholder="e.g. R1, B, Rev 1"
                value={revisionForm.revisionCode}
                onChange={(e) => setRevisionForm({ ...revisionForm, revisionCode: e.target.value })}
                required
                disabled={uploading}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.required}>Issued Date</label>
              <Input
                type="date"
                value={revisionForm.issuedDate}
                onChange={(e) => setRevisionForm({ ...revisionForm, issuedDate: e.target.value })}
                required
                disabled={uploading}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.required}>Drawing Title</label>
            <Input
              placeholder="Drawing Title"
              value={revisionForm.title}
              onChange={(e) => setRevisionForm({ ...revisionForm, title: e.target.value })}
              required
              disabled={uploading}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.required}>Status</label>
            <select
              value={revisionForm.status}
              onChange={(e) => setRevisionForm({ ...revisionForm, status: e.target.value })}
              className={styles.modalSelect}
              disabled={uploading}
            >
              <option value="issued_for_approval">Issued for Approval</option>
              <option value="issued_for_construction">Issued for Construction</option>
              <option value="issued_for_info">Issued for Information</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Upload Drawing File (PDF / CAD / Image)</label>
            <input
              type="file"
              onChange={(e) => setRevisionForm({ ...revisionForm, file: e.target.files[0] })}
              className={styles.fileInput}
              disabled={uploading}
            />
            {revisionForm.file && (
              <span className={styles.fileDetails}>
                Selected: {revisionForm.file.name} ({Math.round(revisionForm.file.size / 1024)} KB)
              </span>
            )}
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Drawing Register Details"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleEditSubmit}>
              Save Changes
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.required}>Drawing Number</label>
              <Input
                value={editForm.drawingNumber}
                onChange={(e) => setEditForm({ ...editForm, drawingNumber: e.target.value })}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.required}>Revision Code</label>
              <Input
                value={editForm.revisionCode}
                onChange={(e) => setEditForm({ ...editForm, revisionCode: e.target.value })}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.required}>Drawing Title</label>
            <Input
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.required}>Issued Date</label>
              <Input
                type="date"
                value={editForm.issuedDate}
                onChange={(e) => setEditForm({ ...editForm, issuedDate: e.target.value })}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.required}>Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className={styles.modalSelect}
              >
                <option value="issued_for_approval">Issued for Approval</option>
                <option value="issued_for_construction">Issued for Construction</option>
                <option value="superseded">Superseded</option>
                <option value="issued_for_info">Issued for Information</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
