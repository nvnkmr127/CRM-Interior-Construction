import { useState, Fragment } from 'react'
import styles from './DataTable.module.css'

export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  onRowClick,
  selectable = false,
  selectedIds = new Set(),
  onSelectChange,
  sortBy,
  onSort,
  pagination,
  emptyMessage,
  emptyAction,
  expandable = false,
  renderExpandedRow
}) {
  const [expandedKeys, setExpandedKeys] = useState(new Set())

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectChange(new Set(data.map(row => row.id)))
    } else {
      onSelectChange(new Set())
    }
  }

  const handleSelectRow = (e, id) => {
    e.stopPropagation()
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    onSelectChange(newSet)
  }

  const toggleExpand = (e, id) => {
    e.stopPropagation()
    const next = new Set(expandedKeys)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpandedKeys(next)
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            {expandable && <th className={`${styles.th} ${styles.expandCol}`}></th>}
            {selectable && (
              <th className={`${styles.th} ${styles.checkbox}`}>
                <input 
                  type="checkbox" 
                  checked={data.length > 0 && selectedIds.size === data.length}
                  onChange={handleSelectAll}
                />
              </th>
            )}
            {columns.map(col => (
              <th 
                key={col.key} 
                className={`${styles.th} ${col.sortable ? styles.sortable : ''}`}
                style={{ width: col.width, textAlign: col.align || 'left' }}
                onClick={() => col.sortable && onSort && onSort(col.key)}
              >
                {col.label}
                {col.sortable && (
                  <span className={`${styles.sortIcon} ${sortBy?.key === col.key ? styles.active : ''}`}>
                    {sortBy?.key === col.key && sortBy?.dir === 'desc' ? '▼' : '▲'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skel-${i}`} className={styles.tr}>
                {expandable && <td className={styles.td}><div className={styles.skeletonCell} style={{width: 16}} /></td>}
                {selectable && <td className={styles.td}><div className={styles.skeletonCell} style={{width: 16}} /></td>}
                {columns.map(col => (
                  <td key={`skel-${col.key}`} className={styles.td}>
                    <div className={styles.skeletonCell} />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0)}>
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>⊡</div>
                  <div className={styles.emptyTitle}>{emptyMessage || 'No data'}</div>
                  {emptyAction && (
                    <button className={styles.emptyActionBtn} onClick={emptyAction.onClick}>
                      {emptyAction.label}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : (
            data.map(row => {
              const isExpanded = expandedKeys.has(row.id)
              return (
                <Fragment key={row.id}>
                  <tr 
                    className={`
                      ${styles.tr} 
                      ${onRowClick ? styles.clickable : ''} 
                      ${selectedIds.has(row.id) ? styles.selected : ''}
                    `}
                    onClick={() => onRowClick && onRowClick(row)}
                  >
                    {expandable && (
                      <td className={styles.td} style={{width:40}} onClick={(e) => toggleExpand(e, row.id)}>
                        <button className={styles.expandBtn}>{isExpanded ? '▼' : '▶'}</button>
                      </td>
                    )}
                    {selectable && (
                      <td className={`${styles.td} ${styles.checkbox}`} onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(row.id)}
                          onChange={(e) => handleSelectRow(e, row.id)}
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col.key} className={styles.td} style={{ textAlign: col.align || 'left' }}>
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpandedRow && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={columns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0)} style={{padding:0}}>
                        {renderExpandedRow(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>
      
      {pagination && (
        <div className={styles.footer}>
          <div>
            Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
          </div>
          <div className={styles.pager}>
            <button 
              className={styles.pageBtn} 
              disabled={pagination.page === 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              &lt;
            </button>
            <button className={`${styles.pageBtn} ${styles.active}`}>{pagination.page}</button>
            <button 
              className={styles.pageBtn} 
              disabled={pagination.page * pagination.limit >= pagination.total}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

