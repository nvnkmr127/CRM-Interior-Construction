import api from '../api/axios';

export const DEFAULT_PROJECT_TYPES = [
  { id: 'full_interior', label: 'Full Interior', icon: '🏠' },
  { id: 'modular_kitchen', label: 'Modular Kitchen', icon: '🍳' },
  { id: 'commercial', label: 'Commercial', icon: '🏢' },
  { id: 'turnkey', label: 'Turnkey', icon: '🔑' },
  { id: 'renovation', label: 'Renovation', icon: '🔨' }
];

export async function fetchProjectTypes() {
  try {
    const res = await api.get('/config/tenant-settings');
    const customTypes = res.data?.data?.project_types || res.data?.project_types;
    if (Array.isArray(customTypes) && customTypes.length > 0) {
      return customTypes;
    }
  } catch (err) {
    console.warn('Could not fetch project types from settings, using default:', err);
  }
  return DEFAULT_PROJECT_TYPES;
}
