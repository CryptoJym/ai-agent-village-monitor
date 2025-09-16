import React from 'react';
import { createRoot } from 'react-dom/client';
import AppRouter from './routes/AppRouter';
import './i18n';
import './styles/global.css';
import { ToastProvider } from './ui/Toast';
import { registerSW } from './swRegister';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  </React.StrictMode>,
);

// Register Service Worker (non-blocking)
registerSW();
