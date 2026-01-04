import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { rtdbPaths } from '../../../lib/rtdbPaths';

export function useMenu(truckId) {
  const enabled = Boolean(truckId && isFirebaseConfigured && db);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;

    // Éviter les setState synchrones dans le corps de l'effet (lint)
    // -> on bascule en "loading" dans une microtask.
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(() => {
        setLoading(true);
        setError(null);
      });
    } else {
      Promise.resolve().then(() => {
        setLoading(true);
        setError(null);
      });
    }

    const menuRef = ref(db, rtdbPaths.truckMenuItems(truckId));
    const unsub = onValue(
      menuRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val() || {};
          const itemsList = Object.entries(data).map(([id, item]) => {
            const safe = item && typeof item === 'object' ? item : {};
            return {
              id,
              ...safe,
              // Retro-compat: certains items anciens stockaient un prix sous prices.classic
              // (sans casser les items modernes utilisant sizes.*.priceCents).
              priceCents:
                safe.priceCents != null
                  ? Number(safe.priceCents)
                  : safe.prices?.classic != null
                    ? Number(safe.prices.classic)
                    : undefined,
              available: safe.available !== false,
            };
          });
          setItems(itemsList);
        } else {
          setItems([]);
        }
        setLoading(false);
      },
      (err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setItems([]);
        setLoading(false);
      }
    );

    return () => {
      unsub();
    };
  }, [enabled, truckId]);

  // Valeurs dérivées : si on n'a pas de truckId (ou pas de Firebase), on expose un état neutre.
  return {
    items: enabled ? items : [],
    loading: enabled ? loading : false,
    error: enabled ? error : null,
  };
}
