const fs = require('fs');

const path = 'client/src/pages/config/UsersManager.jsx';
let content = fs.readFileSync(path, 'utf8');

// Imports
content = content.replace(
  "import InitiateOffboardingModal from '../../components/offboarding/InitiateOffboardingModal'",
  "import InitiateOffboardingModal from '../../components/offboarding/InitiateOffboardingModal'\nimport ContextMenu from '../../components/ui/ContextMenu'\nimport UserGridCard from '../../components/ui/UserGridCard'\nimport { Dropdown } from '../../components/ui'"
);

// State
content = content.replace(
  "const [offboardingTarget, setOffboardingTarget] = useState(null)",
  `const [offboardingTarget, setOffboardingTarget] = useState(null)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('users_view_mode') || 'table')
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('users_visible_cols')
    return saved ? JSON.parse(saved) : ['user', 'role', 'status', 'lastActive', 'actions']
  })
  const [contextMenu, setContextMenu] = useState(null)`
);

// Effects
const effectsAdd = `
  useEffect(() => {
    localStorage.setItem('users_view_mode', viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem('users_visible_cols', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setIsAddMemberOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.querySelector('input[type="text"]')?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
`;

content = content.replace(
  "const fetchUsers = (currentFilters = filters) => {",
  `${effectsAdd}\n\n  const fetchUsers = (currentFilters = filters) => {`
);

// UI controls
const controlsStr = `
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                <button 
                  style={{ padding: '4px 8px', border: 'none', background: viewMode === 'table' ? 'var(--color-surface-hover)' : 'transparent', cursor: 'pointer' }}
                  onClick={() => setViewMode('table')}
                >Table</button>
                <button 
                  style={{ padding: '4px 8px', border: 'none', background: viewMode === 'grid' ? 'var(--color-surface-hover)' : 'transparent', cursor: 'pointer' }}
                  onClick={() => setViewMode('grid')}
                >Grid</button>
              </div>
              <Button variant="secondary" onClick={() => setShowImportExport(true)}>Import / Export</Button>
              <Button variant="secondary" onClick={() => setBulkModalType('add')}>Bulk Add</Button>
              <Button variant="primary" onClick={() => setIsAddMemberOpen(true)}>+ Add Team Member (Cmd+N)</Button>
            </div>
`;
content = content.replace(
  /<div style=\{\{ display: 'flex', gap: '12px', alignItems: 'center' \}\}>[\s\S]*?<\/div>/,
  controlsStr
);

// Grid View render
const tableRender = `
        {activeTab === 'directory' || activeTab === 'approvals' ? (
          viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {(activeTab === 'directory' ? users.filter(u => u.status !== 'pending_approval' && u.status !== 'changes_requested') : users.filter(u => u.status === 'pending_approval' || u.status === 'changes_requested')).map(u => (
                <UserGridCard 
                  key={u.id} 
                  user={u} 
                  selected={selectedIds.has(u.id)}
                  onToggleSelect={(id, checked) => {
                    const next = new Set(selectedIds)
                    if(checked) next.add(id)
                    else next.delete(id)
                    setSelectedIds(next)
                  }}
                  onRowClick={() => navigate(\`/config/team-members/\${u.id}\`)}
                  onContextMenu={(e, row) => {
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      user: row
                    })
                  }}
                />
              ))}
            </div>
          ) : (
          <DataTable 
            columns={columns} 
            data={activeTab === 'directory' ? users.filter(u => u.status !== 'pending_approval' && u.status !== 'changes_requested') : users.filter(u => u.status === 'pending_approval' || u.status === 'changes_requested')} 
            selectable={activeTab === 'directory'}
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
            visibleColumns={visibleColumns}
            onContextMenu={(e, row) => {
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                user: row
              })
            }}
          />
          )
`;
content = content.replace(
  /\{activeTab === 'directory' \|\| activeTab === 'approvals' \? \([\s\S]*?onSelectChange=\{setSelectedIds\}\n\s*\/>/m,
  tableRender
);

const contextMenuRender = `
        {contextMenu && (
          <ContextMenu 
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            options={[
              { label: 'View Profile', onClick: () => navigate(\`/config/team-members/\${contextMenu.user.id}\`) },
              { label: 'Change Status', onClick: () => setStatusChangeTarget(contextMenu.user) },
              { label: 'Offboard Employee', danger: true, onClick: () => setOffboardingTarget(contextMenu.user) }
            ]}
          />
        )}
      </div>
    </div>
  )
}
`;
content = content.replace(
  /      <\/div>\n    <\/div>\n  \)\n\}\n$/,
  contextMenuRender
);


fs.writeFileSync(path, content, 'utf8');
console.log('Done');
