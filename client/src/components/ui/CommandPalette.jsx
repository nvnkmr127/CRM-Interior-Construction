import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const COMMANDS = [
  { id: 'nav-dashboard', title: 'Go to Dashboard', icon: '📊', path: '/dashboard' },
  { id: 'nav-leads', title: 'Go to Leads', icon: '👥', path: '/leads' },
  { id: 'nav-projects', title: 'Go to Projects', icon: '🏗️', path: '/projects' },
  { id: 'nav-tasks', title: 'My Tasks', icon: '✅', path: '/tasks' },
  { id: 'nav-analytics', title: 'Lead Analytics', icon: '📈', path: '/analytics/leads' },
  { id: 'nav-settings', title: 'Preferences', icon: '⚙️', path: '/settings/preferences' },
  { id: 'action-new-lead', title: 'Create New Lead', icon: '✨', action: 'CREATE_LEAD' },
];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredCommands = COMMANDS.filter(cmd => 
    cmd.title.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [query]);

  const executeCommand = (cmd) => {
    if (cmd.path) {
      navigate(cmd.path);
    } else if (cmd.action === 'CREATE_LEAD') {
      navigate('/leads?new=true'); // Or trigger a global state
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        executeCommand(filteredCommands[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 sm:pt-48 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
      <div 
        className="w-full max-w-xl bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/40 ring-1 ring-black/5 transform transition-all"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative border-b border-gray-200/50">
          <svg className="absolute left-4 top-3.5 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-0 py-3.5 pl-12 pr-4 text-gray-900 placeholder-gray-500 focus:ring-0 sm:text-sm"
            placeholder="Search commands, navigate, or create..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <ul className="max-h-80 overflow-y-auto p-2 scroll-py-2 space-y-1">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, index) => (
              <li
                key={cmd.id}
                className={`flex items-center px-4 py-2.5 cursor-pointer rounded-xl transition-colors ${index === selectedIndex ? 'bg-blue-600/10 text-blue-700' : 'text-gray-700 hover:bg-gray-100/50'}`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="mr-3 text-lg">{cmd.icon}</span>
                <span className={`text-sm font-medium ${index === selectedIndex ? 'text-blue-700' : 'text-gray-700'}`}>{cmd.title}</span>
                {index === selectedIndex && (
                  <span className="ml-auto text-xs text-blue-500 flex items-center gap-1">
                    ↵ Enter
                  </span>
                )}
              </li>
            ))
          ) : (
            <li className="p-4 text-center text-sm text-gray-500">
              No commands found for "{query}".
            </li>
          )}
        </ul>
        <div className="bg-gray-50/50 px-4 py-3 text-xs text-gray-500 flex items-center justify-between border-t border-gray-100/50">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-sans font-medium text-gray-500">↑</kbd><kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-sans font-medium text-gray-500">↓</kbd> to navigate</span>
            <span className="flex items-center gap-1"><kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-sans font-medium text-gray-500">↵</kbd> to select</span>
          </div>
          <span className="flex items-center gap-1"><kbd className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-sans font-medium text-gray-500">esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
