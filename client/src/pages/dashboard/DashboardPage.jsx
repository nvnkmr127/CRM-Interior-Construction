import React, { useState, useEffect } from 'react';
import ContentLoader from '../../components/ui/ContentLoader';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      {loading ? (
        <ContentLoader type="card" rows={3} />
      ) : (
        <div className="text-gray-500">Dashboard stats loaded.</div>
      )}
    </div>
  );
}
