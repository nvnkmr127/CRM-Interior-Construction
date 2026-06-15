import React, { useState, useEffect } from 'react';
import { getProjects, createProject } from '../../api/projects';
import ProjectCard from '../../components/projects/ProjectCard';
import ProjectForm from '../../components/projects/ProjectForm';
import { Link } from 'react-router-dom';

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden shadow-black/50">
        <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
          <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center hover:bg-slate-700">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await getProjects({ search, status: statusFilter });
      setProjects(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Add debounce in a real app, keeping simple here per prompt
    const delay = setTimeout(() => {
      fetchProjects();
    }, 300);
    return () => clearTimeout(delay);
  }, [search, statusFilter]);

  const handleCreate = async (data) => {
    try {
      await createProject(data);
      setIsModalOpen(false);
      fetchProjects();
    } catch (e) {
      console.error(e);
      alert('Failed to create project');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Projects Hub</h1>
          <p className="text-slate-400 mt-1.5 text-sm font-medium">Manage and track all ongoing construction and interior lifecycles.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] transform hover:-translate-y-0.5"
        >
          + New Project
        </button>
      </div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-900/80 border border-slate-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 w-full focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-900/80 border border-slate-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 w-full sm:w-40 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 w-full sm:w-auto shadow-inner">
          <button 
            onClick={() => setView('grid')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all duration-200 ${view === 'grid' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
          >
            Grid
          </button>
          <button 
            onClick={() => setView('list')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-all duration-200 ${view === 'list' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
          >
            List
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-24 bg-slate-800/20 rounded-2xl border border-slate-700/50 border-dashed">
          <p className="text-slate-400 font-medium mb-4">No projects found matching your filters.</p>
          <button onClick={() => {setSearch(''); setStatusFilter('')}} className="text-blue-400 hover:text-blue-300 font-semibold text-sm transition-colors">Clear Filters</button>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-max">
          {projects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden shadow-xl shadow-black/20">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 text-[11px] uppercase tracking-wider font-bold border-b border-slate-700">
              <tr>
                <th className="px-6 py-5">Name</th>
                <th className="px-6 py-5">Client</th>
                <th className="px-6 py-5">Manager</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5 w-48">Progress</th>
                <th className="px-6 py-5">Value</th>
                <th className="px-6 py-5">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {projects.map(p => {
                const progress = p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-700/40 transition-colors group">
                    <td className="px-6 py-4 font-bold text-white">
                      <Link to={`/projects/${p.id}`} className="hover:text-blue-400 transition-colors">{p.name}</Link>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-medium">{p.client_name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {p.pm_name ? (
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">{p.pm_name.charAt(0)}</div>
                        ) : null}
                        <span className="text-slate-300 font-medium">{p.pm_name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[11px] font-bold capitalize ${p.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : p.status === 'on_hold' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-700/50 text-slate-400 border border-slate-600'}`}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-900 rounded-full h-1.5 overflow-hidden shadow-inner">
                          <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-300 w-8">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-300">{p.contract_value ? `₹${Number(p.contract_value).toLocaleString('en-IN')}` : '-'}</td>
                    <td className="px-6 py-4 text-slate-400 font-medium">
                      {p.target_date ? new Date(p.target_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Project Setup">
        <ProjectForm onSubmit={handleCreate} onCancel={() => setIsModalOpen(false)} />
      </Modal>
    </div>
  );
};

export default ProjectsPage;
