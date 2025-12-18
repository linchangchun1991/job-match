
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

const showError = (message: string, detail?: string) => {
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="color: #ef4444; background: #000; padding: 40px; font-family: sans-serif; text-align: center; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <div style="border: 1px solid #333; padding: 30px; border-radius: 16px; max-width: 600px; background: #080808;">
          <h2 style="margin-bottom: 10px; font-size: 24px; color: #fff;">系统启动异常</h2>
          <p style="color: #9ca3af; margin-bottom: 20px; font-size: 14px;">${message}</p>
          ${detail ? `<code style="background: #111; padding: 12px; border-radius: 8px; color: #f87171; font-size: 12px; display: block; text-align: left; overflow: auto; max-height: 200px; font-family: monospace; border: 1px solid #222;">${detail}</code>` : ''}
          <button onclick="window.location.reload()" style="margin-top: 24px; padding: 10px 30px; background: #fff; color: #000; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: opacity 0.2s;">重新加载页面</button>
          <p style="margin-top: 20px; font-size: 10px; color: #444; text-transform: uppercase;">Engine: Gemini 3.0 Pro | Powered by Highmark</p>
        </div>
      </div>
    `;
  }
};

if (!rootElement) {
  console.error("Fatal Error: Root element not found.");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Critical Runtime Error:", err);
    showError(
      "应用在渲染组件树时遇到了不可恢复的错误。这通常是由于环境变量 (API_KEY) 未配置或浏览器脚本加载冲突引起的。",
      err instanceof Error ? err.stack || err.message : String(err)
    );
  }
}
