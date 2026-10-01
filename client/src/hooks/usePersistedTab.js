import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';

/**
 * Universal hook to persist tab & sub-tab states across browser refreshes and sessions.
 * 
 * @param {string} paramKey - URL query param name (e.g., 'tab', 'subtab')
 * @param {string} defaultTab - Fallback tab if none is selected
 * @param {string} [storageKey] - Optional unique prefix for sessionStorage (defaults to location.pathname)
 * @returns {[string, (tab: string) => void]} [activeTab, setActiveTab]
 */
export function usePersistedTab(paramKey = 'tab', defaultTab, storageKey) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const resolvedStorageKey = storageKey || `tab:${location.pathname}`;
  const fullSessionKey = `${resolvedStorageKey}:${paramKey}`;

  const getInitialTab = () => {
    // 1. Check URL query params first (handles both 'subtab' and 'subTab' for flexibility)
    const fromUrl = searchParams.get(paramKey) || (paramKey === 'subtab' ? searchParams.get('subTab') : null);
    if (fromUrl) return fromUrl;

    // 2. Check sessionStorage
    try {
      const saved = sessionStorage.getItem(fullSessionKey);
      if (saved) return saved;
    } catch (e) {}

    return defaultTab;
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // On mount: ensure URL reflects the active tab/sub-tab so refreshes always know the exact tab
  useEffect(() => {
    const currentUrlParam = searchParams.get(paramKey) || (paramKey === 'subtab' ? searchParams.get('subTab') : null);
    if (!currentUrlParam && activeTab) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set(paramKey, activeTab);
        return next;
      }, { replace: true });
    }
  }, []);

  // Update tab function
  const setActiveTab = useCallback((newTab) => {
    if (!newTab) return;
    setActiveTabState(newTab);

    // Save to sessionStorage
    try {
      sessionStorage.setItem(fullSessionKey, newTab);
    } catch (e) {}

    // Save to URL search params without full-page navigation
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set(paramKey, newTab);
      return next;
    }, { replace: true });
  }, [paramKey, fullSessionKey, setSearchParams]);

  // Sync state if user navigates back/forward or modifies URL
  useEffect(() => {
    const currentUrlParam = searchParams.get(paramKey) || (paramKey === 'subtab' ? searchParams.get('subTab') : null);
    if (currentUrlParam && currentUrlParam !== activeTabRef.current) {
      setActiveTabState(currentUrlParam);
      try {
        sessionStorage.setItem(fullSessionKey, currentUrlParam);
      } catch (e) {}
    }
  }, [searchParams, paramKey, fullSessionKey]);

  return [activeTab, setActiveTab];
}

export default usePersistedTab;
