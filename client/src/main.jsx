import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/responsive.css'
import './index.css'
import App from './App.jsx'

const originalConsoleWarn = console.warn;
console.warn = function (...args) {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('The width(-1) and height(-1) of chart should be greater than 0')
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Silence third-party browser extension / performance observer errors
window.addEventListener('error', (event) => {
  if (
    event.message?.includes("reading 'startTime'") ||
    event.message?.includes('reportAllChanges') ||
    (event.filename && (event.filename.startsWith('VM') || event.filename.includes('anonymous')))
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes("reading 'startTime'") ||
    event.reason?.message?.includes('reportAllChanges') ||
    event.reason?.stack?.includes('reportAllChanges')
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

import { PreferencesProvider } from './store/PreferencesContext.jsx';

try {
  const mockDbStr = localStorage.getItem('mockDatabase_v4');
  if (mockDbStr) {
    const mockDb = JSON.parse(mockDbStr);
    if (!mockDb.force_contacts_purged_final_2) {
      mockDb.contacts = [
        {
          id: 'mock-contact-1',
          lead_id: 'mock-lead-1',
          name: 'Priya Sharma',
          phone: '+91 9876543211',
          email: 'priya.s@example.com',
          role: 'Spouse',
          decision_authority: 'Primary',
          relationship_notes: 'Highly interested in modular kitchen details.'
        }
      ];
      mockDb.force_contacts_purged_final_2 = true;
      localStorage.setItem('mockDatabase_v4', JSON.stringify(mockDb));
      console.log('Forcefully wiped corrupted contacts from mock database');
      
      // Auto-reload once to ensure UI catches up with the fresh DB
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }
} catch (e) {
  console.error('Error cleaning mock DB', e);
}

createRoot(document.getElementById('root')).render(
  <PreferencesProvider>
    <App />
  </PreferencesProvider>,
)
