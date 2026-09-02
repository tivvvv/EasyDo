import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { AppDialogProvider } from './components/AppDialog';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { QuickCaptureWindow } from './components/QuickCaptureWindow';

const root = document.querySelector<HTMLDivElement>('#root');
const desktopRuntime = '__TAURI_INTERNALS__' in window;

if (!root) {
  throw new Error('无法找到应用根节点.');
}

if (desktopRuntime) document.documentElement.dataset.runtime = 'desktop';
const captureRuntime = desktopRuntime && new URLSearchParams(window.location.search).has('capture');
if (captureRuntime) document.documentElement.dataset.capture = 'true';

createRoot(root).render(
  <StrictMode>
    {desktopRuntime && !captureRuntime && (
      <div aria-hidden="true" className="desktop-titlebar" data-tauri-drag-region />
    )}
    <AppErrorBoundary>
      <AppDialogProvider>{captureRuntime ? <QuickCaptureWindow /> : <App />}</AppDialogProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
