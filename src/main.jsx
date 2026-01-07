import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.jsx'

// Logs globaux en DEV pour diagnostiquer les pages blanches (erreurs runtime silencieuses).
if (import.meta.env.DEV) {
  window.addEventListener('error', (event) => {
    console.error('[GLOBAL_ERROR]', event?.error || event);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[UNHANDLED_REJECTION]', event?.reason || event);
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
