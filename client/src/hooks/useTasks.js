import { useState, useEffect, useCallback } from 'react'
import { getTasks, updateTask } from '../api/projects.js'
import { useToast } from '../store/toastContext.jsx'

export function useTasks(projectId, filters = {}) {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const toast = useToast()

  const fetch = useCallback(async () => {
    if (!projectId) return
    setLoading(true); setError(null)
    try {
      const res = await getTasks(projectId, filters)
      const rawData = res.data?.data || res.data?.results || res.data;
      setTasks(Array.isArray(rawData) ? rawData : []);
    } catch(e) {
      setError('Failed to load tasks')
    } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, JSON.stringify(filters)])

  useEffect(() => { fetch() }, [fetch])

  const optimisticStatusChange = async (taskId, newStatus) => {
    const prev = tasks
    setTasks(ts => ts.map(t => t.id===taskId ? {...t,status:newStatus} : t))
    try {
      await updateTask(projectId, taskId, { status: newStatus })
      toast.success(`Task moved to ${newStatus.replace('_',' ')}`)
    } catch(e) {
      setTasks(prev)  // revert
      const msg = e.response?.data?.error?.message || 'Status change failed'
      toast.error(msg)
    }
  }

  return { tasks, loading, error, refetch: fetch, optimisticStatusChange }
}
