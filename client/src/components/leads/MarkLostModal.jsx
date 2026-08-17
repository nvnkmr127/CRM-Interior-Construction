import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const MarkLostModal = ({ isOpen, onClose, onConfirm, isSubmitting }) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="flex flex-col overflow-hidden -m-6"> {/* Negative margin to offset generic Modal padding if it exists */}
        {/* Header Section */}
        <div className="bg-gradient-to-r from-red-50/80 to-white px-8 py-7 border-b border-red-100 flex items-start gap-5">
          <div className="bg-white p-3 rounded-2xl text-red-600 shrink-0 shadow-sm border border-red-100 mt-0.5">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1.5">Mark Lead as Lost</h3>
            <p className="text-sm text-gray-600 leading-relaxed max-w-md">
              Please provide a reason for why this lead is being marked as lost. This action will <span className="font-semibold text-red-600">permanently delete</span> the lead from the active pipeline.
            </p>
          </div>
        </div>

        {/* Form Section */}
        <div className="px-8 py-7 bg-white">
          <div className="mb-8 relative group">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              Reason for loss <span className="text-red-500 text-base leading-none">*</span>
            </label>
            <div className="relative">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-base border-2 border-transparent rounded-2xl p-4 bg-gray-50 group-hover:bg-gray-100/50 focus:bg-white focus:ring-4 focus:ring-red-500/10 focus:border-red-400 outline-none transition-all duration-300 resize-none placeholder-gray-400 font-medium text-gray-800"
                rows="4"
                placeholder="e.g., Client went with competitor, budget too low..."
                autoFocus
              />
              <div className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-inset ring-gray-200 group-hover:ring-gray-300 transition-all duration-300"></div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all font-semibold shadow-sm"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirm}
              disabled={!reason.trim() || isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all font-semibold shadow-sm shadow-red-500/20 disabled:opacity-50 disabled:shadow-none"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processing...
                </span>
              ) : 'Confirm Delete'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MarkLostModal;
