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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
