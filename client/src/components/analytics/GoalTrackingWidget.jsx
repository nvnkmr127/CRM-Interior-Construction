import React from 'react';

const DUMMY_GOALS = [
  { id: 'g1', title: 'Q3 Revenue Target', type: 'Company', target: 50000000, current: 32000000, format: 'currency', deadline: '2026-09-30', expectedPacing: 65, historical: [40, 50, 75, 92, 105, 110] },
  { id: 'g2', title: 'Monthly Lead Gen', type: 'Company', target: 5000, current: 4100, format: 'number', deadline: '2026-07-31', expectedPacing: 45, historical: [80, 95, 110, 85, 102, 105] },
  { id: 'g3', title: 'Conversion Rate', type: 'Company', target: 25, current: 22, format: 'percent', deadline: '2026-12-31', expectedPacing: 25, historical: [18, 20, 21, 19, 21, 22] },
  { id: 'g4', title: 'Alpha Team Sales', type: 'Team', target: 10000000, current: 9500000, format: 'currency', deadline: '2026-07-31', expectedPacing: 45, historical: [110, 105, 95, 120, 115, 108] },
  { id: 'g5', title: 'Sarah Smith Quota', type: 'Employee', target: 2000000, current: 1100000, format: 'currency', deadline: '2026-07-31', expectedPacing: 45, historical: [105, 98, 112, 100, 95, 102] },
];

function formatValue(val, format) {
  if (format === 'currency') return \`₹\${(val / 100000).toFixed(2)}L\`;
  if (format === 'percent') return \`\${val}%\`;
  return val.toLocaleString();
}

function getPacingStatus(currentPct, expectedPct) {
  const diff = currentPct - expectedPct;
  if (diff >= 0) return { status: 'On Track', color: 'var(--color-success)' };
  if (diff >= -10) return { status: 'At Risk', color: 'var(--color-warning)' };
  return { status: 'Behind', color: 'var(--color-danger)' };
}

export default function GoalTrackingWidget({ onClick }) {
  
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--color-border)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>Goal Tracking</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>Monitor performance against key targets</p>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '8px', flex: 1 }}>
        {DUMMY_GOALS.map(goal => {
          const progressPct = Math.min(100, Math.round((goal.current / goal.target) * 100));
          const pacing = getPacingStatus(progressPct, goal.expectedPacing);
          
          const daysLeft = Math.max(0, Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24)));

          return (
            <div key={goal.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer', padding: '12px', borderRadius: '8px', background: 'var(--color-surface-2)', border: '1px solid transparent', transition: 'border 0.2s' }} onClick={() => onClick && onClick(goal.title)} onMouseEnter={e => e.currentTarget.style.border = '1px solid var(--color-border)'} onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text)' }}>{goal.title}</span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-bg)', borderRadius: '12px', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>{goal.type}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    {formatValue(goal.current, goal.format)} / {formatValue(goal.target, goal.format)}
                  </div>
                </div>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: pacing.color }}>{progressPct}%</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{pacing.status}</div>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div style={{ height: '8px', width: '100%', background: 'var(--color-bg)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                {/* Expected Pacing Marker */}
                <div style={{ position: 'absolute', left: \`\${goal.expectedPacing}%\`, top: 0, bottom: 0, width: '2px', background: 'var(--color-text-secondary)', zIndex: 2 }} title={\`Expected: \${goal.expectedPacing}%\`} />
                {/* Actual Progress */}
                <div style={{ height: '100%', width: \`\${progressPct}%\`, background: pacing.color, borderRadius: '4px', transition: 'width 0.5s ease-in-out' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                <span>Remaining: {formatValue(goal.target - goal.current, goal.format)}</span>
                <span>{daysLeft} days left</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
