import { useEffect } from 'react'

export function usePageTitle(title) {
  useEffect(() => { 
    document.title = title ? `${title} · Interior CRM` : 'Interior CRM' 
  }, [title])
}

export default usePageTitle
