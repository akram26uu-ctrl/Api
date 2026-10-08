import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Set the primary locale before React mounts to avoid an LTR flash on first load.
try {
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
} catch {
  // Ignore non-browser environments.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
