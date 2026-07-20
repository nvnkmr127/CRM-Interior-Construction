import React, { useState, useEffect, useRef } from 'react';
import styles from './DocumentPreviewModal.module.css';

/**
 * Supported File Types:
 * image/* (png, jpg, jpeg, webp) -> Native img with zoom/rotate
 * application/pdf -> iframe PDF viewer
 * application/vnd.ms-excel, .xlsx, .csv, .doc, .docx -> Office Online Viewer Embed
 */
export default function DocumentPreviewModal({ isOpen, onClose, documents = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Reset transformations when opening
      setZoom(1);
      setRotation(0);
    } else {
      document.body.style.overflow = '';
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => console.log(err));
      }
      setIsFullscreen(false);
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Reset zoom/rotation when switching documents
  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [activeIndex]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleReset = () => { setZoom(1); setRotation(0); };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const activeDoc = documents[activeIndex];

  const renderIcon = (type) => {
    const t = type.toLowerCase();
    if (t.includes('pdf')) return '📄';
    if (t.includes('image') || t.includes('png') || t.includes('jpg')) return '🖼️';
    if (t.includes('excel') || t.includes('csv') || t.includes('sheet') || t.includes('xlsx')) return '📊';
    if (t.includes('word') || t.includes('doc')) return '📝';
    return '📎';
  };

  const getViewerUrl = (doc) => {
    const t = doc.type.toLowerCase();
    if (t.includes('pdf')) {
      return `${doc.url}#toolbar=0&navpanes=0&scrollbar=0`;
    }
    if (t.includes('excel') || t.includes('sheet') || t.includes('xlsx') || t.includes('csv') || t.includes('word') || t.includes('doc')) {
      // Microsoft Office Viewer needs a public URL
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(doc.url)}`;
    }
    return doc.url;
  };

  const renderViewer = () => {
    if (!activeDoc) return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>📁</div>
        <h3>No Document Selected</h3>
      </div>
    );

    const t = activeDoc.type.toLowerCase();
    const isImage = t.includes('image') || t.includes('png') || t.includes('jpg');

    if (isImage) {
      return (
        <div className={styles.viewerContainer}>
          <img 
            src={activeDoc.url} 
            alt={activeDoc.name}
            className={styles.imageViewer}
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            draggable="false"
          />
        </div>
      );
    }

    return (
      <div className={styles.viewerContainer}>
        <iframe 
          src={getViewerUrl(activeDoc)}
          className={styles.iframeViewer}
          title={activeDoc.name}
          allowFullScreen
        ></iframe>
      </div>
    );
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        ref={modalRef}
        className={`${styles.modalContent} ${isFullscreen ? styles.fullscreen : ''}`} 
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.iconButton} onClick={onClose} title="Close">
              ×
            </div>
            <h2 className={styles.headerTitle}>Document Preview</h2>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconButton} onClick={toggleFullscreen} title="Toggle Fullscreen">
              {isFullscreen ? '🗗' : '🖵'}
            </button>
            <button className={styles.iconButton} onClick={() => {
               // Optional: Trigger download if they want
               const a = document.createElement('a');
               a.href = activeDoc?.url || '#';
               a.download = activeDoc?.name || 'document';
               a.target = '_blank';
               a.click();
            }} title="Download">
              ⬇️
            </button>
          </div>
        </div>

        <div className={styles.mainBody}>
          {/* Sidebar for multiple documents */}
          {documents.length > 1 && (
            <div className={styles.sidebar}>
              {documents.map((doc, idx) => (
                <div 
                  key={idx}
                  className={`${styles.docItem} ${idx === activeIndex ? styles.active : ''}`}
                  onClick={() => setActiveIndex(idx)}
                >
                  <div className={styles.docIcon}>{renderIcon(doc.type)}</div>
                  <div className={styles.docInfo}>
                    <span className={styles.docName} title={doc.name}>{doc.name}</span>
                    <span className={styles.docType}>{doc.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Main Preview Area */}
          <div className={styles.previewArea}>
            {renderViewer()}
            
            {/* Toolbar (Only for Images) */}
            {activeDoc && (activeDoc.type.toLowerCase().includes('image') || activeDoc.type.toLowerCase().includes('png') || activeDoc.type.toLowerCase().includes('jpg')) && (
              <div className={styles.previewToolbar}>
                <button className={styles.toolbarBtn} onClick={handleZoomOut} title="Zoom Out">➖</button>
                <span className={styles.toolbarText}>{Math.round(zoom * 100)}%</span>
                <button className={styles.toolbarBtn} onClick={handleZoomIn} title="Zoom In">➕</button>
                <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }}></div>
                <button className={styles.toolbarBtn} onClick={handleRotate} title="Rotate 90°">↻</button>
                <button className={styles.toolbarBtn} onClick={handleReset} title="Reset">⟲</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
