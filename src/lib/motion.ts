import { flushSync } from 'react-dom';

interface ViewTransitionAPI {
  startViewTransition?: (callback: () => void) => unknown;
}

/** Use the native View Transition API when available; state remains immediate otherwise. */
export function runWithViewTransition(update: () => void): void {
  if (typeof document === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }

  const startViewTransition = (document as unknown as ViewTransitionAPI).startViewTransition;
  if (typeof startViewTransition !== 'function') {
    update();
    return;
  }

  try {
    startViewTransition.call(document, () => flushSync(update));
  } catch {
    update();
  }
}
