import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Explicit rather than relying on RTL's auto-detected cleanup, per Vitest's
// own recommended setup -- without this, a component left mounted by one
// test (e.g. an expanded widget) can still be in the DOM for the next test.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement scrollIntoView -- several components call it after
// new messages/rows render (e.g. chat-style auto-scroll).
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
