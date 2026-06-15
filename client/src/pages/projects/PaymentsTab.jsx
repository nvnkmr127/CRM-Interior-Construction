import React, { useState, useEffect } from 'react';
import { getPaymentMilestones, createPaymentMilestone, updatePaymentMilestone } from '../../api/paymentMilestones';
import { Badge, Button, Spinner } from '../../components/ui';

export default function PaymentsTab({ project }) {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', amount: '', percent: '', dueDate: '', milestoneId: '' });
  
  const [invoiceModal, setInvoiceModal] = useState({ isOpen: false, id: null, invoice_reference: '' });
  const [paidModal, setPaidModal] = useState({ isOpen: false, id: null, paid_amount: '', paid_at: '' });

  const fetchMilestones = async () => {
    setLoading(true);
    try {
      const res = await getPaymentMilestones(project.id);
      setMilestones(res.data?.data || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (project?.id) fetchMilestones();
  }, [project?.id]);

  const contractValue = project?.contract_value || 0;
  const totalCollected = milestones.filter(m => m.status === 'paid').reduce((acc, m) => acc + Number(m.paid_amount || m.amount || 0), 0);
  const pendingAmount = contractValue - totalCollected;
  
  const overdueAmount = milestones
    .filter(m => m.status !== 'paid' && m.due_date && new Date(m.due_date) < new Date())
    .reduce((acc, m) => acc + Number(m.amount || 0), 0);

  const progressPct = contractValue > 0 ? Math.min(100, Math.round((totalCollected / contractValue) * 100)) : 0;

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        projectId: project.id,
        name: addForm.name,
        amount: addForm.amount ? Number(addForm.amount) : null,
        percent: addForm.percent ? Number(addForm.percent) : null,
        dueDate: addForm.dueDate || null,
        milestoneId: addForm.milestoneId || null
      };
      await createPaymentMilestone(payload);
      setShowAddForm(false);
      setAddForm({ name: '', amount: '', percent: '', dueDate: '', milestoneId: '' });
      fetchMilestones();
    } catch (e) {
      console.error('Failed to add payment milestone', e);
      alert('Error adding milestone');
    }
  };

  const handleRaiseInvoice = async () => {
    if (!invoiceModal.invoice_reference) return alert('Invoice reference is required');
    try {
      await updatePaymentMilestone(invoiceModal.id, { status: 'invoice_raised', invoice_reference: invoiceModal.invoice_reference });
      setInvoiceModal({ isOpen: false, id: null, invoice_reference: '' });
      fetchMilestones();
    } catch (e) {
      console.error(e);
      alert('Error raising invoice');
    }
  };

  const handleMarkPaid = async () => {
    if (!paidModal.paid_amount || !paidModal.paid_at) return alert('Amount and date are required');
    try {
      await updatePaymentMilestone(paidModal.id, { 
        status: 'paid', 
        paid_amount: Number(paidModal.paid_amount), 
        paid_at: paidModal.paid_at 
      });
      setPaidModal({ isOpen: false, id: null, paid_amount: '', paid_at: '' });
      fetchMilestones();
    } catch (e) {
      console.error(e);
      alert('Error marking as paid');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'scheduled': return 'neutral';
      case 'invoice_raised': return 'primary';
      case 'paid': return 'success';
      case 'overdue': return 'danger';
      default: return 'neutral';
    }
  };

  const projectMilestones = project?.phases?.flatMap(p => p.milestones || []) || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* SUMMARY ROW */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-6">Financial Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contract Value</p>
            <p className="text-2xl font-black text-white">₹{Number(contractValue).toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Collected</p>
            <p className="text-2xl font-black text-green-400">₹{Number(totalCollected).toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pending Amount</p>
            <p className="text-2xl font-black text-amber-400">₹{Number(pendingAmount).toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Overdue Amount</p>
            <p className="text-2xl font-black text-red-400">₹{Number(overdueAmount).toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Collection Progress</p>
            <p className="text-sm font-black text-green-400">{progressPct}%</p>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-3 shadow-inner">
            <div className="bg-green-500 h-3 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(34,197,94,0.6)]" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* PAYMENT SCHEDULE TABLE */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
          <h3 className="text-lg font-bold text-white">Payment Schedule</h3>
          <Button variant="primary" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : '+ Add Payment Milestone'}
          </Button>
        </div>

        {showAddForm && (
          <div className="p-5 bg-slate-900/50 border-b border-slate-700 animate-in slide-in-from-top-2">
            <form onSubmit={handleAddSubmit} className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Name *</label>
                <input required type="text" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="e.g. 50% Advance" />
              </div>
              <div className="w-32">
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Amount (₹)</label>
                <input type="number" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors" value={addForm.amount} onChange={e => setAddForm({...addForm, amount: e.target.value})} placeholder="0.00" />
              </div>
              <div className="w-24">
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">OR %</label>
                <input type="number" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors" value={addForm.percent} onChange={e => setAddForm({...addForm, percent: e.target.value})} placeholder="%" />
              </div>
              <div className="w-40">
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Due Date</label>
                <input type="date" className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors" value={addForm.dueDate} onChange={e => setAddForm({...addForm, dueDate: e.target.value})} />
              </div>
              <div className="w-48 hidden md:block">
                <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Link Milestone</label>
                <select className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors" value={addForm.milestoneId} onChange={e => setAddForm({...addForm, milestoneId: e.target.value})}>
                  <option value="">None</option>
                  {projectMilestones.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Button type="submit" variant="success" size="sm" className="h-[38px]">Save</Button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-12"><Spinner size="lg" /></div>
        ) : milestones.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            No payment milestones found. Create one to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 border-b border-slate-700">
                  <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Milestone Name</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Amount (₹)</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Due Date</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {milestones.map(m => {
                  let amountDisplay = 'TBD';
                  if (m.amount) amountDisplay = `₹${Number(m.amount).toLocaleString('en-IN')}`;
                  else if (m.percentage) amountDisplay = `${m.percentage}% (₹${Number((m.percentage/100) * contractValue).toLocaleString('en-IN')})`;

                  // auto-overdue check for styling
                  let displayStatus = m.status;
                  if (displayStatus !== 'paid' && m.due_date && new Date(m.due_date) < new Date()) {
                    displayStatus = 'overdue';
                  }

                  return (
                    <tr key={m.id} className="hover:bg-slate-700/20 transition-colors group">
                      <td className="px-5 py-4">
                        <p className="font-bold text-white text-sm">{m.name}</p>
                        {m.linked_milestone_name && <p className="text-xs text-slate-500 mt-1">🔗 {m.linked_milestone_name}</p>}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-300 font-medium">{amountDisplay}</td>
                      <td className="px-5 py-4 text-sm text-slate-300">
                        {m.due_date ? new Date(m.due_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={getStatusColor(displayStatus)} className="capitalize">{displayStatus.replace('_', ' ')}</Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {m.status === 'scheduled' && (
                          <Button size="sm" variant="outline" onClick={() => setInvoiceModal({ isOpen: true, id: m.id, invoice_reference: '' })}>
                            Raise Invoice
                          </Button>
                        )}
                        {m.status === 'invoice_raised' && (
                          <Button size="sm" variant="success" onClick={() => setPaidModal({ isOpen: true, id: m.id, paid_amount: m.amount || '', paid_at: new Date().toISOString().split('T')[0] })}>
                            Mark Paid
                          </Button>
                        )}
                        {m.status === 'paid' && (
                          <span className="text-xs text-green-500 font-bold">Paid on {new Date(m.paid_at).toLocaleDateString()}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {invoiceModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-5">Raise Invoice</h3>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Invoice Reference #</label>
              <input 
                type="text"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-blue-500 transition-colors"
                value={invoiceModal.invoice_reference}
                onChange={e => setInvoiceModal(prev => ({...prev, invoice_reference: e.target.value}))}
                placeholder="e.g. INV-2023-001"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setInvoiceModal({ isOpen: false, id: null, invoice_reference: '' })}>Cancel</Button>
              <Button variant="primary" onClick={handleRaiseInvoice} disabled={!invoiceModal.invoice_reference}>Submit</Button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Paid Modal */}
      {paidModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-5">Mark as Paid</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Amount Paid (₹)</label>
              <input 
                type="number"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-blue-500 transition-colors"
                value={paidModal.paid_amount}
                onChange={e => setPaidModal(prev => ({...prev, paid_amount: e.target.value}))}
                placeholder="0.00"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Payment Date</label>
              <input 
                type="date"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:border-blue-500 transition-colors"
                value={paidModal.paid_at}
                onChange={e => setPaidModal(prev => ({...prev, paid_at: e.target.value}))}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPaidModal({ isOpen: false, id: null, paid_amount: '', paid_at: '' })}>Cancel</Button>
              <Button variant="success" onClick={handleMarkPaid} disabled={!paidModal.paid_amount || !paidModal.paid_at}>Confirm Payment</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
