import React, { createContext, useContext, useState, useEffect } from 'react';

const defaultPrefs = {
  theme: 'system',
  layoutDensity: 'standard',
  defaultDashboard: 'sales',
  dateFormat: 'MM/DD/YYYY'
};

const PreferencesContext = createContext({
  localPrefs: defaultPrefs,
  setLocalPrefs: () => {}
});

export const PreferencesProvider = ({ children }) => {
  const [localPrefs, setLocalPrefs] = useState(() => {
    try {
      const stored = localStorage.getItem('crm_local_prefs');
      return stored ? JSON.parse(stored) : defaultPrefs;
    } catch {
      return defaultPrefs;
    }
  });

  useEffect(() => {
    localStorage.setItem('crm_local_prefs', JSON.stringify(localPrefs));
    
    // Apply theme
    if (localPrefs.theme === 'dark' || (localPrefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply layout density
    if (localPrefs.layoutDensity === 'compact') {
      document.documentElement.classList.add('density-compact');
    } else {
      document.documentElement.classList.remove('density-compact');
    }

  }, [localPrefs]);

  return (
    <PreferencesContext.Provider value={{ localPrefs, setLocalPrefs }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => useContext(PreferencesContext);
