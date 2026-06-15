import React, { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setShowBackOnline(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowBackOnline(true);
      setTimeout(() => setShowBackOnline(false), 3000);
    };

    const handleNetworkError = () => {
      // Just in case the browser hasn't fired 'offline' yet, we can check.
      // Or we can manually force it offline if an API request failed with network error
      // But navigator.onLine is usually reliable enough. We'll just sync state.
      if (!navigator.onLine) {
        setIsOffline(true);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('app:network-error', handleNetworkError);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('app:network-error', handleNetworkError);
    };
  }, []);

  if (isOffline) {
    return (
      <div className="fixed top-0 left-0 w-full z-50 bg-amber-500 text-white text-center py-2 px-4 shadow-md font-medium text-sm">
        <span className="mr-2">⚠️</span> No internet connection. Changes may not be saved.
      </div>
    );
  }

  if (showBackOnline) {
    return (
      <div className="fixed top-0 left-0 w-full z-50 bg-green-500 text-white text-center py-2 px-4 shadow-md font-medium text-sm animate-fade-in-down">
        <span className="mr-2">✓</span> Back online
      </div>
    );
  }

  return null;
}
