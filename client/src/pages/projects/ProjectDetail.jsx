import React, { useState, useEffect, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject } from '../../api/projects';

// Lazy loaded submodules
const PhaseTimeline = React.lazy(() => import('../../components/projects/PhaseTimeline'));
const TaskKanban = React.lazy(() => import('../../components/tasks/TaskKanban'));
const TaskList = React.lazy(() => import('../../components/tasks/TaskList'));
const DocumentPanel = React.lazy(() => import('../../components/projects/DocumentPanel'));

const FallbackLoader = () => (
  <div className="flex justify-center items-center py-20">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [taskView, setTaskView] = useState('kanban');

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await getProject(id);
      setProject(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  if (loading) return <FallbackLoader />;
  if (!project) return <div className="text-center py-20 text-slate-400">Project not found.</div>;

  const stats = project.stats || {};
  const progress = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
      <div className="col-span-2 space-y-6">
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 shadow-lg shadow-black/20">
          <h3 className="text-lg font-bold text-white mb-6">Project Information</h3>
          <div className="grid grid-cols-2 gap-y-6 gap-x-8">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Project Manager</p>
              <div className="flex items-center gap-2">
                {project.pm_name ? <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">{project.pm_name.charAt(0)}</div> : null}
                <p className="text-slate-300 font-medium text-sm">{project.pm_name || 'Unassigned'}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Lead Designer</p>
              <div className="flex items-center gap-2">
                {project.designer_name ? <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">{project.designer_name.charAt(0)}</div> : null}
                <p className="text-slate-300 font-medium text-sm">{project.designer_name || 'Unassigned'}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Start Date</p>
              <p className="text-slate-300 font-medium text-sm">{project.start_date ? new Date(project.start_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Target Date</p>
              <p className="text-slate-300 font-medium text-sm">{project.target_date ? new Date(project.target_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Site Address</p>
              <p className="text-slate-300 text-sm leading-relaxed">{project.site_address || 'No physical address configured.'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 shadow-lg shadow-black/20 h-full">
          <h3 className="text-lg font-bold text-white mb-6">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
              <div>
                <p className="text-sm font-medium text-slate-300">Project Initialized</p>
                <p className="text-[11px] text-slate-500 mt-0.5">System • {new Date(project.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 italic mt-4 pl-5">Audit trail integration pending...</p>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'phases', label: 'Phases & Milestones' },
    { id: 'tasks', label: 'Task Execution' },
    { id: 'documents', label: 'Documents & Designs' },
    { id: 'payments', label: 'Payment Triggers' }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-8 animate-in fade-in duration-500">
      {/* Header Profile */}
      <div className="mb-8">
        <Link to="/projects" className="text-[11px] font-bold text-blue-400 hover:text-blue-300 tracking-wider uppercase mb-4 inline-flex items-center gap-2 transition-colors">
          &larr; Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-extrabold text-white tracking-tight">{project.name}</h1>
              <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-md border ${project.status === 'active' ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : project.status === 'completed' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                {project.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
              <span className="text-slate-300 font-bold">{project.client_name}</span>
              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
              {project.project_type || 'General Construct'}
            </p>
          </div>
          <button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-sm">
            Edit Configuration
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 shadow-inner backdrop-blur-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Contract Target</p>
          <p className="text-2xl font-black text-white">{project.contract_value ? `₹${Number(project.contract_value).toLocaleString('en-IN')}` : 'TBD'}</p>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 shadow-inner backdrop-blur-sm">
          <div className="flex justify-between items-end mb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Progress</p>
            <p className="text-xs font-black text-blue-400">{progress}%</p>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2.5 mt-2 shadow-inner">
            <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.6)]" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 shadow-inner backdrop-blur-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Current Phase</p>
          <p className="text-lg font-bold text-slate-200 truncate">{project.current_phase_name || 'Idle'}</p>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 shadow-inner backdrop-blur-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Target Completion</p>
          <p className="text-lg font-bold text-slate-200">{project.target_date ? new Date(project.target_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}</p>
        </div>
      </div>

      {/* Tab Navigation Hub */}
      <div className="border-b border-slate-700/60 mb-8 bg-slate-900/50 pt-2 px-2 rounded-t-xl">
        <nav className="flex space-x-2 overflow-x-auto hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-bold whitespace-nowrap border-b-2 transition-all duration-200 ${activeTab === tab.id ? 'border-blue-500 text-blue-400 bg-slate-800/80 rounded-t-lg' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 rounded-t-lg'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Core Dynamic Content Container */}
      <div className="min-h-[500px]">
        {activeTab === 'overview' && renderOverview()}
        
        {activeTab === 'phases' && (
          <Suspense fallback={<FallbackLoader />}>
            <PhaseTimeline projectId={project.id} phases={project.phases} onUpdate={fetchDetail} />
          </Suspense>
        )}
        
        {activeTab === 'tasks' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-end mb-6">
              <div className="bg-slate-900 rounded-lg p-1 border border-slate-700 shadow-inner flex">
                <button onClick={() => setTaskView('kanban')} className={`px-5 py-2 rounded-md text-[11px] font-extrabold uppercase tracking-wider transition-all duration-200 ${taskView === 'kanban' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>Kanban</button>
                <button onClick={() => setTaskView('list')} className={`px-5 py-2 rounded-md text-[11px] font-extrabold uppercase tracking-wider transition-all duration-200 ${taskView === 'list' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>List</button>
              </div>
            </div>
            <Suspense fallback={<FallbackLoader />}>
              {taskView === 'kanban' ? <TaskKanban projectId={project.id} /> : <TaskList projectId={project.id} />}
            </Suspense>
          </div>
        )}

        {activeTab === 'documents' && (
          <Suspense fallback={<FallbackLoader />}>
            <DocumentPanel projectId={project.id} />
          </Suspense>
        )}

        {activeTab === 'payments' && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-12 text-center animate-in fade-in duration-300 shadow-inner">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 border border-slate-700">
              <span className="text-2xl">💰</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Payment Milestones Module</h3>
            <p className="text-slate-400 max-w-md mx-auto text-sm">Financial tracking and invoice triggering is currently under active development.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
