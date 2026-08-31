import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

const root = document.querySelector<HTMLDivElement>('#root');
const desktopRuntime = '__TAURI_INTERNALS__' in window;

if (!root) {
  throw new Error('无法找到应用根节点.');
}

if (desktopRuntime) document.documentElement.dataset.runtime = 'desktop';

createRoot(root).render(
  <StrictMode>
    {desktopRuntime && (
      <div aria-hidden="true" className="desktop-titlebar" data-tauri-drag-region />
    )}
    <App />
  </StrictMode>,
);
