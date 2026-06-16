import { useState, useEffect, useCallback } from 'react'
import { getProjects } from '../api/projects.js'

export function useProjects(filters = {}) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await getProjects(filters)
      setProjects(res.data || [])
    } catch(e) {
      setError(e.response?.data?.error?.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)])

  useEffect(() => { fetch() }, [fetch])

  const updateProjectLocally = (id, updates) =>
    setProjects(ps => ps.map(p => p.id===id ? {...p,...updates} : p))

  return { projects, loading, error, refetch: fetch, updateProjectLocally }
}
