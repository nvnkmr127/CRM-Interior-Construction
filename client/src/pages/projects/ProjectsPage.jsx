import React, { useState, useEffect } from 'react';
import ContentLoader from '../../components/ui/ContentLoader';

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Projects</h1>
      {loading ? (
        <ContentLoader type="table" rows={5} />
      ) : (
        <div className="text-gray-500">Projects loaded.</div>
      )}
    </div>
  );
}
