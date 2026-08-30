import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

Object.defineProperty(window, 'matchMedia', {
  value: (query: string) => ({
    addEventListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
  }),
  writable: true,
});

window.confirm = () => true;
