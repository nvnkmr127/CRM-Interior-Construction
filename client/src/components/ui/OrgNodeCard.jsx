import { Avatar, Badge } from './index'

export default function OrgNodeCard({ node, type, onClick, onDragStart, onDragOver, onDragLeave, onDrop }) {
  const isDept = type === 'department'
  const isBranch = type === 'branch'
  const isUser = type === 'user'
  
  const getAvatarName = () => {
    if (isUser) return node.name
    return node.manager_name || '?'
  }

  const getSubtitle = () => {
    if (isUser) return node.role_name || 'No Role'
    if (isDept) return node.code || 'Dept'
    if (isBranch) return node.location || 'Branch'
  }

  return (
    <div 
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        minWidth: '280px',
        flex: '1 1 auto',
        width: '100%',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s',
      }}
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, node.id, type)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop && onDrop(e, node.id)}
      onClick={() => onClick && onClick(node, type)}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.borderColor = 'var(--color-border-strong)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--color-border)';
      }}
    >
      <div style={{ height: '6px', width: '100%', background: isDept ? 'var(--color-info)' : isBranch ? 'var(--color-success)' : 'var(--color-accent)' }} />
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
          <Avatar name={getAvatarName()} size="sm" />
          <Badge variant={isDept ? 'info' : isBranch ? 'success' : 'neutral'} size="sm">
            {type.toUpperCase()}
          </Badge>
        </div>
        
        <div>
          <h3 style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 'var(--text-sm)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={node.name}>{node.name}</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getSubtitle()}</p>
        </div>
        
        {/* Real Database Metrics for Dept/Branch */}
        {!isUser && (
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Headcount</span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text)' }}>{node.employee_count !== undefined ? node.employee_count : 0}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '60%' }}>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Head</span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={node.manager_name || 'Unassigned'}>
                {node.manager_name || 'Unassigned'}
              </span>
            </div>
          </div>
        )}
        
        {/* Real Database Metrics for user */}
        {isUser && (
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '60%' }}>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={node.department_name || 'Unassigned'}>
                {node.department_name || 'Unassigned'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: node.status === 'active' || !node.status ? 'var(--color-success)' : 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                {node.status || 'Active'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
