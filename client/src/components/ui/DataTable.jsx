import { useState, Fragment, useRef, useCallback, useEffect } from 'react'
import styles from './DataTable.module.css'
import EmptyState from './EmptyState'
import Skeleton from './Skeleton'

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
  renderExpandedRow,
  visibleColumns,
  onContextMenu
}) {
  const [expandedKeys, setExpandedKeys] = useState(new Set())
  const [colWidths, setColWidths] = useState({})
  
  // Track resizing state
  const resizingRef = useRef(null)

  const activeColumns = visibleColumns 
    ? columns.filter(c => visibleColumns.includes(c.key) || visibleColumns.includes(c.label))
    : columns

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onSelectChange(new Set(data.map(row => row.id || row._id || row.user_id)))
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

  const handleResizeStart = (e, colKey) => {
    e.stopPropagation()
    e.preventDefault()
    const th = e.target.closest('th')
    resizingRef.current = {
      colKey,
      startX: e.clientX,
      startWidth: th.getBoundingClientRect().width
    }
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
  }

  const handleResizeMove = useCallback((e) => {
    if (!resizingRef.current) return
    const { colKey, startX, startWidth } = resizingRef.current
    const diff = e.clientX - startX
    const newWidth = Math.max(50, startWidth + diff)
    setColWidths(prev => ({ ...prev, [colKey]: newWidth }))
  }, [])

  const handleResizeEnd = useCallback(() => {
    resizingRef.current = null
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)
  }, [handleResizeMove])

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
            {activeColumns.map(col => (
              <th 
                key={col.key} 
                className={`${styles.th} ${col.sortable ? styles.sortable : ''}`}
                style={{ width: colWidths[col.key] || col.width, textAlign: col.align || 'left' }}
                onClick={() => col.sortable && onSort && onSort(col.key)}
              >
                <div className={styles.thContent}>
                  {col.label}
                  {col.sortable && (
                    <span className={`${styles.sortIcon} ${sortBy?.key === col.key ? styles.active : ''}`}>
                      {sortBy?.key === col.key && sortBy?.dir === 'desc' ? '-' : '-'}
                    </span>
                  )}
                  <div 
                    className={styles.resizer} 
                    onMouseDown={(e) => handleResizeStart(e, col.key)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skel-${i}`} className={styles.tr}>
                {expandable && <td className={styles.td}><Skeleton width="16px" height="16px" /></td>}
                {selectable && <td className={styles.td}><Skeleton width="16px" height="16px" /></td>}
                {activeColumns.map(col => (
                  <td key={`skel-${col.key}`} className={styles.td}>
                    <Skeleton height="20px" width="80%" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={activeColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0)}>
                <div style={{ padding: '40px 0' }}>
                  <EmptyState 
                    icon={<span style={{fontSize: 32}}>S</span>}
                    title={emptyMessage || 'No data found'} 
                    action={emptyAction} 
                  />
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const rowId = row.id || row._id || row.user_id || `row-${index}`
              const isExpanded = expandedKeys.has(rowId)
              return (
                <Fragment key={rowId}>
                  <tr 
                    className={`
                      ${styles.tr} 
                      ${onRowClick ? styles.clickable : ''} 
                      ${selectedIds.has(rowId) ? styles.selected : ''}
                    `}
                    onClick={() => onRowClick && onRowClick(row)}
                    onContextMenu={(e) => {
                      if (onContextMenu) {
                        e.preventDefault()
                        onContextMenu(e, row)
                      }
                    }}
                  >
                    {expandable && (
                      <td className={styles.td} style={{width:40}} onClick={(e) => toggleExpand(e, rowId)}>
                        <button className={styles.expandBtn}>{isExpanded ? '-' : '- '}</button>
                      </td>
                    )}
                    {selectable && (
                      <td className={`${styles.td} ${styles.checkbox}`} onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(rowId)}
                          onChange={(e) => handleSelectRow(e, rowId)}
                        />
                      </td>
                    )}
                    {activeColumns.map(col => (
                      <td key={col.key} className={styles.td} style={{ textAlign: col.align || 'left' }}>
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpandedRow && (
                    <tr className={styles.expandedRow}>
                      <td colSpan={activeColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0)} style={{padding:0}}>
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
