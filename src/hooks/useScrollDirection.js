import { useState, useEffect } from 'react';

/**
 * Hook pour détecter la direction du scroll et cacher/montrer la navbar.
 * 
 * @param {number} threshold - Pixels de scroll minimum pour déclencher le changement (défaut: 10)
 * @returns {{ isVisible: boolean }} - true si navbar visible, false si cachée
 */
export function useScrollDirection(threshold = 10) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;

      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;

        // Si on est tout en haut, toujours montrer
        if (currentScrollY <= 0) {
          setIsVisible(true);
          setLastScrollY(currentScrollY);
          ticking = false;
          return;
        }

        // Calculer la différence depuis le dernier scroll
        const diff = currentScrollY - lastScrollY;

        // Si différence assez significative (> threshold)
        if (Math.abs(diff) > threshold) {
          if (diff > 0) {
            // Scroll vers le bas → cacher
            setIsVisible(false);
          } else {
            // Scroll vers le haut → montrer
            setIsVisible(true);
          }
          setLastScrollY(currentScrollY);
        }

        ticking = false;
      });

      ticking = true;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [lastScrollY, threshold]);

  return { isVisible };
}
