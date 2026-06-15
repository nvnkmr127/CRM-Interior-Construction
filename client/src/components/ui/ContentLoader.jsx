import React from 'react';
import Skeleton from './Skeleton';

export default function ContentLoader({ rows = 3, type = 'list' }) {
  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <Skeleton variant="circle" width={48} height={48} />
            <Skeleton variant="text" lines={2} />
            <Skeleton variant="rect" height={32} />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex gap-4">
          <Skeleton variant="rect" width="20%" height={24} />
          <Skeleton variant="rect" width="20%" height={24} />
          <Skeleton variant="rect" width="20%" height={24} />
          <Skeleton variant="rect" width="20%" height={24} />
          <Skeleton variant="rect" width="20%" height={24} />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 border-b border-gray-50 flex gap-4">
            <Skeleton variant="text" lines={1} width="20%" />
            <Skeleton variant="text" lines={1} width="20%" />
            <Skeleton variant="text" lines={1} width="20%" />
            <Skeleton variant="text" lines={1} width="20%" />
            <Skeleton variant="text" lines={1} width="20%" />
          </div>
        ))}
      </div>
    );
  }

  // list
  return (
    <div className="space-y-4 w-full">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Skeleton variant="circle" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" lines={1} width="40%" />
            <Skeleton variant="text" lines={1} width="80%" />
          </div>
        </div>
      ))}
    </div>
  );
}
