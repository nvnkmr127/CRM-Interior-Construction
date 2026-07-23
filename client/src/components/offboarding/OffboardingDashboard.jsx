import { useState, useEffect } from 'react';
import { Button, DataTable, Badge } from '../ui';
import api from '../../api/axios';
import OffboardingModal from './OffboardingModal';
import { useToast } from '../../store/toastContext';

export default function OffboardingDashboard() {
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await api.get('/offboarding');
      if (res.data?.success) {
        setRecords(res.data.data);
        return res.data.data;
      }
    } catch (err) {
      toast.error('Failed to load offboarding records');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending_manager': return <Badge variant="warning">Manager Approval</Badge>;
      case 'pending_hr': return <Badge variant="warning">HR Approval</Badge>;
      case 'active_transfer': return <Badge variant="info">Active Transfers</Badge>;
      case 'pending_asset_return': return <Badge variant="info">Pending Assets</Badge>;
      case 'completed': return <Badge variant="success">Completed</Badge>;
      case 'archived': return <Badge variant="default">Archived</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 500 }}>{r.first_name} {r.last_name}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{r.email}</div>
          </div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => getStatusBadge(r.status)
    },
    {
      key: 'resignation_date',
      header: 'Resignation Date',
      render: (r) => new Date(r.resignation_date).toLocaleDateString()
    },
    {
      key: 'last_working_day',
      header: 'Last Working Day',
      render: (r) => new Date(r.last_working_day).toLocaleDateString()
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <Button size="sm" variant="secondary" onClick={() => setSelectedRecord(r)}>
          View / Update
        </Button>
      )
    }
  ];

  if (loading) return <div style={{ padding: '24px' }}>Loading...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Offboarding Tracking</h3>
      </div>

      <DataTable 
        data={records} 
        columns={columns} 
      />

      {selectedRecord && (
        <OffboardingModal 
          record={selectedRecord} 
          onClose={() => setSelectedRecord(null)} 
          onUpdated={async (shouldClose = false) => {
            const freshRecords = await fetchRecords();
            if (shouldClose) {
              setSelectedRecord(null);
            } else if (freshRecords && selectedRecord) {
              const freshRecord = freshRecords.find(r => r.id === selectedRecord.id);
              if (freshRecord) setSelectedRecord(freshRecord);
            }
          }}
        />
      )}
    </div>
  );
}
