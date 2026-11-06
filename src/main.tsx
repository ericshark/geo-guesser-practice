import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

export function App() {
  return <main>GeoGuessr Practice</main>;
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
