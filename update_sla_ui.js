const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'client/src/pages/dashboard/FinancialApprovalsPage.jsx');
let content = fs.readFileSync(file, 'utf8');

const slaComponent = `
function SLATracker({ approval }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (approval.status !== 'pending') return;
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, [approval.status]);

  if (approval.status !== 'pending') return null;

  const targetDate = new Date(approval.target_resolution_date || new Date(new Date(approval.created_at).getTime() + 72 * 60 * 60 * 1000));
  const diffMs = targetDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  const isOverdue = diffHours < 0;
  
  let color = '#059669'; // Green (under 24h)
  let level = 0;
  
  const hoursElapsed = (now.getTime() - new Date(approval.created_at).getTime()) / (1000 * 60 * 60);
  if (hoursElapsed >= 72) { color = '#dc2626'; level = 3; } // Red
  else if (hoursElapsed >= 48) { color = '#ea580c'; level = 2; } // Orange
  else if (hoursElapsed >= 24) { color = '#d97706'; level = 1; } // Yellow

  // Format remaining time
  const absHours = Math.floor(Math.abs(diffHours));
  const absMins = Math.floor((Math.abs(diffMs) % (1000 * 60 * 60)) / (1000 * 60));
  const timeString = \`\${absHours}h \${absMins}m\`;

  return (
    <div style={{ marginTop: '12px', padding: '12px', borderRadius: '6px', border: \`1px solid \${color}40\`, backgroundColor: \`\${color}10\` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SLA Tracking</span>
        {level > 0 && (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: color, color: '#fff' }}>
            Escalation L\${level}
          </span>
        )}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
        <div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>Created Time</div>
          <div style={{ fontWeight: 500 }}>{new Date(approval.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>Target Resolution</div>
          <div style={{ fontWeight: 500 }}>{targetDate.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
        </div>
      </div>
      
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        {isOverdue ? (
          <span>Overdue by {timeString}</span>
        ) : (
          <span>{timeString} remaining</span>
        )}
      </div>
    </div>
  );
}

export default function FinancialApprovalsPage() {`;

content = content.replace('export default function FinancialApprovalsPage() {', slaComponent);

const cardBodyRegex = /(<div className=\{styles\.cardBody\}>[\s\S]*?)(<div className=\{styles\.detailRow\}>)/g;
content = content.replace(cardBodyRegex, '$1<SLATracker approval={app} />\n                      $2');

fs.writeFileSync(file, content);
console.log('Done SLA component');
