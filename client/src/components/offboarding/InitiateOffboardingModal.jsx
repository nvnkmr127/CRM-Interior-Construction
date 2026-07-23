import { useState } from 'react';
import { Modal, Button, Input } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function InitiateOffboardingModal({ user, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    resignation_date: new Date().toISOString().split('T')[0],
    last_working_day: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/offboarding/initiate', {
        user_id: user.id,
        ...data
      });
      toast.success(`Offboarding initiated for ${user.first_name} ${user.last_name}`);
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate offboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} title={`Initiate Offboarding: ${user.first_name || user.name} ${user.last_name || ''}`} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 0 }}>
          This will start the formal offboarding process for the employee, tracking approvals and asset returns.
        </p>

        <Input
          label="Resignation/Notice Date"
          type="date"
          required
          value={data.resignation_date}
          onChange={e => setData({ ...data, resignation_date: e.target.value })}
        />

        <Input
          label="Last Working Day"
          type="date"
          required
          value={data.last_working_day}
          onChange={e => setData({ ...data, last_working_day: e.target.value })}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Initiating...' : 'Start Offboarding'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
