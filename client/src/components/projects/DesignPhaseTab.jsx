import React, { useState } from 'react';
import usePersistedTab from '../../hooks/usePersistedTab';
import DesignStageHeader from './DesignStageHeader';
import DesignRequirements from './DesignRequirements';
import DesignAssetsTab from './DesignAssetsTab';
import DesignReviewsTab from './DesignReviewsTab';
import MaterialPalettesTab from './MaterialPalettesTab';
import ProjectQuotationsTab from './ProjectQuotationsTab';
import CommercialApprovalTab from '../../pages/projects/CommercialApprovalTab';

export default function DesignPhaseTab({ projectId, project, onRefresh }) {
  const [activeSubTab, setActiveSubTab] = usePersistedTab('subtab', 'Design Brief', `proj:${projectId}:design`);

  const subTabs = [
    { id: 'Design Brief', icon: '📐', label: 'Design Brief' },
    { id: 'Design Assets', icon: '🎨', label: 'Design Assets' },
    { id: 'Design Reviews', icon: '👁️', label: 'Design Reviews' },
    { id: 'Material Palettes', icon: '🪨', label: 'Material Palettes' },
    { id: 'Quotations', icon: '🧾', label: 'Quotations & Budget' },
    { id: 'Commercial Approval', icon: '✅', label: 'Commercial Approval' }
  ];

  const renderContent = () => {
    switch (activeSubTab) {
      case 'Design Brief': return <DesignRequirements projectId={projectId} />;
      case 'Design Assets': return <DesignAssetsTab projectId={projectId} />;
      case 'Design Reviews': return <DesignReviewsTab projectId={projectId} />;
      case 'Material Palettes': return <MaterialPalettesTab projectId={projectId} />;
      case 'Quotations': return <ProjectQuotationsTab projectId={projectId} />;
      case 'Commercial Approval': return <CommercialApprovalTab projectId={projectId} projectStatus={project?.status} onProjectUpdated={onRefresh} />;
      default: return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <DesignStageHeader projectId={projectId} />
      
      {/* Sub-Navigation Pills */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        overflowX: 'auto', 
        paddingBottom: '12px', 
        scrollbarWidth: 'none',
        borderBottom: '1px solid var(--color-border)',
        marginBottom: '4px'
      }}>
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: activeSubTab === tab.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
              background: activeSubTab === tab.id ? 'var(--color-accent, #3b82f6)' : 'var(--color-surface, #fff)',
              color: activeSubTab === tab.id ? '#fff' : 'var(--color-text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div>
        {renderContent()}
      </div>
    </div>
  );
}
