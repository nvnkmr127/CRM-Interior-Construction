/* eslint-disable react-hooks/use-memo, react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react'
import { getProjects } from '../api/projects.js'

export function useProjects(filters = {}) {
  const [projects, setProjects] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await getProjects(filters)
      const rawData = res.data?.data || res.data?.results || res.data;
      setProjects(Array.isArray(rawData) ? rawData : []);
      
      if (res.pagination) {
        setTotal(res.pagination.total || 0)
      } else if (res.total !== undefined) {
        setTotal(res.total)
      } else {
        setTotal(Array.isArray(rawData) ? rawData.length : 0)
      }
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

  return { projects, total, loading, error, refetch: fetch, updateProjectLocally }
}
