import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ContentLoader from '../../components/ui/ContentLoader';

const TABS = ['Overview', 'Tasks', 'Files', 'Financials', 'Notes'];

export default function ProjectDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(TABS[0]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [id]);

  return (
    <div className="p-4 sm:p-6 flex flex-col h-full">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold mb-4">Project Detail</h1>
        
        {/* Scrollable Tabs Container */}
        <div className="w-full overflow-x-auto pb-2 -mb-2 border-b border-gray-200 hide-scrollbar">
          <div className="flex gap-6 min-w-max px-1">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <ContentLoader type="list" rows={4} />
        ) : (
          <div className="text-gray-500 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            Content for {activeTab} of project {id}.
          </div>
        )}
      </div>
    </div>
  );
}
