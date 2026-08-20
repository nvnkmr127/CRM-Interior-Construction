import React, { useState, useEffect } from 'react';
import { useToast } from '../../store/toastContext';
import { Badge, Modal, Button } from '../ui';
import api from '../../api/axios';
import { deleteEstimate } from '../../api/leads';
import EstimatorBuilder from './EstimatorBuilder';

export default function EstimatesTab({ leadId, lead }) {
  const toast = useToast();
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [isBuildingEstimate, setIsBuildingEstimate] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState(null);

  const [estimateToDelete, setEstimateToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleUpdateStatus = async (estimateId, status) => {
    try {
      const res = await api.patch(`/leads/${leadId}/estimates/${estimateId}`, { status });
      if (res.data.success) {
        toast.success(`Estimate status updated to ${status}`);
        fetchEstimates();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update estimate status');
    }
  };

  const handlePrintEstimate = (estimate) => {
    let rooms = [];
    if (estimate.payload) {
      if (Array.isArray(estimate.payload.rooms)) {
        rooms = estimate.payload.rooms;
      } else if (estimate.payload.payload && Array.isArray(estimate.payload.payload.rooms)) {
        rooms = estimate.payload.payload.rooms;
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocker is preventing opening the print view.');
      return;
    }

    const leadName = lead?.name || 'Customer';
    const estimateRef = estimate.estimator_reference_id || `#${estimate.id.substring(0, 6).toUpperCase()}`;
    const totalVal = Number(estimate.total_amount || 0).toLocaleString('en-IN');

    let roomsHtml = '';
    rooms.forEach(room => {
      let itemsHtml = '';
      if (Array.isArray(room.items)) {
        room.items.forEach((item, idx) => {
          const itemTotal = (Number(item.qty || 0) * Number(item.rate || 0)).toLocaleString('en-IN');
          itemsHtml += `
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 10px; font-size: 13px; color: #374151;">${idx + 1}</td>
              <td style="padding: 10px; font-size: 13px; color: #374151;">
                <div style="font-weight: 600;">${item.name || item.item_name || 'Material Item'}</div>
                ${item.description ? `<div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">${item.description}</div>` : ''}
              </td>
              <td style="padding: 10px; font-size: 13px; color: #374151; text-align: center;">${item.qty} ${item.unit || 'sqft'}</td>
              <td style="padding: 10px; font-size: 13px; color: #374151; text-align: right;">₹${Number(item.rate).toLocaleString('en-IN')}</td>
              <td style="padding: 10px; font-size: 13px; font-weight: 600; color: #111827; text-align: right;">₹${itemTotal}</td>
            </tr>
          `;
        });
      }

      roomsHtml += `
        <div style="margin-bottom: 25px; background: white; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; page-break-inside: avoid;">
          <div style="background: #f8fafc; padding: 12px 18px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: #1e293b; font-size: 14px;">
            ${room.name}
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #ffffff; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 10px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; width: 40px;">#</th>
                <th style="padding: 10px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Specification & Material</th>
                <th style="padding: 10px; text-align: center; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; width: 100px;">Qty</th>
                <th style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; width: 120px;">Rate</th>
                <th style="padding: 10px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; width: 140px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || '<tr><td colspan="5" style="padding: 15px; text-align: center; color: #9ca3af; font-size: 13px;">No specifications added for this room</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Estimate Proposal ${estimateRef}</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; color: #1f2937; padding: 40px; margin: 0; background-color: #ffffff; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; background: #f3f4f6; padding: 15px 25px; border-radius: 12px;">
            <span style="font-weight: 600; font-size: 14px; color: #4b5563;">Print Preview - Estimate &nbsp;${estimateRef}</span>
            <button onclick="window.print()" style="background: #E38E54; color: white; border: none; padding: 8px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; transition: background 0.2s;">
              Print / Save PDF
            </button>
          </div>

          <!-- Invoice/Estimate Header -->
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #e5e7eb; padding-bottom: 25px; margin-bottom: 35px;">
            <div>
              <h1 style="font-size: 24px; font-weight: 800; color: #111827; margin: 0;">Interior Design Estimate</h1>
              <p style="font-size: 13px; color: #6b7280; margin: 5px 0 0 0;">Reference ID: <strong>${estimateRef}</strong></p>
            </div>
            <div style="text-align: right;">
              <h2 style="font-size: 18px; font-weight: 700; color: #4b5563; margin: 0;">CRM Interior Construction</h2>
              <p style="font-size: 12px; color: #9ca3af; margin: 4px 0 0 0;">Date: ${new Date(estimate.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <!-- Customer Info -->
          <div style="display: flex; justify-content: space-between; margin-bottom: 35px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #f1f5f9;">
            <div>
              <span style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Prepared For</span>
              <strong style="font-size: 16px; color: #1e293b;">${leadName}</strong>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; justify-content: center;">
              <span style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Total Estimated Amount</span>
              <span style="font-size: 22px; font-weight: 800; color: #E38E54;">₹${totalVal}</span>
            </div>
          </div>

          <!-- Rooms Spec Lists -->
          ${roomsHtml}

          <!-- Terms Summary -->
          <div style="margin-top: 40px; border-top: 2px solid #e5e7eb; padding-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; page-break-inside: avoid;">
            <p>This is a system generated design estimate proposal. Final prices may vary based on exact site dimensions and design customization.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleEditEstimate = (estimate) => {
    setEditingEstimate(estimate);
    setIsBuildingEstimate(true);
  };

  const handleCloseBuilder = () => {
    setIsBuildingEstimate(false);
    setEditingEstimate(null);
  };

  const confirmDeleteEstimate = async () => {
    if (!estimateToDelete) return;
    setDeleting(true);
    try {
      await deleteEstimate(leadId, estimateToDelete.id);
      toast.success('Estimate deleted');
      fetchEstimates();
      setEstimateToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete estimate');
    } finally {
      setDeleting(false);
    }
  };

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/leads/${leadId}/estimates`);
      if (res.data.success) {
        setEstimates(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load estimates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leadId) {
      fetchEstimates();
    }
  }, [leadId]);

  const syncEstimates = async () => {
    toast.info('Syncing estimates with external system...');
    setSyncError(null);
    setSyncing(true);
    try {
      const estRes = await api.post(`/leads/${leadId}/estimates/sync`);
      if (estRes.data.success) {
        setEstimates(estRes.data.data);
        toast.success('Estimates synced');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message || 'Failed to sync estimates';
      setSyncError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Quotes & Estimates
          </h3>
          <p className="text-sm text-gray-500 mt-1">Manage Bill of Quantities (BOQ) and pricing proposals.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={syncEstimates}
            disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-sm rounded-lg transition-colors shadow-sm border border-gray-200"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            type="button"
            onClick={() => setIsBuildingEstimate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors shadow-sm border border-blue-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Generate Estimate
          </button>
        </div>
      </div>

      {syncError && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg shadow-sm">
          <p className="font-bold text-sm mb-1">Sync Failed</p>
          <p className="text-xs">{syncError}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(n => (
            <div key={n} className="h-24 bg-white/50 border border-gray-100 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : estimates.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative z-10">
            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-lg font-bold text-gray-800 mb-2">No Estimates Yet</h4>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">Create a customized Bill of Quantities (BOQ) to share with your client and secure the deal.</p>
            <button
              onClick={() => setIsBuildingEstimate(true)}
              className="mt-6 px-6 py-2.5 bg-blue-50 text-blue-700 font-bold text-sm rounded-xl hover:bg-blue-100 hover:scale-105 transition-all"
            >
              Start Generating
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {estimates.map(est => (
            <div key={est.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    Estimate {est.estimator_reference_id || `#${est.id.substring(0,6).toUpperCase()}`}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">Created: {new Date(est.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={est.status === 'accepted' ? 'success' : est.status === 'sent' ? 'primary' : 'secondary'} className="capitalize">
                    {est.status}
                  </Badge>
                  {est.status === 'draft' && (
                    <button
                      onClick={() => handleUpdateStatus(est.id, 'sent')}
                      className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-md transition-all uppercase tracking-wider shadow-sm"
                      title="Mark as Sent to Client"
                    >
                      Send
                    </button>
                  )}
                  {est.status === 'sent' && (
                    <button
                      onClick={() => handleUpdateStatus(est.id, 'accepted')}
                      className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-md transition-all uppercase tracking-wider shadow-sm"
                      title="Mark as Approved/Accepted"
                    >
                      Accept
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 mb-4 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Value</span>
                  <p className="text-xl font-extrabold text-gray-900">₹{est.total_amount ? Number(est.total_amount).toLocaleString('en-IN') : '0'}</p>
                </div>
                {est.pdf_url ? (
                  <a 
                    href={est.pdf_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center justify-center w-10 h-10 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors"
                    title="View PDF Document"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </a>
                ) : (
                  <button 
                    onClick={() => handlePrintEstimate(est)}
                    className="flex items-center justify-center w-10 h-10 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                    title="Print / Save PDF"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Last synced: {new Date(est.updated_at || est.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEditEstimate(est)}
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Estimate"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => setEstimateToDelete(est)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Estimate"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isBuildingEstimate && (
        <EstimatorBuilder
          leadId={leadId}
          lead={lead}
          initialEstimate={editingEstimate}
          onCancel={handleCloseBuilder}
          onSaved={() => {
            handleCloseBuilder();
            fetchEstimates();
          }}
        />
      )}

      <Modal
        isOpen={!!estimateToDelete}
        onClose={() => !deleting && setEstimateToDelete(null)}
        title="Delete Estimate"
        size="sm"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="ghost" onClick={() => setEstimateToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteEstimate} disabled={deleting} loading={deleting}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-gray-600 text-sm">
          Are you sure you want to delete Estimate <strong>{estimateToDelete?.estimator_reference_id || (estimateToDelete && `#${estimateToDelete.id.substring(0, 6).toUpperCase()}`)}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
