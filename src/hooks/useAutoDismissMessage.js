import { useEffect, useRef } from 'react';

/**
 * Auto-supprime un message (string) après un délai.
 * Par défaut: on ne dismiss pas les erreurs (préfixées par ❌), pour laisser le temps de les lire.
 */
export function useAutoDismissMessage(message, setMessage, { delayMs = 5000, dismissErrors = false } = {}) {
  const timeoutRef = useRef(null);

  useEffect(() => {
    const raw = typeof message === 'string' ? message : '';
    const next = raw.trim();

    if (!next) return;

    if (!dismissErrors && next.startsWith('❌')) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    timeoutRef.current = setTimeout(() => {
      setMessage('');
      timeoutRef.current = null;
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [message, setMessage, delayMs, dismissErrors]);
}
