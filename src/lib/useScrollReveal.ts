import { useEffect, useRef } from 'react';

/** Reveal off-screen content once it approaches the viewport. Without JS, IO, or
 * a motion preference that permits movement, the content stays fully visible. */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const initiallyOffscreen = element.getBoundingClientRect().top >= window.innerHeight;
    if (initiallyOffscreen) element.classList.add('hub-reveal-pending');

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('hub-reveal-pending');
        entry.target.classList.add('hub-revealed');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -48px 0px', threshold: 0.08 });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return ref;
}
