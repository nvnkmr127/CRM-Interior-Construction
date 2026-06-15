import React from 'react';
import Spinner from './Spinner';

export default function PageLoader() {
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
      <div className="text-3xl font-extrabold text-blue-600 mb-6 tracking-tight">CRM Interior</div>
      <Spinner size="lg" className="mb-4" />
      <div className="text-gray-500 font-medium">Loading...</div>
    </div>
  );
}
