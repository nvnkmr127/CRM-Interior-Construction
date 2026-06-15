import { useEffect } from 'react'
import { useBreadcrumbsCtx } from '../store/breadcrumbsContext'

export function useBreadcrumbs(newCrumbs) {
  const { setCrumbs } = useBreadcrumbsCtx()
  useEffect(() => {
    setCrumbs(newCrumbs)
    return () => setCrumbs([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(newCrumbs)])
}
