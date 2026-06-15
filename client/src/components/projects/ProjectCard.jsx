import React from 'react';
import { Link } from 'react-router-dom';
import { differenceInDays } from 'date-fns';

const ProjectCard = ({ project }) => {
  const {
    id, name, client_name, status, pm_name,
    total_tasks = 0, completed_tasks = 0,
    target_date, contract_value, current_phase_name
  } = project;

  const progress = total_tasks > 0 ? Math.round((completed_tasks / total_tasks) * 100) : 0;
  
  const statusColors = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    on_hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  };

  const badgeClass = statusColors[status] || 'bg-blue-500/20 text-blue-400 border-blue-500/30';

  let dateText = '';
  if (target_date && status !== 'completed') {
    const diff = differenceInDays(new Date(target_date), new Date());
    if (diff < 0) {
      dateText = `Overdue by ${Math.abs(diff)} days`;
    } else {
      dateText = `${diff} days to target`;
    }
  }

  return (
    <Link to={`/projects/${id}`} className="block bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-500 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 group">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div className="overflow-hidden">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 truncate">{client_name}</p>
          <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">{name}</h3>
        </div>
        <span className={`px-2.5 py-1 border rounded-full text-xs font-semibold capitalize whitespace-nowrap ${badgeClass}`}>
          {status.replace('_', ' ')}
        </span>
      </div>

      <div className="mb-5 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-400 font-medium">Progress</span>
          <span className="font-bold text-slate-200">{progress}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
          <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[11px] text-slate-500 mt-2 font-medium tracking-wide">{completed_tasks} of {total_tasks} tasks</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Manager</p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shadow-inner">
              {pm_name ? pm_name.charAt(0) : '?'}
            </div>
            <span className="text-slate-300 text-xs font-medium truncate">{pm_name || 'Unassigned'}</span>
          </div>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Contract Value</p>
          <p className="text-slate-300 font-semibold text-sm">
            {contract_value ? `₹${Number(contract_value).toLocaleString('en-IN')}` : '-'}
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-slate-700/50 mt-1">
        <div className="text-xs text-slate-400 truncate pr-2 font-medium">
          {current_phase_name ? `Phase: ${current_phase_name}` : 'No active phase'}
        </div>
        <div className={`text-xs whitespace-nowrap font-bold ${dateText.includes('Overdue') ? 'text-red-400' : 'text-slate-500'}`}>
          {dateText}
        </div>
      </div>
    </Link>
  );
};

export default ProjectCard;
