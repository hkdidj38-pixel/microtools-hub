import { useEffect, useRef } from 'react';

/** Reveal off-screen sections once, while leaving all content visible without IO or when reduced motion is preferred. */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (element.getBoundingClientRect().top < window.innerHeight) {
      element.classList.add('hub-revealed');
      return;
    }

    element.classList.add('hub-reveal-pending');
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      element.classList.remove('hub-reveal-pending');
      element.classList.add('hub-revealed');
      observer.disconnect();
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.08 });

    observer.observe(element);
    return () => {
      observer.disconnect();
      element.classList.remove('hub-reveal-pending');
    };
  }, []);

  return ref;
}
