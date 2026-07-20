const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'client/src/pages/dashboard/FinancialApprovalsPage.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add PriorityBadge Component
const badgeComponent = `
function PriorityBadge({ approval, onUpdate }) {
  const [isOpen, setIsOpen] = useState(false);
  const { priority } = approval;
  
  let color = '#6b7280'; // Low: gray
  if (priority === 'medium') color = '#3b82f6'; // Blue
  else if (priority === 'high') color = '#f97316'; // Orange
  else if (priority === 'critical') color = '#dc2626'; // Red

  const handleUpdate = (newP) => {
    setIsOpen(false);
    if (onUpdate) onUpdate(approval.id, newP);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span 
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer', padding: '2px 8px', borderRadius: '4px', backgroundColor: \`\${color}20\`, color, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}
      >
        {priority || 'low'}
      </span>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '100px' }}>
          {['low', 'medium', 'high', 'critical'].map(p => (
            <div key={p} onClick={() => handleUpdate(p)} style={{ padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', textTransform: 'capitalize', color: '#374151' }}>
              {p}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FinancialApprovalsPage() {`;

content = content.replace('export default function FinancialApprovalsPage() {', badgeComponent);

// 2. Inject handleUpdatePriority
const handleUpdateInject = `
  const handleUpdatePriority = async (id, newPriority) => {
    try {
      await api.post(\`/financial-approvals/\${id}/priority\`, { priority: newPriority });
      toast.success('Priority updated');
      fetchPendingApprovals();
      fetchHistoryApprovals();
    } catch (err) {
      toast.error('Failed to update priority');
    }
  };
`;
content = content.replace('const handleRejectConfirm = async (e) => {', handleUpdateInject + '\n  const handleRejectConfirm = async (e) => {');

// 3. Replace existing span logic for priority with <PriorityBadge>
const spanRegex = /\{app\.priority === 'urgent' && <span className=\{styles\.priorityUrgent\}>Urgent<\/span>\}\s*\{app\.priority === 'high' && <span className=\{styles\.priorityHigh\}>High<\/span>\}/g;
content = content.replace(spanRegex, `<PriorityBadge approval={app} onUpdate={handleUpdatePriority} />`);

fs.writeFileSync(file, content);
console.log('Frontend patched');
