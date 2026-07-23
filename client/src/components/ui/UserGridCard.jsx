import styles from './UserGridCard.module.css';
import Avatar from './Avatar';
import Badge from './Badge';

export default function UserGridCard({ user, onContextMenu, onRowClick, selected, onToggleSelect }) {
  return (
    <div 
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={() => onRowClick && onRowClick(user)}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, user);
        }
      }}
    >
      <div className={styles.header}>
        <div className={styles.checkboxContainer} onClick={e => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={selected} 
            onChange={(e) => onToggleSelect(user.id, e.target.checked)} 
          />
        </div>
        <Badge variant={user.status === 'active' ? 'success' : 'neutral'}>
          {user.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
        </Badge>
      </div>

      <div className={styles.body}>
        <Avatar name={user.name || '?'} size="lg" />
        <div className={styles.info}>
          <div className={styles.name}>{user.name || 'Unknown User'}</div>
          <div className={styles.email}>{user.email || '-'}</div>
          <div className={styles.role}>{user.role_name || user.role || 'No Role'}</div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.meta}>
          <div>Dept: <strong>{user.department_name || '-'}</strong></div>
          <div>Active: <strong>{user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}</strong></div>
        </div>
      </div>
    </div>
  );
}
