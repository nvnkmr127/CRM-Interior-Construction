import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Cmd+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length >= 2) {
        performSearch();
      } else {
        setResults(null);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/search?q=${query}&types=leads,projects,tasks`);
      if (res.data.success) {
        setResults(res.data.data);
        setIsOpen(true);
      }
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (path) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="relative w-64 md:w-96" ref={searchRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-400">🔍</span>
        </div>
        <input
          id="global-search-input"
          type="text"
          className="block w-full pl-10 pr-12 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="Search leads, projects... (Cmd+K)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results) setIsOpen(true); }}
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
          </div>
        )}
      </div>

      {isOpen && results && (
        <div className="absolute z-50 mt-1 w-full bg-white shadow-lg max-h-96 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          
          {/* Leads */}
          {results.leads && results.leads.length > 0 && (
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Leads</h3>
              <ul className="space-y-1">
                {results.leads.map(lead => (
                  <li 
                    key={lead.id} 
                    className="cursor-pointer hover:bg-gray-100 p-2 rounded-md transition-colors"
                    onClick={() => navigateTo(`/leads`)} // Assuming drawer takes over in /leads
                  >
                    <div className="font-medium text-gray-900">{lead.name}</div>
                    <div className="text-xs text-gray-500 flex gap-2">
                      {lead.phone && <span>{lead.phone}</span>}
                      {lead.email && <span>• {lead.email}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Projects */}
          {results.projects && results.projects.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Projects</h3>
              <ul className="space-y-1">
                {results.projects.map(proj => (
                  <li 
                    key={proj.id} 
                    className="cursor-pointer hover:bg-gray-100 p-2 rounded-md transition-colors"
                    onClick={() => navigateTo(`/projects/${proj.id}`)}
                  >
                    <div className="font-medium text-gray-900">{proj.name}</div>
                    <div className="text-xs text-gray-500">Client: {proj.client_name}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tasks */}
          {results.tasks && results.tasks.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tasks</h3>
              <ul className="space-y-1">
                {results.tasks.map(task => (
                  <li 
                    key={task.id} 
                    className="cursor-pointer hover:bg-gray-100 p-2 rounded-md transition-colors"
                    onClick={() => navigateTo(`/projects/${task.project_id}`)}
                  >
                    <div className="font-medium text-gray-900">{task.title}</div>
                    <div className="text-xs text-gray-500">Project: {task.project_name}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(!results.leads?.length && !results.projects?.length && !results.tasks?.length) && (
            <div className="px-4 py-8 text-center text-gray-500">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
