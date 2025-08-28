import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import dayjs from 'dayjs';
import 'dayjs/locale/el';

// Set global locale to Greek
dayjs.locale('el');

// Register service worker only in production builds
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
  console.log('Service worker registered:', reg?.scope || '(no scope)');
        // Force update check
        if (reg.update) reg.update();
      })
      .catch((err) => console.warn('SW registration failed', err));
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
