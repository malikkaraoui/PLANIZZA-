import { useState, useEffect, useRef } from 'react';

/**
 * Hook pour détecter la direction du scroll et cacher/montrer la navbar.
 * 
 * @param {number} threshold - Pixels de scroll minimum pour déclencher le changement (défaut: 10)
 * @returns {{ isVisible: boolean }} - true si navbar visible, false si cachée
 */
export function useScrollDirection(threshold = 10) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Toujours visible si en haut de page
      if (currentScrollY < 10) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Détection simple : scroll up = montre, scroll down = cache
      if (currentScrollY < lastScrollY.current) {
        // Scroll vers le haut → MONTRER
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY.current + 10) {
        // Scroll vers le bas de plus de 10px → CACHER
        setIsVisible(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return { isVisible };
}
