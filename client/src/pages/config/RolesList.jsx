import React, { useState, useMemo } from 'react';
import { Button, DataTable, Modal, Input } from '../../components/ui';
import layoutStyles from './ConfigLayout.module.css'; // Adjust path if needed
import styles from './RolesList.module.css';
import { format } from 'date-fns';

export default function RolesList({
  roles,
  users,
  onAddRole,
  onEditRole,
  onDeleteRole,
  onCloneRole,
  onCompareRoles,
  onExportRoles,
  onOpenTemplateLib,
  onOpenSimulator
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const enrichedRoles = useMemo(() => {
    return roles.map(role => {
      const userCount = users.filter(u => u.role_id === role.id).length;
      const permCount = role.permissions?.includes('*') ? 'All (*)' : (role.permissions?.length || 0);
      return {
        ...role,
        userCount,
        permCount
      };
    }).filter(r => 
      !searchQuery || 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (r.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [roles, users, searchQuery]);

  const columns = [
    { 
      header: 'Role Name', 
      accessor: 'name', 
      render: (val, row) => (
        <div>
          <div className={styles.roleName}>{val}</div>
          <div className={styles.roleDesc}>{row.description || 'No description'}</div>
        </div>
      ) 
    },
    { 
      header: 'Users', 
      accessor: 'userCount',
      render: (val) => <span className={styles.badgeNeutral}>{val} Assigned</span>
    },
    { 
      header: 'Permissions', 
      accessor: 'permCount',
      render: (val) => (
        <span className={val === 'All (*)' ? styles.badgeDanger : styles.badgeInfo}>
          {val}
        </span>
      )
    },
    { 
      header: 'Actions', 
      accessor: 'id', 
      render: (val, row) => (
        <div className={styles.actionMenu}>
          <Button variant="secondary" size="sm" onClick={() => onEditRole(row.id)}>Edit</Button>
          <div className={styles.dropdown}>
            <button className={styles.ellipsisBtn}>⋮</button>
            <div className={styles.dropdownContent}>
              <button onClick={() => onCloneRole(row)}>Clone</button>
              {row.name !== 'superadmin' && <button onClick={() => onDeleteRole(row.id)} className={styles.deleteText}>Delete</button>}
            </div>
          </div>
        </div>
      ) 
    }
  ];

  return (
    <div className={styles.listContainer}>
      <div className={styles.header}>
        <div className={styles.headerTitles}>
          <h2 className={styles.title}>Roles & Permissions</h2>
          <p className={styles.subtitle}>Manage functional roles and their granular access controls.</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={onOpenTemplateLib}>Templates</Button>
          <Button variant="secondary" onClick={onCompareRoles}>Compare</Button>
          <Button variant="secondary" onClick={onExportRoles}>Export</Button>
          <Button variant="secondary" onClick={onOpenSimulator}>Simulator</Button>
          <Button variant="primary" onClick={onAddRole}>+ Add Role</Button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Input 
            placeholder="Search roles..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon="🔍"
          />
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <DataTable columns={columns} data={enrichedRoles} />
      </div>
    </div>
  );
}
