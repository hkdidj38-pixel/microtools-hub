import { flushSync } from 'react-dom';

interface NativeViewTransition {
  finished?: Promise<void>;
}

interface ViewTransitionAPI {
  startViewTransition?: (update: () => void) => NativeViewTransition;
}

/** Keep local UI state immediate unless native View Transitions are available and motion is allowed. */
export function runWithViewTransition(update: () => void): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    update();
    return;
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }

  const startViewTransition = (document as unknown as ViewTransitionAPI).startViewTransition;
  if (typeof startViewTransition !== 'function') {
    update();
    return;
  }

  let updateStarted = false;
  try {
    const transition = startViewTransition.call(document, () => {
      updateStarted = true;
      flushSync(update);
    });
    void transition.finished?.catch(() => undefined);
  } catch {
    // Do not retry a callback that already ran if the native API failed afterward.
    if (!updateStarted) update();
  }
}
