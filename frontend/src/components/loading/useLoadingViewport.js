import { useEffect, useState } from 'react';

export default function useLoadingViewport(containerRef) {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 860);
  useEffect(() => {
    const measure = () => setMobile((containerRef?.current?.clientWidth || window.innerWidth) <= (containerRef ? 700 : 860));
    measure();
    const observer = containerRef?.current && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (observer) observer.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [containerRef]);
  return mobile;
}
