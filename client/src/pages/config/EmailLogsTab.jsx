import { useState, useEffect } from 'react'
import { DataTable, Badge } from '../../components/ui'
import api from '../../api/axios'

export default function EmailLogsTab() {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const res = await api.get('/emails')
      setLogs(res.data.data || [])
    } catch (error) {
      console.error('Failed to fetch email logs', error)
      setLogs([])
    } finally {
      setIsLoading(false)
    }
  }

  const columns = [
    {
      key: 'recipient_email', label: 'Recipient',
      render: (log) => (
        <div>
          <div style={{ fontWeight: 500 }}>{log.user_name || 'System User'}</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{log.recipient_email}</div>
        </div>
      )
    },
    {
      key: 'subject', label: 'Subject / Event',
      render: (log) => (
        <div>
          <div style={{ fontWeight: 500 }}>{log.subject}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{log.template_name}</div>
        </div>
      )
    },
    {
      key: 'status', label: 'Delivery Status',
      render: (log) => {
        let variant = 'neutral'
        if (log.status === 'sent') variant = 'success'
        if (log.status === 'pending') variant = 'warning'
        if (log.status === 'failed') variant = 'danger'

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
            <Badge variant={variant}>{log.status.toUpperCase()}</Badge>
            {log.status === 'failed' && (
              <span style={{ fontSize: '12px', color: 'var(--color-danger)' }} title={log.error_message}>
                {log.error_message?.substring(0, 30)}...
              </span>
            )}
          </div>
        )
      }
    },
    {
      key: 'created_at', label: 'Queued At',
      render: (log) => new Date(log.created_at).toLocaleString()
    },
    {
      key: 'sent_at', label: 'Sent At',
      render: (log) => log.sent_at ? new Date(log.sent_at).toLocaleString() : '-'
    },
    {
      key: 'retry_count', label: 'Retries',
      render: (log) => log.retry_count > 0 ? <Badge variant="warning">{log.retry_count}</Badge> : '-'
    }
  ]

  if (isLoading) return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading email logs...</div>

  return (
    <div style={{ marginTop: '16px' }}>
      <DataTable 
        columns={columns} 
        data={logs} 
        selectable={false}
      />
    </div>
  )
}
