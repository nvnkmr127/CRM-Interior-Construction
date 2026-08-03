export const parseFiltersFromURL = (searchStr, defaultFilters = {}) => {
  const params = new URLSearchParams(searchStr);
  const filters = { ...defaultFilters };

  for (const [key, value] of params.entries()) {
    if (key === 'view' || key === 'new' || key === 'id') {
      continue; // Skip specific non-filter UI state params
    }
    
    // We expect some arrays and some strings. For comma-separated, we split.
    // If default filter has this key as an array, parse it as an array
    if (Array.isArray(defaultFilters[key])) {
      filters[key] = value ? value.split(',') : [];
    } else {
      filters[key] = value;
    }
  }
  return filters;
};

export const serializeFiltersToURL = (filters, existingSearch = '') => {
  const params = new URLSearchParams(existingSearch);
  
  for (const [key, value] of Object.entries(filters)) {
    // Exclude internal component state keys from being serialized if they're default values
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(','));
      } else {
        params.delete(key);
      }
    } else if (value && value !== 'all' && value !== 'All Sources' && value !== 'All Time') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }
  
  return params.toString();
};

export const mapAnalyticsFiltersToLeadFilters = (analyticsFilters, extraOverrides = {}) => {
  const leadFilters = {};
  
  if (analyticsFilters.source && analyticsFilters.source.length > 0) {
    leadFilters.source = analyticsFilters.source[0]; // LeadsPage currently supports single source
  }
  if (analyticsFilters.salesperson && analyticsFilters.salesperson.length > 0) {
    // Ideally this maps name to ID, assuming the backend can handle names or we just pass the first
    leadFilters.assigneeId = analyticsFilters.salesperson[0];
  }
  if (analyticsFilters.status && analyticsFilters.status.length > 0) {
    leadFilters.stageId = analyticsFilters.status[0];
  }

  // Map 'date' to createdFrom / createdTo roughly
  if (analyticsFilters.date && analyticsFilters.date !== 'All Time') {
    const now = new Date();
    if (analyticsFilters.date === 'This Month') {
      leadFilters.createdFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else if (analyticsFilters.date === 'This Quarter') {
      const q = Math.floor(now.getMonth() / 3);
      leadFilters.createdFrom = new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0];
    } else if (analyticsFilters.date === 'This Year') {
      leadFilters.createdFrom = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    } else if (analyticsFilters.date === 'This Week') {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      leadFilters.createdFrom = d.toISOString().split('T')[0];
    }
  }

  return { ...leadFilters, ...extraOverrides };
};
