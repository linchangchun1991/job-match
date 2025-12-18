import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Critical: Could not find root element with ID 'root'");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Critical: Failed to render app", err);
    rootElement.innerHTML = `<div style="color: red; padding: 20px;">Render Error: ${err instanceof Error ? err.message : String(err)}</div>`;
  }
}