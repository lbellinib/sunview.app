import { useEffect, useState } from 'react';

export function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = () => setPrefers(media.matches);
    listener();
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return prefers;
}
