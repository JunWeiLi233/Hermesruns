import { useEffect, useRef, useState } from 'react';

export function useScrollReveal({ threshold = 0.1, rootMargin = '0px', initialVisible = false } = {}) {
  const [isVisible, setIsVisible] = useState(Boolean(initialVisible));
  const ref = useRef(null);

  useEffect(() => {
    if (initialVisible) return undefined;

    const currentRef = ref.current;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }

    if (!currentRef) {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { threshold, rootMargin });

    observer.observe(currentRef);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, initialVisible]);

  return { ref, isVisible };
}
