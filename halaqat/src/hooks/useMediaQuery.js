import { useEffect, useState } from 'react';

/** يستمع لتغير استعلام الوسائط (يعمل مع تغيّر تفضيل النظام أثناء التصفح). */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    setMatches(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);

  return matches;
}

export const BREAKPOINTS = {
  mobile: '(max-width: 640px)',
  tabletDown: '(max-width: 900px)',
  desktopUp: '(min-width: 1024px)',
  largeDesktop: '(min-width: 1440px)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  dark: '(prefers-color-scheme: dark)',
};
