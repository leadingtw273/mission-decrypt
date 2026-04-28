import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export function usePrefersReducedMotion() {
  const motionPreference = useReducedMotion();
  const [mediaPreference, setMediaPreference] = useState(() => readReducedMotionMediaQuery());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) {
      return;
    }

    const updatePreference = () => {
      setMediaPreference(mediaQuery.matches ?? false);
    };

    updatePreference();
    mediaQuery.addEventListener?.('change', updatePreference);

    return () => {
      mediaQuery.removeEventListener?.('change', updatePreference);
    };
  }, []);

  return motionPreference || mediaPreference;
}

function readReducedMotionMediaQuery() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery?.matches ?? false;
}
