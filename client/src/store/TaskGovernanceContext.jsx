/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react'

const GovernanceContext = createContext()

export const useGovernance = () => useContext(GovernanceContext)

export function TaskGovernanceProvider({ children }) {
  // Roles: 'admin', 'manager', 'contributor', 'viewer'
  const [role, setRole] = useState(() => {
    return localStorage.getItem('gov_role') || 'admin'
  })

  // Webhooks
  const [webhooks, setWebhooks] = useState(() => {
    const saved = localStorage.getItem('gov_webhooks')
    return saved ? JSON.parse(saved) : []
  })

  // Retention
  const [retentionDays, setRetentionDays] = useState(() => {
    return localStorage.getItem('gov_retention') || 'indefinite'
  })

  // Offline Sync Queue
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [syncQueue, setSyncQueue] = useState(() => {
    const saved = localStorage.getItem('gov_sync_queue')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    localStorage.setItem('gov_role', role)
  }, [role])

  useEffect(() => {
    localStorage.setItem('gov_webhooks', JSON.stringify(webhooks))
  }, [webhooks])

  useEffect(() => {
    localStorage.setItem('gov_retention', retentionDays)
  }, [retentionDays])

  useEffect(() => {
    localStorage.setItem('gov_sync_queue', JSON.stringify(syncQueue))
  }, [syncQueue])

  // Offline / Online listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      processSyncQueue()
    }
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncQueue])

  const processSyncQueue = () => {
    if (syncQueue.length === 0) return
    // Mock processing
    setTimeout(() => {
      setSyncQueue([])
      window.dispatchEvent(new CustomEvent('globalTimeLogged')) // Refresh UI
      // Use toast from anywhere is tricky here, we'll let components handle it or just rely on console
    }, 1500)
  }

  const pushToSyncQueue = (action, payload) => {
    if (isOffline) {
      setSyncQueue(prev => [...prev, { id: Date.now(), action, payload, timestamp: new Date().toISOString() }])
      return true
    }
    return false
  }

  // Audit Logger
  const logAuditActivity = (taskId, action, oldVal, newVal, user = 'Current User') => {
    const logs = JSON.parse(localStorage.getItem('gov_audit_logs') || '{}')
    if (!logs[taskId]) logs[taskId] = []
    
    logs[taskId].push({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      user,
      action,
      oldVal,
      newVal
    })

    // Retention Policy Pruning
    if (retentionDays !== 'indefinite') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - parseInt(retentionDays))
      logs[taskId] = logs[taskId].filter(log => new Date(log.timestamp) >= cutoff)
    }

    localStorage.setItem('gov_audit_logs', JSON.stringify(logs))

    // Webhooks Trigger
    // eslint-disable-next-line no-unused-vars
    webhooks.forEach(hook => {
    })
  }

  const getAuditLogs = (taskId) => {
    const logs = JSON.parse(localStorage.getItem('gov_audit_logs') || '{}')
    return (logs[taskId] || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }

  // Permissions helper
  const canEdit = ['admin', 'manager', 'contributor'].includes(role)
  const canDelete = ['admin', 'manager'].includes(role)
  const canConfig = ['admin'].includes(role)

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const contextValue = React.useMemo(() => ({
    role, setRole,
    webhooks, setWebhooks,
    retentionDays, setRetentionDays,
    isOffline, pushToSyncQueue, syncQueue,
    logAuditActivity, getAuditLogs,
    permissions: { canEdit, canDelete, canConfig }
  }), [role, webhooks, retentionDays, isOffline, syncQueue, canEdit, canDelete, canConfig])

  return (
    <GovernanceContext.Provider value={contextValue}>
      {children}
    </GovernanceContext.Provider>
  )
}
