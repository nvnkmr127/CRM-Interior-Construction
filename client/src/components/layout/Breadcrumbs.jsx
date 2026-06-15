import { Link } from 'react-router-dom'
import { useBreadcrumbsCtx } from '../../store/breadcrumbsContext'
import styles from './Breadcrumbs.module.css'

export default function Breadcrumbs() {
  const { crumbs } = useBreadcrumbsCtx()

  if (!crumbs || crumbs.length === 0) return null

  return (
    <nav className={styles.nav} aria-label="Breadcrumb">
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1
        return (
          <span key={idx} style={{display:'flex', alignItems:'center'}}>
            {isLast ? (
              <span className={styles.current} aria-current="page">{crumb.label}</span>
            ) : crumb.href ? (
              <Link to={crumb.href} className={styles.link}>{crumb.label}</Link>
            ) : (
              <span className={styles.crumb}>{crumb.label}</span>
            )}
            {!isLast && <span className={styles.sep}>/</span>}
          </span>
        )
      })}
    </nav>
  )
}
