import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Polyfills for React Native Web
if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).__DEV__ = import.meta.env.DEV;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
