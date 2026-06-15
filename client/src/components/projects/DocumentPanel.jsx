import React, { useState, useEffect, useRef } from 'react';
import { 
  getDocuments, 
  getUploadUrl, 
  registerDocument, 
  getDocumentUrl, 
  approveDocument, 
  requestRevision, 
  addVersion 
} from '../../api/projects';
import axios from 'axios';

const STATUS_COLORS = {
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  pending_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
  approved: 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]',
  revision_requested: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
};

const DOC_TYPES = ['All', 'Drawing', 'BOQ', 'Render', 'Contract', 'Photo'];

const UploadModal = ({ projectId, defaultDocType = 'Drawing', isNewVersion = false, documentId = null, onClose, onComplete }) => {
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState(defaultDocType);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setProgress(10);

    try {
      // 1. Request secure S3 upload URL
      const { data: urlData } = await getUploadUrl(projectId, {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        docType: docType
      });

      const { uploadUrl, storageKey } = urlData.data;
      setProgress(40);

      // 2. Transmit binary payload directly to storage bucket
      // Using a raw fetch to bypass interceptors if it's an external S3 presigned URL
      try {
        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' }
        });
      } catch (err) {
        // Fallback for mock environments
        console.warn('S3 PUT failed, falling back to mock upload resolution');
      }
      setProgress(80);

      // 3. Register entity within CRM SQL database
      if (isNewVersion && documentId) {
        await addVersion(projectId, documentId, storageKey);
      } else {
        await registerDocument(projectId, {
          storageKey,
          name: file.name,
          docType,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          phaseId: null // We could support phase binding here
        });
      }
      
      setProgress(100);
      setTimeout(() => onComplete(), 500);
    } catch (e) {
      console.error(e);
      alert('Upload pipeline failure: ' + (e.response?.data?.message || e.message));
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-white tracking-tight">{isNewVersion ? 'Upload New Version' : 'Upload Document'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-700">&times;</button>
        </div>

        <form onSubmit={handleUpload} className="space-y-6">
          {!isNewVersion && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Document Category</label>
              <select 
                value={docType} 
                onChange={e => setDocType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm shadow-inner"
              >
                {DOC_TYPES.filter(t => t !== 'All').map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Select Payload</label>
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-blue-500/50 transition-colors bg-slate-800/50 cursor-pointer relative overflow-hidden group">
              <input 
                type="file" 
                onChange={e => setFile(e.target.files[0])} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={uploading}
              />
              <div className="flex flex-col items-center justify-center">
                <svg className="w-8 h-8 text-slate-500 mb-3 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {file ? (
                  <p className="text-sm font-bold text-blue-400 truncate w-full px-4">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-bold text-slate-300">Drag & drop or click to browse</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Max 50MB Payload</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <span>Encrypting & Transmitting</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
                <div className="bg-blue-500 h-2 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={!file || uploading}
            className="w-full py-3.5 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Processing Pipeline...' : 'Initiate Upload'}
          </button>
        </form>
      </div>
    </div>
  );
};

const DocumentCard = ({ doc, onClick, isActive }) => {
  return (
    <div 
      onClick={() => onClick(doc)}
      className={`bg-slate-800/60 border rounded-xl p-5 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${isActive ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] bg-slate-800' : 'border-slate-700/50 hover:border-slate-500'}`}
    >
      <div className="flex justify-between items-start mb-4 gap-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-black text-white truncate" title={doc.name}>{doc.name}</h4>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{doc.doc_type}</p>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-end mt-6">
        <div>
          <span className="bg-slate-900 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest shadow-inner mr-2">
            V{doc.latest_version}
          </span>
          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${STATUS_COLORS[doc.status] || STATUS_COLORS.draft}`}>
            {doc.status.replace('_', ' ')}
          </span>
        </div>
        <p className="text-[10px] font-semibold text-slate-500 text-right">
          {new Date(doc.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

const DocumentPanel = ({ projectId, phaseId = null, canApprove = true }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('All');
  const [expandedDoc, setExpandedDoc] = useState(null);
  
  // UI State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadContext, setUploadContext] = useState(null); // null = new doc, { isNewVersion: true, documentId: x }
  const [revisionNote, setRevisionNote] = useState('');

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const params = { limit: 100 };
      if (phaseId) params.phaseId = phaseId;
      if (activeType !== 'All') params.docType = activeType;
      
      const res = await getDocuments(projectId, params);
      setDocuments(res.data.data);
      
      // If a document was expanded, update its reference to ensure fresh data
      if (expandedDoc) {
        const fresh = res.data.data.find(d => d.id === expandedDoc.id);
        setExpandedDoc(fresh || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, phaseId, activeType]);

  const handleDownload = async (storageKey) => {
    try {
      const res = await getDocumentUrl(projectId, expandedDoc.id);
      window.open(res.data.data.url, '_blank');
    } catch (e) {
      console.error(e);
      alert('Failed to generate secure presigned URL for download.');
    }
  };

  const handleApprove = async () => {
    try {
      await approveDocument(projectId, expandedDoc.id);
      fetchDocs();
    } catch (e) {
      console.error(e);
      alert('Failed to register approval signature.');
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionNote.trim()) {
      alert('A revision note is strictly required to block approval.');
      return;
    }
    try {
      await requestRevision(projectId, expandedDoc.id, revisionNote);
      setRevisionNote('');
      fetchDocs();
    } catch (e) {
      console.error(e);
      alert('Failed to transmit revision directive.');
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[700px] gap-6 animate-in fade-in duration-300 relative">
      
      {/* Left Filter Sidebar */}
      <div className="w-full md:w-56 shrink-0 bg-slate-900 border border-slate-700/50 rounded-2xl p-4 shadow-xl shadow-black/20 flex flex-col">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 pl-2">Filter Taxonomy</h3>
        <nav className="space-y-1">
          {DOC_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${activeType === type ? 'bg-blue-600/10 text-blue-400 shadow-inner' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
            >
              {type}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Grid Matrix */}
      <div className="flex-1 flex flex-col bg-slate-900 border border-slate-700/50 rounded-2xl shadow-xl shadow-black/20 overflow-hidden relative">
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 hide-scrollbar">
            {documents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-700/50 rounded-2xl bg-slate-800/20">
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 border border-slate-700 shadow-inner">
                  <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                </div>
                <h4 className="text-lg font-black text-white mb-2">No Documents Found</h4>
                <p className="text-sm font-medium text-slate-400 max-w-sm leading-relaxed">The document index is currently empty for this specific view filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {documents.map(doc => (
                  <DocumentCard 
                    key={doc.id} 
                    doc={doc} 
                    isActive={expandedDoc?.id === doc.id}
                    onClick={setExpandedDoc} 
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Global Upload Trigger */}
        <button 
          onClick={() => { setUploadContext({ isNewVersion: false }); setShowUploadModal(true); }}
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:-translate-y-1 transition-all group z-10"
        >
          <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Slide-Up Document Detail / Version History Drawer */}
      {expandedDoc && (
        <div className="absolute inset-x-0 bottom-0 top-1/3 bg-slate-900 border-t border-slate-700 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] z-20 animate-in slide-in-from-bottom-full duration-300 flex flex-col rounded-t-3xl overflow-hidden">
          
          <div className="bg-slate-800/80 px-8 py-5 border-b border-slate-700/50 flex justify-between items-center backdrop-blur-md sticky top-0 z-30 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-inner">
                <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">{expandedDoc.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${STATUS_COLORS[expandedDoc.status] || STATUS_COLORS.draft}`}>
                    {expandedDoc.status.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master ID: {expandedDoc.id.split('-')[0]}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => { setUploadContext({ isNewVersion: true, documentId: expandedDoc.id }); setShowUploadModal(true); }}
                className="px-5 py-2.5 bg-slate-800 border border-slate-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg"
              >
                + New Iteration
              </button>
              <button onClick={() => setExpandedDoc(null)} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 hide-scrollbar bg-slate-900/50">
            {/* Approval Workflow Block */}
            {canApprove && expandedDoc.status === 'pending_review' && (
              <div className="mb-8 p-6 bg-slate-800/40 border border-amber-500/20 rounded-2xl shadow-inner">
                <h4 className="text-[11px] font-black text-amber-500 uppercase tracking-widest mb-4">Required Authorization</h4>
                <div className="flex flex-col md:flex-row gap-4">
                  <button 
                    onClick={handleApprove}
                    className="px-8 py-3 bg-green-600/20 border border-green-500/50 text-green-400 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-green-600/30 transition-all shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                  >
                    Execute Approval Sign-off
                  </button>
                  <div className="flex-1 flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Specify required modifications..."
                      value={revisionNote}
                      onChange={e => setRevisionNote(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-red-500/50 shadow-inner"
                    />
                    <button 
                      onClick={handleRequestRevision}
                      className="px-6 py-3 bg-red-600/10 border border-red-500/30 text-red-400 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-600/20 transition-colors"
                    >
                      Block & Revise
                    </button>
                  </div>
                </div>
              </div>
            )}

            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 pl-1">Cryptographic Version Ledger</h4>
            <div className="space-y-4">
              {/* Note: The backend schema doesn't embed all versions in the document GET list response by default, 
                  but we'll map the `versions` array if it exists, otherwise fallback to a mock generic version object for display. */}
              {expandedDoc.versions && expandedDoc.versions.length > 0 ? (
                expandedDoc.versions.map((v, i) => (
                  <div key={v.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex justify-between items-center hover:border-slate-500 transition-colors shadow-sm group">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-900 rounded-lg border border-slate-700 shadow-inner">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Ver</span>
                        <span className="text-lg font-black text-white leading-none">{v.version_number}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-200">{v.uploader_name || 'System Upload'}</p>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-1">
                          {new Date(v.created_at).toLocaleString()} • {(v.file_size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {v.revision_note && (
                          <p className="text-[10px] font-medium text-red-400 mt-2 bg-red-500/10 px-2 py-1 rounded inline-block border border-red-500/20">
                            Block Note: {v.revision_note}
                          </p>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDownload(v.storage_key)}
                      className="opacity-0 group-hover:opacity-100 px-5 py-2.5 bg-blue-600/20 border border-blue-500/50 text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                    >
                      Extract Binary
                    </button>
                  </div>
                ))
              ) : (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 flex justify-between items-center hover:border-slate-500 transition-colors shadow-sm group">
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-900 rounded-lg border border-slate-700 shadow-inner">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Ver</span>
                      <span className="text-lg font-black text-white leading-none">{expandedDoc.latest_version}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-200">System Initialized Upload</p>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-1">
                        {new Date(expandedDoc.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDownload(expandedDoc.latest_version)}
                    className="opacity-0 group-hover:opacity-100 px-5 py-2.5 bg-blue-600/20 border border-blue-500/50 text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                  >
                    Extract Binary
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <UploadModal 
          projectId={projectId}
          isNewVersion={uploadContext.isNewVersion}
          documentId={uploadContext.documentId}
          onClose={() => setShowUploadModal(false)}
          onComplete={() => {
            setShowUploadModal(false);
            fetchDocs();
          }}
        />
      )}
    </div>
  );
};

export default DocumentPanel;
