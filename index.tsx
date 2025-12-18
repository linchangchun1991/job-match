import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Fatal Error: #root element not found. Application cannot start.");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("React Mounting Failure:", err);
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="color: #ef4444; background: #000; padding: 40px; font-family: sans-serif; text-align: center;">
          <h2 style="margin-bottom: 10px;">渲染系统崩溃 (Mount Error)</h2>
          <code style="background: #111; padding: 4px 8px; border-radius: 4px; color: #9ca3af; font-size: 13px;">
            ${err instanceof Error ? err.message : String(err)}
          </code>
        </div>
      `;
    }
  }
}