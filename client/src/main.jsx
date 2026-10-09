import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { ErrorBoundary } from './App.jsx';
import './styles.css';

function AppRoot() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
