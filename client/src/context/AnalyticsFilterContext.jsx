import React, { createContext, useContext, useState } from 'react';

const AnalyticsFilterContext = createContext();

export const useAnalyticsFilters = () => useContext(AnalyticsFilterContext);

export const AnalyticsFilterProvider = ({ children }) => {
  const [globalFilters, setGlobalFilters] = useState({
    dateRange: 'YTD',
    project: 'All',
    client: 'All',
    branch: 'All',
    projectManager: 'All',
    designer: 'All',
    vendor: 'All',
    status: 'All',
    stage: 'All',
    projectType: 'All',
    budgetRange: 'All',
    profitMargin: 'All',
    city: 'All',
    team: 'All',
    materialCategory: 'All'
  });

  const updateFilter = (key, value) => {
    setGlobalFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setGlobalFilters({
      dateRange: 'YTD',
      project: 'All',
      client: 'All',
      branch: 'All',
      projectManager: 'All',
      designer: 'All',
      vendor: 'All',
      status: 'All',
      stage: 'All',
      projectType: 'All',
      budgetRange: 'All',
      profitMargin: 'All',
      city: 'All',
      team: 'All',
      materialCategory: 'All'
    });
  };

  return (
    <AnalyticsFilterContext.Provider value={{ globalFilters, updateFilter, resetFilters }}>
      {children}
    </AnalyticsFilterContext.Provider>
  );
};
