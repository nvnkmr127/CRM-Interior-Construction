import { useEffect } from 'react'
import { useBreadcrumbsCtx } from '../store/breadcrumbsContext'

export function useBreadcrumbs(crumbs) {
  const { setCrumbs } = useBreadcrumbsCtx()
  useEffect(() => {
    setCrumbs(crumbs)
    return () => setCrumbs([])  // clear on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(crumbs)])
}

export default useBreadcrumbs
