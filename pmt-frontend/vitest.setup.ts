import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React Testing Library does not auto-cleanup under Vitest globals; do it here
// so a leaked DOM from one test cannot affect the next.
afterEach(() => {
  cleanup();
});
