import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

console.log('App: Initializing... checking root element');

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("CRITICAL: Root element #root not found in DOM.");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('App: Render sequence initiated.');
  } catch (err) {
    console.error("CRITICAL: React root render failed:", err);
    if (rootElement) {
      rootElement.innerHTML = `<div style="color: red; padding: 20px;">
        <h2>渲染崩溃 (Render Crash)</h2>
        <pre>${err instanceof Error ? err.message : String(err)}</pre>
      </div>`;
    }
  }
}