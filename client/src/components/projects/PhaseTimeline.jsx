import React, { useState, useEffect } from 'react';
import { getMilestones, completeMilestone, signOffPhase } from '../../api/projects';

const PhaseTimeline = ({ projectId, phases = [], onUpdate }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [milestonesByPhase, setMilestonesByPhase] = useState({});
  const [loadingPhase, setLoadingPhase] = useState(null);

  // Auto-expand first in-progress phase on initial mount
  useEffect(() => {
    if (phases.length > 0 && !expandedId) {
      const activePhase = phases.find(p => p.status === 'in_progress') || phases[0];
      handleExpand(activePhase.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases]);

  const handleExpand = async (phaseId) => {
    setExpandedId(phaseId);
    if (!milestonesByPhase[phaseId]) {
      setLoadingPhase(phaseId);
      try {
        const res = await getMilestones(phaseId);
        setMilestonesByPhase(prev => ({ ...prev, [phaseId]: res.data.data }));
      } catch (e) {
        console.error('Failed to load milestones:', e);
      } finally {
        setLoadingPhase(null);
      }
    }
  };

  const handleCompleteMilestone = async (phaseId, mid) => {
    try {
      await completeMilestone(phaseId, mid);
      // Optimistically update the UI to prevent lag
      setMilestonesByPhase(prev => ({
        ...prev,
        [phaseId]: prev[phaseId].map(m => m.id === mid ? { ...m, status: 'completed' } : m)
      }));
    } catch (e) {
      console.error(e);
      alert('Failed to complete milestone');
    }
  };

  const handleSignOff = async (phaseId) => {
    try {
      await signOffPhase(projectId, phaseId);
      if (onUpdate) onUpdate(); // Trigger parent re-fetch to bubble changes to the main stats header
    } catch (e) {
      if (e.response?.data?.code === 'MILESTONES_INCOMPLETE') {
        const pending = e.response.data.details || [];
        alert(`Cannot sign off. The following milestones are still pending: \n\n- ${pending.join('\n- ')}`);
      } else {
        alert(e.response?.data?.message || 'Failed to sign off phase');
      }
    }
  };

  if (!phases || phases.length === 0) {
    return <div className="text-center p-12 text-slate-400 bg-slate-800/20 rounded-xl border border-slate-700 border-dashed">No phases configured for this project yet.</div>;
  }

  return (
    <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-6 shadow-xl shadow-black/10 animate-in fade-in duration-300">
      
      {/* Horizontal Stepper */}
      <div className="flex items-center w-full mb-4 overflow-x-auto pb-6 hide-scrollbar px-4 pt-4">
        {phases.map((phase, index) => {
          const isCompleted = phase.status === 'completed';
          const isInProgress = phase.status === 'in_progress';
          const isLast = index === phases.length - 1;
          const isExpanded = expandedId === phase.id;

          return (
            <div key={phase.id} className="flex items-center min-w-[140px] flex-1 relative">
              <div 
                className={`flex flex-col items-center z-10 cursor-pointer transition-all duration-300 ease-out hover:scale-110 ${isExpanded ? 'scale-110' : ''}`}
                onClick={() => handleExpand(phase.id)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-[3px] transition-all shadow-lg
                  ${isCompleted ? 'bg-green-500 border-green-400 text-slate-900 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 
                    isInProgress ? 'bg-blue-900 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 
                    'bg-slate-800 border-slate-600 text-slate-500 hover:border-slate-400'}`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isInProgress ? (
                    <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2v20c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                    </svg>
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  )}
                </div>
                <div className={`mt-3 text-[11px] font-extrabold text-center w-32 whitespace-normal uppercase tracking-widest transition-colors ${isExpanded ? 'text-blue-400 drop-shadow-md' : isCompleted ? 'text-green-400' : 'text-slate-500'}`}>
                  {phase.name}
                </div>
              </div>

              {/* Connecting Track */}
              {!isLast && (
                <div className="flex-1 h-1.5 mx-2 bg-slate-700/50 rounded-full overflow-hidden relative shadow-inner" style={{ top: '-18px' }}>
                  <div className={`h-full transition-all duration-1000 ease-in-out ${isCompleted ? 'bg-green-500' : 'bg-transparent'}`} style={{ width: '100%' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded Details Panel */}
      {expandedId && (
        <div className="mt-4 bg-slate-900/60 border border-slate-700 rounded-xl p-8 shadow-inner animate-in slide-in-from-top-4 duration-300">
          {(() => {
            const phase = phases.find(p => p.id === expandedId);
            const milestones = milestonesByPhase[expandedId] || [];
            const isLoading = loadingPhase === expandedId;
            const allCompleted = milestones.length > 0 && milestones.every(m => m.status === 'completed');

            return (
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-slate-800 pb-6 gap-4">
                  <div>
                    <h4 className="text-2xl font-black text-white tracking-tight mb-2">{phase.name}</h4>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {phase.duration_days ? `${phase.duration_days} Days Allocated` : 'Flexible Duration'}
                      </span>
                      {phase.start_date && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                          <span>Started: {new Date(phase.start_date).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {phase.status !== 'completed' && (
                    <button 
                      onClick={() => handleSignOff(phase.id)}
                      className={`px-6 py-3 rounded-lg text-[11px] font-extrabold uppercase tracking-widest shadow-lg transition-all
                        ${allCompleted ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_15px_rgba(22,163,74,0.4)] hover:shadow-[0_0_20px_rgba(22,163,74,0.6)] transform hover:-translate-y-0.5' : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}`}
                    >
                      Sign Off Phase
                    </button>
                  )}
                  {phase.status === 'completed' && (
                    <div className="px-5 py-2.5 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      Verified Complete
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Key Milestones</h5>
                  {isLoading ? (
                    <div className="flex items-center gap-3 text-slate-400 py-6 pl-1">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                      <span className="text-sm font-bold tracking-wide">Syncing milestones...</span>
                    </div>
                  ) : milestones.length === 0 ? (
                    <div className="p-6 bg-slate-800/30 rounded-xl border border-slate-700/50 border-dashed text-center">
                      <p className="text-sm font-medium text-slate-500">No milestone checkpoints defined for this phase.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {milestones.map(m => {
                        const isDone = m.status === 'completed';
                        return (
                          <div key={m.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${isDone ? 'bg-slate-800/50 border-slate-700/50 shadow-inner' : 'bg-slate-800 border-slate-600 hover:border-blue-500/50 hover:shadow-lg hover:-translate-y-0.5'}`}>
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => !isDone && handleCompleteMilestone(phase.id, m.id)}
                                disabled={isDone || phase.status === 'completed'}
                                className={`w-7 h-7 rounded-md flex items-center justify-center transition-all shadow-inner
                                  ${isDone ? 'bg-green-500 text-slate-900 border-none shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-slate-900 border border-slate-500 hover:border-blue-400 hover:shadow-[0_0_10px_rgba(59,130,246,0.3)]'}`}
                              >
                                {isDone && (
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                              <div>
                                <p className={`font-bold text-sm ${isDone ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{m.name}</p>
                                {m.due_date && <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Target: {new Date(m.due_date).toLocaleDateString()}</p>}
                              </div>
                            </div>
                            {m.triggers_payment && (
                              <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-md shadow-sm flex items-center gap-1.5">
                                <span className="text-sm">💰</span> Payment Block
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default PhaseTimeline;
